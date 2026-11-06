import assert from 'node:assert/strict';
import {test} from 'node:test';
import {privateArtifactReason} from './publication-policy.mjs';

test('private assistant files are rejected at any depth and with either path separator', () => {
    for (const filename of [
        'packages/core/src/.git/notes.md',
        'packages/core/src/.ai/notes.md',
        'packages/core/src/.agents/notes.md',
        'packages/core/src/.claude/notes.md',
        'packages/core/src/.codex/notes.md',
        'packages/core/src/.junie/notes.md',
        'packages/core/src/.serena/notes.md',
        'packages/core/src/.cursor/notes.md',
        'packages/core/src/.aider/notes.md',
        'packages/core/src/.copilot/notes.md',
        'packages/core/src/.continue/notes.md',
        'packages/core/src/.windsurf/notes.md',
        'packages/core/src/.gemini/notes.md',
        'packages/core/src/.kiro/notes.md',
        'packages/core/src/.roo/notes.md',
        'packages/core/src/.trae/notes.md',
        'packages/core/src/.opencode/notes.md',
        'packages/core/src/.openai/notes.md',
        'packages/core/src/.mcp/notes.md',
        'packages/core/src/.vscode/notes.md',
        'packages/core/src/.idea/notes.md',
        'packages/core/src/.history/notes.md',
        'packages/core/src/.scratch/notes.md',
        'packages/core/src/.local-dev/notes.md',
        'packages/core/src/.site/notes.md',
        'packages/core/src/.turbo/notes.md',
        'packages/core/src/.tmp/notes.md',
        'packages/core/src/.temp/notes.md',
        'packages/core/src/node_modules/notes.md',
        'packages/core/src/dist/notes.md',
        'packages/core/src/coverage/notes.md',
        'docs/AGENT.md',
        'docs/AGENTS.md',
        'docs/CLAUDE.md',
        'docs/CLAUDE.local.md',
        'docs/GEMINI.md',
        'docs/JUNIE.md',
        'docs/CODEX.md',
        'docs/.cursorrules',
        'docs/.windsurfrules',
        'docs/.clinerules',
        'docs/.mcp.json',
        'docs/.aider.conf.yml',
        'docs/.aiderignore',
        'docs/.npmrc',
        'docs/.yarnrc',
        'docs/.pypirc',
        'docs/local-packages.json',
        'docs/credentials.json',
        'docs/secrets.json',
        'docs/id_rsa',
        'docs/id_dsa',
        'docs/id_ecdsa',
        'docs/id_ed25519',
        'docs/known_hosts',
        'docs/authorized_keys',
        'docs/agent.md',
        'packages/core/src/.CLAUDE/settings.json',
        'packages\\core\\.junie\\notes.md',
    ]) {
        assert.ok(privateArtifactReason(filename), filename);
    }
});

test('credentials, recovery files and private operator notes are rejected', () => {
    for (const filename of [
        '.env',
        '.env.production',
        'packages/core/.npmrc',
        'backup.ppk',
        'settings.xml.bak',
        'source.ts~',
        '.aider.chat.history.md',
        'RELEASE-CHECKLIST.md',
        'docs/HANDOFF.md',
        'tmp/output.json',
        'docs/reviews/private.md',
    ]) {
        assert.ok(privateArtifactReason(filename), filename);
    }
});

test('public source, documentation, workflows and synthetic fixtures remain eligible', () => {
    for (const filename of [
        'README.md',
        'LICENSE',
        'CODING_STYLE.md',
        '.gitignore',
        '.github/workflows/ci.yml',
        'scripts/publication-policy.mjs',
        'packages/core/src/index.ts',
        'docs/public/examples/fixtures/config',
        'docs/public/examples/fixtures/portable_settings.txt',
        '.env.example',
        'packages/core/.env.sample',
    ]) {
        assert.equal(privateArtifactReason(filename), undefined, filename);
    }
});

test('npm entry points remain eligible while private files under dist are rejected', () => {
    assert.equal(privateArtifactReason('dist/index.js', {allowDist: true}), undefined);
    assert.ok(privateArtifactReason('dist/.claude/settings.json', {allowDist: true}));
    assert.ok(privateArtifactReason('dist/.env.production', {allowDist: true}));
});

test('assistant configuration files and GitHub assistant prompts stay private', () => {
    for (const filename of [
        '.claude.json',
        '.envrc',
        '.clinerules/prompts.md',
        '.github/instructions/typescript.instructions.md',
        '.github/prompts/release.prompt.md',
        '.github/agents/reviewer.agent.md',
    ]) {
        assert.ok(privateArtifactReason(filename), filename);
    }
});
