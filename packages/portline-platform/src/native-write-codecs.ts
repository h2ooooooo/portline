import path from 'node:path';
import {XMLBuilder, XMLParser, XMLValidator} from 'fast-xml-parser';
import type {ConnectionDefinition, ConnectionProfile, ProfileDiagnostic} from '@jalsoedesign/portline-abstract';
import {decodeName, parseIni, parseRegistryExport} from './storage.js';
import {safeProfilePath, safeScalar} from './write-validation.js';
import type {
    NativeWriteOptions, NativeWritePatch, ProfileMutation, RegistryPatch, WriteSnapshot, WriterTarget,
} from './write-types.js';

const roots = {
    putty: 'HKEY_CURRENT_USER\\Software\\SimonTatham\\PuTTY\\Sessions',
    kitty: 'HKEY_CURRENT_USER\\Software\\9bis.com\\KiTTY\\Sessions',
    heidisql: 'HKEY_CURRENT_USER\\Software\\HeidiSQL\\Servers',
    winscp: 'HKEY_CURRENT_USER\\Software\\Martin Prikryl\\WinSCP 2\\Sessions',
};

type Fields = Record<string, string | number | undefined>;

export function decodeImage(data: string | null): {text: string; encode: (text: string) => string} {
    const bytes = Buffer.from(data ?? '', 'base64');
    const utf16 = bytes[0] === 255 && bytes[1] === 254;
    const bom = utf16 ? bytes.subarray(0, 2) : bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191])) ?
        bytes.subarray(0, 3) : Buffer.alloc(0);
    const encoding = utf16 ? 'utf16le' : 'utf8';

    return {
        text: bytes.subarray(bom.length).toString(encoding),
        encode: text => Buffer.concat([bom, Buffer.from(text, encoding)]).toString('base64'),
    };
}

function enforceMode(mutation: ProfileMutation, found: boolean) {
    if (
        (mutation.operation === 'create' &&
            found) ||
            (['update', 'delete'].includes(mutation.operation) &&
                !found)
    ) {
        throw new Error(found ? 'Destination profile already exists; preview an explicit update' :
            'Destination profile does not exist');
    }
}

function primary(profile: ConnectionProfile): ConnectionDefinition {
    const connection = profile.connections[0];

    if (!connection) {
        throw new Error('No connection selected');
    }

    return connection;
}

function keyPath(connection: ConnectionDefinition): string {
    const key = connection.authentication.find(auth => auth.type === 'private-key')?.path;

    if (!key?.value) {
        return '';
    }

    if (path.posix.isAbsolute(key.value) || path.win32.isAbsolute(key.value)) {
        return key.value;
    }

    if (key.baseDirectory && (path.posix.isAbsolute(key.baseDirectory) || path.win32.isAbsolute(key.baseDirectory))) {
        const api = path.win32.isAbsolute(key.baseDirectory) ? path.win32 : path.posix;

        return api.resolve(key.baseDirectory, key.value);
    }

    throw new Error('Resolve relative private key paths before writing to another application');
}

