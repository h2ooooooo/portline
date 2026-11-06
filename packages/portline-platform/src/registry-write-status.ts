import type {ProfileDiagnostic} from '@jalsoedesign/portline-abstract';

export type RegistryWriteMode = 'transactional' | 'guarded';
export interface RegistryFailure {
    readonly code?: string;
    readonly nativeCode?: number;
    readonly operation?: string;
}

export function registryDiagnostic(failure: RegistryFailure = {}): ProfileDiagnostic & RegistryFailure {
    const nativeCode = failure.nativeCode;
    const code = nativeCode === 6801 ? 'registry-resource-manager-inactive' :
        nativeCode === 5 ? 'registry-permission-denied' :
            failure.code ?? 'registry-operation-failed';
    const reason = code === 'registry-resource-manager-inactive' ?
        'Windows cannot use transactions for this registry hive; this does not prevent ordinary registry access' :
        code === 'registry-permission-denied' ? 'The current user lacks the required registry access' :
            code === 'registry-in-use' ? 'The application or a native lock is in use' :
                code === 'registry-source-changed' ? 'The registry changed after preview' :
                    code === 'registry-write-conflict' ? 'Another writer changed a value during apply' :
                        code === 'registry-operation-timeout' ? 'The guarded write stopped at its cooperative deadline' :
                            code === 'guarded-registry-batch-too-large' ? 'Split guarded registry writes into batches of at most 512 value operations' :
                                code === 'registry-caller-exited' ? 'The calling process exited; further guarded writes stopped' :
                                    code === 'unsupported-registry-kind' ? 'A modified value has a type that guarded rollback cannot restore' :
                                        code === 'guarded-delete-owner-required' ?
                                            'Guarded deletion requires the current user to own the key and have full control' :
                                            'Registry write availability could not be verified';
    const detail = [failure.operation, nativeCode ? 'Win32 ' + nativeCode : undefined].filter(Boolean).join(', ');

    return {
        code,
        severity: 'warning',
        message: reason + (detail ? ' (' + detail + ')' : ''),
        nativeCode: nativeCode || undefined,
        operation: failure.operation,
    };
}

export const guardedRegistryWarning: ProfileDiagnostic = {
    code: 'non-atomic-registry-write',
    severity: 'warning',
    message: 'Explicit guarded mode: backups, checks and conditional rollback are enabled, but other readers may see partial changes; keep applications closed throughout apply',
};

export class RegistryWriteError extends Error {
    public readonly code: string;

    public readonly nativeCode?: number;

    public readonly operation?: string;

    public readonly backupPaths: readonly string[];

    public readonly recoveryRequired: boolean;

    public constructor(result: {
        error?: RegistryFailure;
        backups?: readonly string[];
        recoveryRequired?: boolean;
    }) {
        const diagnostic = registryDiagnostic(result.error);
        const recovery = result.recoveryRequired ?
            '; rollback was incomplete or stopped to protect another writer. Close the application and review the recovery backup' : '';

        super('Registry write refused: ' + diagnostic.message + recovery);
        this.name = 'RegistryWriteError';
        this.code = diagnostic.code;
        this.nativeCode = result.error?.nativeCode || undefined;
        this.operation = result.error?.operation;
        this.backupPaths = result.backups ?? [];
        this.recoveryRequired = result.recoveryRequired ?? false;
    }
}
