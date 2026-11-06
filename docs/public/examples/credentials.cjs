// credentials.cjs
const {CredentialResolver} = require('@jalsoedesign/portline-core');

async function main() {
    const reference = {
        sourceId: 'demo',
        id: 'ssh-password',
        kind: 'password',
        state: 'available',
    };
    const resolver = new CredentialResolver();
    let requests = 0;

    resolver.register('demo', {
        resolve() {
            requests++;

            return {state: 'available', value: 'synthetic-demo-password'};
        },
    });

    console.log('Provider calls before resolution: ' + requests);

    const credential = await resolver.resolve(reference);

    console.log('Credential state: ' + credential.state);
    console.log('Provider calls after resolution: ' + requests);
    console.log('Secret value omitted from output.');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