function fieldProjection(
    application: string,
    profile: ConnectionProfile,
    current: Record<string, any>,
    allowLossy: boolean,
    diagnostics: ProfileDiagnostic[],
): Fields {
    const connection = primary(profile);
    const endpoint = connection.endpoint;
    const key = keyPath(connection);
    const identityChanged = (hostField: string, userField: string, portField: string) =>
        String(current[hostField] ?? '') !== endpoint.host ||
        String(current[userField] ?? '') !== (endpoint.username ?? '') ||
        Number(current[portField] ?? 0) !== endpoint.port;
    const lose = (field: string) => {
        if (!allowLossy) {
            throw new Error('Destination cannot represent ' + field + '; review and explicitly allow lossy metadata');
        }

        diagnostics.push({
            code: 'omitted-field',
            severity: 'warning',
            field,
            message: 'Destination cannot represent ' + field,
        });
    };

    if (profile.localDirectory && !['filezilla', 'winscp', 'jetbrains'].includes(application)) {
        lose('localDirectory');
    }

    if (
        'remoteDirectory' in connection &&
        connection.remoteDirectory &&
        ['putty', 'kitty', 'openssh'].includes(application)
    ) {
        lose('remoteDirectory');
    }

    if (application === 'putty' || application === 'kitty') {
        if (connection.kind !== 'ssh' || connection.via?.length) {
            throw new Error('PuTTY/KiTTY projection requires an SSH endpoint without implicit hop conversion');
        }

        return {
            HostName: endpoint.host,
            PortNumber: endpoint.port,
            UserName: endpoint.username ?? '',
            Protocol: 'ssh',
            PublicKeyFile: key,
            TryAgent: connection.authentication.some(auth => auth.type === 'agent') ? 1 : 0,
            ...(identityChanged('HostName', 'UserName', 'PortNumber') ? {Password: undefined} : {}),
        };
    }

    if (application === 'heidisql') {
        const sshOnly = connection.kind === 'ssh';
        const database = connection.kind === 'database' ? connection : undefined;
        const hop = sshOnly ? connection : connection.via?.length === 1 ?
            profile.connections.find(item => item.id === connection.via![0]) : undefined;

        if (connection.via?.length && (!hop || hop.kind !== 'ssh' || hop.via?.length)) {
            throw new Error('HeidiSQL can represent only one SSH tunnel');
        }

        if (sshOnly && !current.Host) {
            throw new Error('An SSH-only profile can update an existing HeidiSQL tunnel, but cannot create a database session');
        }

        if (!sshOnly && !database) {
            throw new Error('HeidiSQL requires a database connection or an explicit existing tunnel update');
        }

        const fields: Fields = database ? {
            Host: endpoint.host,
            User: endpoint.username ?? '',
            Port: String(endpoint.port),
            NetType: database.protocol === 'mysql' ? (hop ? 2 : 0) :
                database.protocol === 'postgresql' ? (hop ? 9 : 8) : 4,
            Databases: database.database ?? '',
            ...(identityChanged('Host', 'User', 'Port') ? {Password: undefined} : {}),
        } : {};

        if (hop) {
            Object.assign(fields, {
                SSHtunnelActive: 1,
                SSHtunnelHost: hop.endpoint.host,
                SSHtunnelHostPort: hop.endpoint.port,
                SSHtunnelUser: hop.endpoint.username ?? '',
                SSHtunnelPrivateKey: keyPath(hop),
                ...(String(current.SSHtunnelHost ?? '') !== hop.endpoint.host ||
                    String(current.SSHtunnelUser ?? '') !== (hop.endpoint.username ?? '') ?
                    {SSHtunnelPassword: undefined} : {}),
            });
        } else {
            fields.SSHtunnelActive = 0;
        }

        return fields;
    }

    if (application === 'winscp') {
        if (!['ssh', 'ftp'].includes(connection.kind)) {
            throw new Error('WinSCP requires a transfer or SSH connection');
        }

        const hop = connection.via?.length === 1 ?
            profile.connections.find(item => item.id === connection.via![0]) : undefined;

        if (connection.via?.length && (!hop || hop.kind !== 'ssh' || hop.via?.length)) {
            throw new Error('WinSCP can represent only one SSH tunnel');
        }

        if (connection.kind === 'ftp' && connection.tls === 'optional') {
            throw new Error('Optional FTP TLS cannot be represented by WinSCP without changing policy');
        }

        return {
            HostName: endpoint.host,
            PortNumber: endpoint.port,
            UserName: connection.authentication.some(auth => auth.type === 'anonymous') ?
                'anonymous' : endpoint.username ?? '',
            TryAgent: connection.authentication.some(auth => auth.type === 'agent') ? 1 : 0,
            FSProtocol: connection.kind === 'ssh' ? 2 : 5,
            Ftps: connection.kind === 'ftp' ? connection.tls === 'implicit' ? 1 :
                connection.tls === 'explicit' ? 2 : 0 : 0,
            PublicKeyFile: key,
            RemoteDirectory: 'remoteDirectory' in connection ? connection.remoteDirectory ?? '' : '',
            LocalDirectory: profile.localDirectory?.value ?? '',
            Tunnel: hop ? 1 : 0,
            ...(hop ? {
                TunnelHostName: hop.endpoint.host,
                TunnelPortNumber: hop.endpoint.port,
                TunnelUserName: hop.endpoint.username ?? '',
                TunnelPublicKeyFile: keyPath(hop),
                ...(String(current.TunnelHostName ?? '') !== hop.endpoint.host ||
                    String(current.TunnelUserName ?? '') !== (hop.endpoint.username ?? '') ?
                    {TunnelPassword: undefined} : {}),
            } : {}),
            ...(identityChanged('HostName', 'UserName', 'PortNumber') ? {Password: undefined} : {}),
        };
    }

    throw new Error('Unsupported native field projection');
}

