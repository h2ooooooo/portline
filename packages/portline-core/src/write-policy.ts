import type {ProfileWriteInspection, ProfileWritePlan} from '@jalsoedesign/portline-abstract';

/** Native adapters call this after a fresh inspection; it does not acquire a lock or perform a write. */
export function assertProfileWriteAllowed(inspection: ProfileWriteInspection, plan: ProfileWritePlan): void {
    if (
        inspection.source.id !== plan.sourceId ||
        !inspection.revision ||
        inspection.revision !== plan.expectedRevision
    ) {
        throw new Error('The target source changed; create a new write preview');
    }

    if (inspection.lock !== 'unlocked' || inspection.application !== 'closed') {
        throw new Error('The target source is locked, in use, or its write availability is unknown');
    }
}
