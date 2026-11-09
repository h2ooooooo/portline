import {createInterface} from 'node:readline/promises';
import type {Readable, Writable} from 'node:stream';
import type {TrustProvider} from './index.js';

type TerminalInput = Readable & {isTTY?: boolean};
type TerminalOutput = Writable & {isTTY?: boolean};

let pending: Promise<unknown> = Promise.resolve();

/** Approval is remembered for this provider's lifetime, never written to disk. */
export function createTerminalTrustProvider(
    input: TerminalInput = process.stdin,
    output: TerminalOutput = process.stderr,
): TrustProvider | undefined {
    if (!input.isTTY || !output.isTTY) {
        return undefined;
    }

    const approved = new Map<string, string>();

    return challenge => {
        const operation = pending.catch(() => {}).then(async () => {
            challenge.abortSignal?.throwIfAborted();

            const identity = JSON.stringify([challenge.host, challenge.port]);
            const previous = approved.get(identity);

            if (previous === challenge.fingerprint) {
                return true;
            }

            const terminal = createInterface({input, output, terminal: true});
            const answer = previous ? 'replace' : 'yes';
            const description = previous ?
                `WARNING: SSH host key changed.\nPrevious: ${previous}\n` :
                'This SSH host is not yet trusted in this session.\n';

            try {
                output.write(description + `Host: ${JSON.stringify(challenge.host)}:${challenge.port}\n` +
                    `Fingerprint: ${challenge.fingerprint}\n`);

                const closed = new Promise<never>((_resolve, reject) => {
                    terminal.once('close', () => reject(new Error('SSH host approval cancelled.')));
                });
                const question = terminal.question(
                    `Type "${answer}" to ${previous ? 'replace the session approval' : 'trust this host for this session'} [no]: `,
                    {signal: challenge.abortSignal},
                );
                const response = await Promise.race([question, closed]);

                challenge.abortSignal?.throwIfAborted();

                if (response.trim().toLowerCase() !== answer) {
                    return false;
                }

                approved.set(identity, challenge.fingerprint);

                return true;
            } finally {
                terminal.close();
            }
        });

        pending = operation;

        return operation;
    };
}