/** Edits only selected section values; unrelated comments, settings and types remain untouched. */
function patchSection(document: string, section: string, fields: Fields, remove: boolean, registry: boolean) {
    const eol = document.includes('\r\n') ? '\r\n' : '\n';
    const lines = document.split(/\r?\n/);
    const heading = '[' + section + ']';
    const starts = lines.flatMap((line, index) => line.trim().toLowerCase() === heading.toLowerCase() ? [index] : []);

    if (starts.length > 1) {
        throw new Error('Duplicate destination sections require native cleanup');
    }

    let start = starts[0];

    if (start === undefined) {
        lines.push('', heading, '');
        start = lines.length - 2;
    }

    let end = lines.findIndex((line, index) => index > start && /^\[.*\]$/.test(line.trim()));

    if (end < 0) {
        end = lines.length;
    }

    if (remove) {
        lines.splice(start, end - start);

        return lines.join(eol);
    }

    for (const [name, value] of Object.entries(fields)) {
        const key = registry ? JSON.stringify(name) : name;
        const matches = [];

        for (let index = start + 1; index < end; index++) {
            const separator = lines[index].indexOf('=');

            if (separator >= 0 && lines[index].slice(0, separator).trim().toLowerCase() === key.toLowerCase()) {
                matches.push(index);
            }
        }

        if (matches.length > 1) {
            throw new Error('Duplicate native fields require cleanup before writing');
        }

        const encoded = value === undefined ? undefined : registry ?
            typeof value === 'number' ? 'dword:' + (value >>> 0).toString(16).padStart(8, '0') : JSON.stringify(value) :
            typeof value === 'number' ? String(value) : encodeURIComponent(value);
        const index = matches[0];

        if (index !== undefined) {
            if (encoded === undefined) {
                lines.splice(index, 1);
                end--;
            } else {
                lines[index] = key + '=' + encoded;
            }
        } else if (encoded !== undefined) {
            lines.splice(end++, 0, key + '=' + encoded);
        }
    }

    return lines.join(eol);
}

