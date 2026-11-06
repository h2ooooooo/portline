import type {ConnectorCapability, ConnectorProvider, ConnectorRegistration} from '@jalsoedesign/portline-abstract';

export interface ConnectorRegistryOptions<TProfile, TProtocol> {
    protocolFor(profile: TProfile): TProtocol;
    unsupported?(protocol: TProtocol, registered: boolean): Error;
}

/** Registries are scoped to a capability; register separate factories for SFTP and tunneling. */
export class ProfileConnectorRegistry<TProfile, TProtocol = string> {
    private readonly providers = new Map<TProtocol, (profile: TProfile, options: unknown) => unknown>();

    constructor(
        private readonly options: ConnectorRegistryOptions<TProfile, TProtocol>,
        public readonly capability?: ConnectorCapability,
    ) {}

    public register<TConnector, TOptions>(
        provider: ConnectorProvider<TProfile, TConnector, TOptions, TProtocol>,
        options: {replace?: boolean} = {},
    ): ConnectorRegistration<TProfile, TConnector, TOptions> {
        const protocols = [...provider.protocols];

        if (!protocols.length || new Set(protocols).size !== protocols.length) {
            throw new TypeError('A provider must declare a non-empty unique protocol list');
        }

        for (const protocol of protocols) {
            if (this.providers.has(protocol) && !options.replace) {
                throw new TypeError(`Protocol ${String(protocol)} already has a registered provider`);
            }
        }

        const create = (profile: TProfile, supplied: unknown): TConnector => {
            const protocol = this.options.protocolFor(profile);

            if (!protocols.includes(protocol)) {
                throw this.unsupported(protocol, true);
            }

            provider.validateOptions?.(supplied);

            return provider.factory.fromProfile(profile, supplied as TOptions);
        };

        for (const protocol of protocols) {
            this.providers.set(protocol, create);
        }

        return Object.freeze({fromProfile: (profile: TProfile, supplied?: TOptions) => create(profile, supplied)});
    }

    /** Use the registration handle to retain provider-specific result and option types. */
    public fromProfile(profile: TProfile, options?: unknown): unknown {
        const protocol = this.options.protocolFor(profile);
        const provider = this.providers.get(protocol);

        if (!provider) {
            throw this.unsupported(protocol, false);
        }

        return provider(profile, options);
    }

    public protocols(): readonly TProtocol[] {
        return Object.freeze([...this.providers.keys()]);
    }

    private unsupported(protocol: TProtocol, registered: boolean): Error {
        return this.options.unsupported?.(protocol, registered) ??
            new Error(`No compatible provider for protocol ${String(protocol)}`);
    }
}
