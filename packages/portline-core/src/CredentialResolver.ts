import type {CredentialProvider, CredentialReference, CredentialResult} from '@jalsoedesign/portline-abstract';

/** Secret retrieval is explicit and uncached; listing profiles never invokes a provider. */
export class CredentialResolver implements CredentialProvider {
    private readonly providers = new Map<string, CredentialProvider>();

    public register(sourceId: string, provider: CredentialProvider): void {
        if (this.providers.has(sourceId)) {
            throw new TypeError(`Credential provider already registered for ${sourceId}`);
        }

        this.providers.set(sourceId, provider);
    }

    public async resolve(reference: CredentialReference): Promise<CredentialResult> {
        if (reference.state !== 'available') {
            return {state: reference.state};
        }

        const provider = this.providers.get(reference.sourceId);

        if (!provider) {
            return {state: 'unsupported'};
        }

        return provider.resolve(reference);
    }
}