function patchHeidi(document: string, name: string, fields: Fields, remove: boolean): string {
    const prefix = 'Servers\\' + name.replace(/\//g, '\\') + '\\';
    const eol = document.includes('\r\n') ? '\r\n' : '\n';
    const lines = document.split(/\r?\n/);

    if (remove) {
        return lines.filter(line => !line.startsWith(prefix)).join(eol);
    }

    for (const [key, value] of Object.entries(fields)) {
        const property = prefix + key;
        const matches = lines.flatMap((line, index) => line.split('\t')[0] === property ? [index] : []);

        if (matches.length > 1) {
            throw new Error('Duplicate portable fields require native cleanup');
        }

        const entry = value === undefined ? undefined :
            property + '\t' + (typeof value === 'number' ? 3 : 1) + '\t' + String(value);

        if (matches[0] !== undefined) {
            if (entry === undefined) {
                lines.splice(matches[0], 1);
            } else {
                lines[matches[0]] = entry;
            }
        } else if (entry !== undefined) {
            lines.push(entry);
        }
    }

    const components = name.split('/');

    for (let depth = 1; depth < components.length; depth++) {
        const parent = 'Servers\\' + components.slice(0, depth).join('\\') + '\\';
        const entries = lines.filter(line => line.startsWith(parent) &&
            !line.slice(parent.length).split('\t')[0].includes('\\'));

        if (entries.length && !entries.some(line => line.startsWith(parent + 'Folder\t'))) {
            throw new Error('A destination folder collides with an existing database session');
        }

        if (!entries.length) {
            lines.push(parent + 'Folder\t3\t1');
        }
    }

    return lines.join(eol);
}

function settingsFromHeidi(text: string): Map<string, Record<string, any>> {
    const sessions = new Map<string, Record<string, any>>();

    for (const line of text.split(/\r?\n/)) {
        const parts = line.split('\t');
        const separator = parts[0].lastIndexOf('\\');

        if (parts.length !== 3 || !parts[0].startsWith('Servers\\')) {
            continue;
        }

        const name = parts[0].slice(8, separator).replace(/\\/g, '/');
        const settings = sessions.get(name) ?? Object.create(null);

        settings[parts[0].slice(separator + 1)] = parts[1] === '3' ? Number(parts[2]) : parts[2];
        sessions.set(name, settings);
    }

    return sessions;
}

function patchKitty(text: string, fields: Fields): string {
    const lines = text.split(/\r?\n/);

    for (const [key, value] of Object.entries(fields)) {
        const indices = lines.flatMap((line, index) => line.startsWith(key + '\\') ? [index] : []);

        if (indices.length > 1) {
            throw new Error('Duplicate KiTTY session values');
        }

        const encoded = value === undefined ? undefined : key + '\\' + encodeURIComponent(String(value)) + '\\';

        if (indices[0] !== undefined) {
            if (encoded === undefined) {
                lines.splice(indices[0], 1);
            } else {
                lines[indices[0]] = encoded;
            }
        } else if (encoded !== undefined) {
            lines.push(encoded);
        }
    }

    return lines.join(text.includes('\r\n') ? '\r\n' : '\n');
}

export function renderNativeWrite(
    target: WriterTarget,
    snapshot: WriteSnapshot,
    mutations: readonly ProfileMutation[],
    options: NativeWriteOptions,
): NativeWritePatch {
    const diagnostics: ProfileDiagnostic[] = [
        {
            code: 'metadata-only-sync',
            severity: 'warning',
            message: 'Stored secrets, private key contents, trust policies and application-specific settings are not copied',
        },
    ];
    const changes: any[] = [];
    const replacements = new Map<string, string | null>();
    const registry: RegistryPatch[] = [];
    const application = target.application;

    if (application === 'filezilla' || application === 'jetbrains') {
        return renderXml(target, snapshot, mutations, options, diagnostics);
    }

    if (application === 'openssh') {
        return renderOpenSsh(target, snapshot, mutations, options, diagnostics);
    }

    const exported = !target.directory && !target.registry && /^\s*(Windows Registry Editor|REGEDIT4)/
        .test(decodeImage(snapshot.files[0]?.data ?? null).text);
    const root = roots[application];
    const rawRoot = target.registry ? target.registry.hive + '\\' + target.registry.key : root;
    const sessions = target.registry ? new Map((snapshot.registry ?? []).map(item => [
        (application === 'heidisql' ? item.path.replace(/\\/g, '/') : decodeName(item.path)),
        Object.fromEntries(item.values.map(value => [value.name, value.value])),
    ])) : exported ? new Map(parseRegistryExport(decodeImage(snapshot.files[0].data).text, root)
        .map(item => [application === 'heidisql' ? item.name.replace(/\\/g, '/') : decodeName(item.name), item.settings])) :
        application === 'heidisql' ? settingsFromHeidi(decodeImage(snapshot.files[0].data).text) :
            new Map(parseIni(decodeImage(snapshot.files[0]?.data ?? null).text)
                .filter(item => item.name.startsWith('Sessions\\'))
                .map(item => [
                    decodeName(item.name.slice(9)),
                    Object.fromEntries(Object.entries(item.settings).map(([key, value]) => [
                        key,
                        typeof value === 'string' ? decodeName(value) : value,
                    ])),
                ]));

    for (const mutation of mutations) {
        const name = safeProfilePath(mutation.path);
        const collision = [...sessions.keys()].find(key => key.toLowerCase() === name.toLowerCase() && key !== name);

        if (collision) {
            throw new Error('Destination differs only by case; use the existing exact profile path');
        }

        const existingImages = target.directory ? snapshot.files.filter(image =>
            path.relative(target.directory!, image.path).split(path.sep).map(decodeName).join('/') === name) : [];

        if (existingImages.length > 1) {
            throw new Error('Native session file names collide');
        }

        const filename = existingImages[0]?.path ?? (target.directory ? path.join(target.directory,
            ...name.split('/').map(component => encodeURIComponent(component))) : snapshot.files[0]?.path);
        const image = snapshot.files.find(item => item.path === filename);
        const previous = target.directory ? Object.fromEntries(decodeImage(image?.data ?? null).text.split(/\r?\n/)
            .filter(line => line.includes('\\') && line.endsWith('\\')).map(line => [line.slice(0, line.indexOf('\\')), decodeName(line.slice(line.indexOf('\\') + 1, -1))])) : sessions.get(name);
        const found = previous !== undefined && (!target.directory || image?.data !== undefined && image.data !== null);

        enforceMode(mutation, found);

        if (!filename && !target.registry) {
            throw new Error('No target configuration file');
        }

        const fields = mutation.operation === 'delete' ? {} :
            fieldProjection(application, mutation.profile!, previous ?? {}, options.allowLossy ?? false, diagnostics);
        const updated = Object.entries(fields).filter(([key, value]) =>
            String(previous?.[key] ?? '') !== String(value ?? '') || value === undefined && previous?.[key] !== undefined);
        const nativeName = application === 'heidisql' ? name.replace(/\//g, '\\') : encodeURIComponent(name);
        const actualName = exported ? parseRegistryExport(decodeImage(snapshot.files[0].data).text, root)
            .find(item => (application === 'heidisql' ? item.name.replace(/\\/g, '/') : decodeName(item.name)) === name)?.name :
            undefined;
        const registryName = snapshot.registry?.find(item =>
            (application === 'heidisql' ? item.path.replace(/\\/g, '/') : decodeName(item.path)) === name)?.path;
        const rawName = registryName ?? actualName ?? nativeName;

        if (
            application === 'heidisql' &&
            (previous?.Folder !== undefined ||
                [...sessions.keys()].some(key => key.startsWith(name + '/')))
        ) {
            throw new Error('Folder/session collisions require native cleanup; folders are not deleted recursively');
        }

        changes.push({
            profileId: name,
            operation: mutation.operation === 'delete' ? 'delete' : found ? 'update' : 'create',
            fields: mutation.operation === 'delete' ? ['profile'] : updated.map(([field]) => field),
        });

        if (application === 'heidisql' && mutation.operation !== 'delete') {
            const components = name.split('/');

            for (let depth = 1; depth < components.length; depth++) {
                const parent = components.slice(0, depth).join('/');
                const existing = sessions.get(parent);

                if (existing && existing.Folder === undefined) {
                    throw new Error('A destination folder collides with a database session');
                }

                if (!existing) {
                    const folderPath = parent.split('/').join('\\');

                    if (target.registry) {
                        registry.push({path: folderPath, set: {Folder: 1}, unset: []});
                    } else if (exported) {
                        const current = replacements.get(filename!) ?? snapshot.files[0].data;
                        const decoded = decodeImage(current);

                        replacements.set(filename!, decoded.encode(patchSection(decoded.text,
                            root + '\\' + folderPath, {Folder: 1}, false, true)));
                    }
                }
            }
        }

        if (target.registry) {
            registry.push({
                path: rawName,
                remove: mutation.operation === 'delete',
                set: Object.fromEntries(updated.filter(([, value]) => value !== undefined)) as
                    Record<string, string | number>,
                unset: updated.filter(([, value]) => value === undefined).map(([key]) => key),
            });
        } else if (target.directory) {
            replacements.set(filename!, mutation.operation === 'delete' ? null :
                decodeImage(image?.data ?? null).encode(patchKitty(decodeImage(image?.data ?? null).text, fields)));
        } else {
            const current = replacements.get(filename!) ?? snapshot.files[0].data;
            const decoded = decodeImage(current);
            const result = exported ? patchSection(decoded.text, rawRoot + '\\' + rawName, fields,
                mutation.operation === 'delete', true) :
                application === 'heidisql' ? patchHeidi(decoded.text, name, fields, mutation.operation === 'delete') :
                    application === 'winscp' ? patchSection(decoded.text, 'Sessions\\' + rawName, fields,
                        mutation.operation === 'delete', false) :
                        (() => {
                            throw new Error('Writing unknown PuTTY fork file formats is unsupported; use registry or KiTTY directories');
                        })();

            replacements.set(filename!, decoded.encode(result));
        }
    }

    return {
        files: [...replacements].map(([filename, data]) => ({path: filename, data})),
        registry,
        changes,
        diagnostics,
    };
}

function siteName(value: string): string {
    return value.replace(/%2f/gi, '/').replace(/%25/gi, '%');
}

type XmlNode = Record<string, any>;

const parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    trimValues: false,
    parseTagValue: false,
    commentPropName: '#comment',
});
const builder = new XMLBuilder({
    preserveOrder: true,
    ignoreAttributes: false,
    suppressEmptyNode: false,
    commentPropName: '#comment',
});

