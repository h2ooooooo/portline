import {describe, expect, it, vi} from 'vitest';
import {PassThrough} from 'node:stream';
import {createTerminalTrustProvider} from '../src/terminal-trust.js';
import type {TrustChallenge} from '../src/index.js';

const challenge = (fingerprint = 'SHA256:' + 'A'.repeat(43)): TrustChallenge => ({
    host: 'example.test',
    port: 22,
    fingerprint,
} as TrustChallenge);

function terminal() {
    const input = Object.assign(new PassThrough(), {isTTY: true});
    const output = Object.assign(new PassThrough(), {isTTY: true});
    let text = '';

    output.on('data', chunk => {
        text += String(chunk);
    });

    return {
        input,
        output,
        text: () => text,
        verify: createTerminalTrustProvider(input, output)!,
    };
}

describe('default interactive host approval', () => {
    it('never prompts when input or output is not an interactive terminal', () => {
        expect(createTerminalTrustProvider(new PassThrough(), new PassThrough())).toBeUndefined();
    });

    it('shows host and fingerprint, declines empty input, and remembers explicit session approval', async () => {
        const fixture = terminal();
        const declined = fixture.verify(challenge());

        await vi.waitFor(() => expect(fixture.text()).toContain('[no]:'));
        expect(fixture.text()).toContain('example.test');
        expect(fixture.text()).toContain(challenge().fingerprint);
        fixture.input.write('\n');
        expect(await declined).toBe(false);

        const accepted = fixture.verify(challenge());

        await vi.waitFor(() => expect(fixture.text().match(/\[no\]:/g)).toHaveLength(2));
        fixture.input.write('yes\n');
        expect(await accepted).toBe(true);

        const before = fixture.text();

        expect(await fixture.verify(challenge())).toBe(true);
        expect(fixture.text()).toBe(before);

        const changed = fixture.verify(challenge('SHA256:' + 'B'.repeat(43)));

        await vi.waitFor(() => expect(fixture.text()).toContain('key changed'));
        fixture.input.write('yes\n');
        expect(await changed).toBe(false);

        const replacement = fixture.verify(challenge('SHA256:' + 'B'.repeat(43)));

        await vi.waitFor(() => expect(fixture.text().match(/key changed/g)).toHaveLength(2));
        fixture.input.write('replace\n');
        expect(await replacement).toBe(true);
        expect(await fixture.verify(challenge('SHA256:' + 'B'.repeat(43)))).toBe(true);
    });

    it('cancels a pending prompt without retaining an approval', async () => {
        const fixture = terminal();
        const controller = new AbortController();
        const pending = fixture.verify({...challenge(), abortSignal: controller.signal});
        const rejected = expect(pending).rejects.toThrow();

        await vi.waitFor(() => expect(fixture.text()).toContain('[no]:'));
        controller.abort();
        await rejected;
    });

    it('does not hang when terminal input closes', async () => {
        const fixture = terminal();
        const pending = fixture.verify(challenge());
        const rejected = expect(pending).rejects.toThrow('cancelled');

        await vi.waitFor(() => expect(fixture.text()).toContain('[no]:'));
        fixture.input.end();
        await rejected;
    });
});
