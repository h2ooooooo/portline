const privateDirectories = new Set([
    '.agent',
    '.clinerules',
    '.fleet',
    '.zed',
    '.run',
    '.cache',
    '.direnv',
    '.secrets',
    '.git',
    '.ai',
    '.agents',
    '.claude',
    '.codex',
    '.junie',
    '.serena',
    '.cursor',
    '.aider',
    '.copilot',
    '.continue',
    '.windsurf',
    '.gemini',
    '.kiro',
    '.roo',
    '.trae',
    '.opencode',
    '.openai',
    '.mcp',
    '.vscode',
    '.idea',
    '.history',
    '.scratch',
    '.local-dev',
    '.site',
    '.turbo',
    '.tmp',
    '.temp',
    'node_modules',
    'dist',
    'coverage',
]);
const privateNames = new Set([
    '.claude.json',
    '.claude.local.json',
    '.codex.json',
    '.junie.json',
    '.ai.json',
    '.claudeignore',
    '.envrc',
    'copilot-instructions.md',
    'agent.md',
    'agents.md',
    'claude.md',
    'claude.local.md',
    'gemini.md',
    'junie.md',
    'codex.md',
    '.cursorrules',
    '.windsurfrules',
    '.clinerules',
    '.mcp.json',
    '.aider.conf.yml',
    '.aiderignore',
    '.npmrc',
    '.yarnrc',
    '.pypirc',
    'local-packages.json',
    'credentials.json',
    'secrets.json',
    'id_rsa',
    'id_dsa',
    'id_ecdsa',
    'id_ed25519',
    'known_hosts',
    'authorized_keys',
]);

/** Private paths are rejected even when force-added to Git or selected by npm's files list. */
export function privateArtifactReason(filename, {allowDist = false} = {}) {
    const normalized = filename.replaceAll('\\', '/');
    const parts = normalized.toLowerCase().split('/');
    const basename = parts.at(-1);

    if (parts.some(part => privateDirectories.has(part) && !(allowDist && part === 'dist'))) {
        return 'local tool or generated directory';
    }

    if (/\.github\/(?:instructions|prompts|agents)\//.test(parts.join('/'))) {
        return 'assistant instructions';
    }

    if (privateNames.has(basename) || basename.startsWith('.aider')) {
        return 'private configuration or assistant instructions';
    }

    if (/^\.env(?:\..*)?$/.test(basename) && !['.env.example', '.env.sample'].includes(basename)) {
        return 'environment configuration';
    }

    if (/\.(?:tgz|log|tsbuildinfo|tmp|temp|bak|backup|orig|rej|swp|swo|pem|key|ppk|p12|pfx|jks|keystore|kdbx|pwd)$|~$/.test(basename)) {
        return 'temporary output or credential file';
    }

    if (
        /^(?:tmp|temp)\/|^docs\/(?:audit|reviews)\//.test(normalized.toLowerCase()) ||
        /^(?:handoff|progress|release-checklist).*\.md$/.test(basename)
    ) {
        return 'private operator notes or temporary directory';
    }

    return undefined;
}