function xml(text: string, initial: string): XmlNode[] {
    const contents = text.trim() ? text : initial;

    if (/<!DOCTYPE|<!ENTITY/i.test(contents) || XMLValidator.validate(contents) !== true) {
        throw new Error('Native XML is malformed or contains unsupported declarations');
    }

    return parser.parse(contents);
}

function nodes(parent: XmlNode[], tag: string): XmlNode[] {
    return parent.filter(node => Object.prototype.hasOwnProperty.call(node, tag));
}

function child(parent: XmlNode[], tag: string): XmlNode {
    const existing = nodes(parent, tag)[0];

    if (existing) {
        return existing;
    }

    const created = {[tag]: []};

    parent.push(created);

    return created;
}

function textOf(node: XmlNode): string {
    const tag = Object.keys(node).find(key => key !== ':@');

    return tag ? (node[tag] as XmlNode[]).filter(item => '#text' in item).map(item => item['#text']).join('') : '';
}

function setText(children: XmlNode[], tag: string, value: string | number | undefined) {
    const old = nodes(children, tag);

    if (old.length > 1) {
        throw new Error('Duplicate native XML fields require cleanup');
    }

    if (value === undefined) {
        old.forEach(node => children.splice(children.indexOf(node), 1));
    } else {
        const node = child(children, tag);

        node[tag] = [{'#text': String(value)}];
    }
}

function attrs(node: XmlNode): Record<string, string> {
    return node[':@'] ??= {};
}

function setAttrs(node: XmlNode, fields: Fields) {
    for (const [key, value] of Object.entries(fields)) {
        if (value === undefined) {
            delete attrs(node)['@_' + key];
        } else {
            attrs(node)['@_' + key] = String(value);
        }
    }
}

function renderXml(
    target: WriterTarget,
    snapshot: WriteSnapshot,
    mutations: readonly ProfileMutation[],
    options: NativeWriteOptions,
    diagnostics: ProfileDiagnostic[],
): NativeWritePatch {
    const images = snapshot.files.map(image => ({...image, decoded: decodeImage(image.data)}));
    const filezilla = target.application === 'filezilla';
    const documents = images.map(image => xml(image.decoded.text,
        filezilla ? '<?xml version="1.0"?><FileZilla3><Servers></Servers></FileZilla3>' :
            options.scope === 'project' ? '<project version="4"></project>' : '<application></application>'));
    const changes: any[] = [];
    const dirty = new Set<number>();

    for (const mutation of mutations) {
        const components = safeProfilePath(mutation.path).split('/');
        let parent: XmlNode[];
        let tag: string;
        let entry: XmlNode | undefined;
        let sshGroup = false;

        if (filezilla) {
            parent = child(child(documents[0], 'FileZilla3').FileZilla3, 'Servers').Servers;

            for (const component of components.slice(0, -1)) {
                const name = siteName(component);
                const folders = nodes(parent, 'Folder').filter(node => textOf(node).trim() === name);

                if (folders.length > 1) {
                    throw new Error('Duplicate native folders are ambiguous');
                }

                const folder = folders[0] ?? {Folder: [{'#text': name}]};

                if (!folders.length) {
                    parent.push(folder);
                }

                parent = folder.Folder;
            }

            tag = 'Server';

            const matches = nodes(parent, tag).filter(node =>
                textOf(nodes(node.Server, 'Name')[0] ?? {}) === siteName(components.at(-1)!));

            if (matches.length > 1) {
                throw new Error('Duplicate native sites are ambiguous');
            }

            entry = matches[0];
        } else {
            const scope = components[0];
            const group = components[1];
            const id = components.slice(2).join('/');

            if (scope !== (options.scope ?? 'global') || !['ssh', 'deployments'].includes(group) || !id) {
                throw new Error('JetBrains targets use global|project/ssh|deployments/<id> and the selected scope');
            }

            sshGroup = group === 'ssh';

            const document = documents[sshGroup ? 1 : 0];
            const root = child(document, options.scope === 'project' ? 'project' : 'application');
            const children = root[options.scope === 'project' ? 'project' : 'application'];
            const name = sshGroup ? 'SshConfigs' : 'WebServers';
            const matches = nodes(children, 'component').filter(node => attrs(node)['@_name'] === name);

            if (matches.length > 1) {
                throw new Error('Duplicate JetBrains components');
            }

            const component = matches[0] ?? {component: [], ':@': {'@_name': name}};

            if (!matches.length) {
                children.push(component);
            }

            if (sshGroup) {
                parent = child(component.component, 'configs').configs;
                tag = 'sshConfig';
            } else {
                const optionsNodes = nodes(component.component, 'option')
                    .filter(node => attrs(node)['@_name'] === 'servers');

                if (optionsNodes.length > 1) {
                    throw new Error('Duplicate JetBrains servers containers');
                }

                const option = optionsNodes[0] ?? {option: [], ':@': {'@_name': 'servers'}};

                if (!optionsNodes.length) {
                    component.component.push(option);
                }

                parent = option.option;
                tag = 'webServer';
            }

            const existing = nodes(parent, tag).filter(node => attrs(node)['@_id'] === id);

            if (existing.length > 1) {
                throw new Error('Duplicate JetBrains profile IDs');
            }

            entry = existing[0];
        }

        enforceMode(mutation, Boolean(entry));
        dirty.add(filezilla || !sshGroup ? 0 : 1);

        if (mutation.operation === 'delete') {
            parent.splice(parent.indexOf(entry!), 1);
            changes.push({profileId: mutation.path, operation: 'delete', fields: ['profile']});

            continue;
        }

        const connection = primary(mutation.profile!);

        if (
            connection.via?.length ||
            !['ssh', 'ftp'].includes(connection.kind) ||
            sshGroup &&
            connection.kind !== 'ssh'
        ) {
            throw new Error('XML destination cannot represent this connection or its SSH hops');
        }

        const found = Boolean(entry);

        if (!entry) {
            entry = {[tag]: []};
            parent.push(entry);
        }

        if (!filezilla && mutation.profile!.localDirectory) {
            if (!options.allowLossy) {
                throw new Error('JetBrains deployment mappings require separate native handling; review localDirectory omission');
            }

            diagnostics.push({
                code: 'omitted-field',
                severity: 'warning',
                field: 'localDirectory',
                message: 'Local deployment mappings are not copied',
            });
        }

        const key = keyPath(connection);
        const username = connection.endpoint.username ?? '';
        const anonymous = connection.authentication.some(auth => auth.type === 'anonymous');

        if (filezilla) {
            const children = entry.Server;
            const oldHost = textOf(nodes(children, 'Host')[0] ?? {});
            const oldUser = textOf(nodes(children, 'User')[0] ?? {});
            const oldKey = textOf(nodes(children, 'Keyfile')[0] ?? {});
            const oldLogon = textOf(nodes(children, 'Logontype')[0] ?? {});
            const preservePassword = oldHost === connection.endpoint.host && oldUser === username &&
                Number(textOf(nodes(children, 'Port')[0] ?? {})) === connection.endpoint.port &&
                oldKey === key && !key && !anonymous && oldLogon === '1';
            const protocol = connection.kind === 'ssh' ? 1 : connection.kind === 'ftp' ?
                connection.tls === 'implicit' ? 3 : connection.tls === 'explicit' ? 4 :
                    connection.tls === 'optional' ? 0 : 6 : -1;
            const fields: Fields = {
                Name: siteName(components.at(-1)!),
                Host: connection.endpoint.host,
                Port: connection.endpoint.port,
                Protocol: protocol,
                User: username,
                Logontype: anonymous ? 0 : key ? 5 : preservePassword ? 1 : 2,
                Keyfile: key || undefined,
                LocalDir: mutation.profile!.localDirectory?.value ?? '',
            };

            if (!preservePassword) {
                setText(children, 'Pass', undefined);
            }

            if ('remoteDirectory' in connection && connection.remoteDirectory) {
                const remote = connection.remoteDirectory;

                if (!remote.startsWith('/')) {
                    throw new Error('FileZilla writer supports absolute POSIX remote paths only');
                }

                const segments = remote.split('/').filter(Boolean);

                fields.RemoteDir = '1 0' + segments.map(segment => ' ' + segment.length + ' ' + segment).join('');
            } else {
                fields.RemoteDir = '';
            }

            Object.entries(fields).forEach(([name, value]) => setText(children, name, value));
            changes.push({
                profileId: mutation.path,
                operation: found ? 'update' : 'create',
                fields: [...Object.keys(fields), ...(preservePassword ? [] : ['Pass (cleared)'])],
            });
        } else {
            const id = components.slice(2).join('/');
            const transfer = sshGroup ? entry : child(entry.webServer, 'fileTransfer');
            const attributes = attrs(transfer);
            const linked = attributes['@_sshConfigId'];

            if (!sshGroup && linked) {
                // Detach the selected deployment; never mutate shared SSH configs used by other servers.
                delete attributes['@_sshConfigId'];
            }

            if (connection.kind === 'ftp' && connection.tls !== 'none' && connection.tls !== 'optional') {
                throw new Error('JetBrains deployment TLS detail cannot be represented losslessly');
            }

            const fields: Fields = {
                host: connection.endpoint.host,
                port: connection.endpoint.port,
                username,
                authType: anonymous ? undefined : key ? 'KEY_PAIR' :
                    connection.authentication.some(auth => auth.type === 'agent') ? 'OPEN_SSH' : 'PASSWORD',
                keyPath: key || undefined,
                storePassword: 'false',
                storePassphrase: 'false',
                anonymous: anonymous ? 'true' : 'false',
            };

            setAttrs(entry, {id, name: mutation.profile!.name});

            if (!sshGroup) {
                Object.assign(fields, {
                    accessType: connection.kind === 'ssh' ? 'SFTP' : connection.protocol.toUpperCase(),
                    rootFolder: 'remoteDirectory' in connection ? connection.remoteDirectory ?? '' : '',
                });
            } else if ('remoteDirectory' in connection && connection.remoteDirectory) {
                if (!options.allowLossy) {
                    throw new Error('Standalone SSH settings cannot represent a remote directory');
                }

                diagnostics.push({
                    code: 'omitted-field',
                    severity: 'warning',
                    field: 'remoteDirectory',
                    message: 'Remote directory is omitted from standalone SSH settings',
                });
            }

            // Remove legacy auth aliases which would otherwise override the new auth declaration.
            for (const name of [
                'USE_KEY_PAIR',
                'useKeyPair',
                'USE_AUTH_AGENT',
                'authAgent',
                'PRIVATE_KEY_FILE',
                'privateKey',
                'useOpenSSHConfig',
                'USE_OPENSSH_CONFIG',
                'password',
                'passphrase',
            ]) {
                delete attributes['@_' + name];
            }

            setAttrs(transfer, fields);
            changes.push({
                profileId: mutation.path,
                operation: found ? 'update' : 'create',
                fields: Object.keys(fields),
            });
        }
    }

    return {
        files: images.flatMap((image, index) => {
            if (!dirty.has(index)) {
                return [];
            }

            const result = builder.build(documents[index]);

            if (XMLValidator.validate(result) !== true) {
                throw new Error('Generated native XML failed validation');
            }

            return result === image.decoded.text ? [] : [{path: image.path, data: image.decoded.encode(result)}];
        }),
        registry: [],
        changes,
        diagnostics,
    };
}

function renderOpenSsh(
    target: WriterTarget,
    snapshot: WriteSnapshot,
    mutations: readonly ProfileMutation[],
    options: NativeWriteOptions,
    diagnostics: ProfileDiagnostic[],
): NativeWritePatch {
    const image = snapshot.files[0];
    const decoded = decodeImage(image.data);
    let text = decoded.text;
    const changes: any[] = [];
    const quote = (value: string) => '"' + safeScalar(value, 'SSH value').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';

    for (const mutation of mutations) {
        const alias = safeProfilePath(mutation.path);

        if (!/^[a-z\d_.-]+$/i.test(alias)) {
            throw new Error('OpenSSH destination requires a concrete literal host alias');
        }

        const start = '# Portline profile ' + alias + '\n';
        const finish = '# End Portline profile ' + alias + '\nHost *\n';
        const index = text.indexOf(start);
        const end = index < 0 ? -1 : text.indexOf(finish, index + start.length);

        if (index >= 0 && (end < 0 || text.indexOf(start, index + start.length) >= 0)) {
            throw new Error('Malformed or duplicate Portline SSH block');
        }

        const native = index < 0 && text.split(/\r?\n/).some(line => {
            const match = /^\s*Host\s+(.+?)(?:\s+#.*)?$/i.exec(line);

            return match?.[1].split(/\s+/).some(name => name.toLowerCase() === alias.toLowerCase());
        });

        if (native) {
            throw new Error('Existing unmanaged OpenSSH aliases require explicit migration; shared Host blocks are not rewritten');
        }

        enforceMode(mutation, index >= 0);

        if (mutation.operation === 'delete') {
            text = text.slice(0, index) + text.slice(end + finish.length);
        } else {
            const profile = mutation.profile!;
            const connection = primary(profile);

            if (connection.kind !== 'ssh' || connection.via?.length) {
                throw new Error('OpenSSH writer requires a direct SSH connection');
            }

            if (
                ('remoteDirectory' in connection &&
                    connection.remoteDirectory ||
                    profile.localDirectory) &&
                    !options.allowLossy
            ) {
                throw new Error('SSH config cannot represent transfer directories; explicitly review lossy metadata');
            }

            for (const field of ['remoteDirectory', 'localDirectory']) {
                const present = field === 'localDirectory' ? profile.localDirectory :
                    'remoteDirectory' in connection && connection.remoteDirectory;

                if (present) {
                    diagnostics.push({
                        code: 'omitted-field',
                        severity: 'warning',
                        field,
                        message: 'Transfer directory is omitted from SSH configuration',
                    });
                }
            }

            const keys = connection.authentication.filter(auth => auth.type === 'private-key');

            if (keys.some(auth => auth.format === 'ppk' || /\.ppk$/i.test(auth.path?.value ?? ''))) {
                throw new Error('Convert PuTTY PPK keys to OpenSSH/PEM before using them in OpenSSH config');
            }

            const block = start + [
                'Host ' + alias,
                '    HostName ' + quote(connection.endpoint.host),
                '    Port ' + connection.endpoint.port,
                ...(connection.endpoint.username ? ['    User ' + quote(connection.endpoint.username)] : []),
                ...keys.map(auth => '    IdentityFile ' + quote(keyPath({...connection, authentication: [auth]}).replace(/%/g, '%%'))),
            ].join('\n') + '\n' + finish;

            text = index < 0 ? block + text : text.slice(0, index) + block + text.slice(end + finish.length);
        }

        changes.push({
            profileId: alias,
            operation: mutation.operation === 'delete' ? 'delete' :
                index >= 0 ? 'update' : 'create',
            fields: ['HostName', 'Port', 'User', 'IdentityFile'],
        });
    }

    return {
        files: [{path: image.path, data: decoded.encode(text)}],
        registry: [],
        changes,
        diagnostics,
    };
}
