import { ID } from '@vendure/common/lib/shared-types';
import { unique } from '@vendure/common/lib/unique';

import { Job, JobBufferProcessor } from '../../job-queue';
import { ApplyCollectionFiltersJobData } from '../../service/services/collection.service';

import { UpdateIndexQueueJobData, UpdateVariantsByIdJobData, UpdateVariantsJobData } from './types';

export class CollectionJobBufferProcessor implements JobBufferProcessor<ApplyCollectionFiltersJobData> {
    readonly id = 'search-plugin-apply-collection-filters';

    collect(job: Job): boolean {
        return job.queueName === 'apply-collection-filters';
    }

    reduce(collectedJobs: Array<Job<ApplyCollectionFiltersJobData>>): Array<Job<any>> {
        const collectionIdsToUpdate = collectedJobs.reduce((result, job) => {
            return [...result, ...job.data.collectionIds];
        }, [] as ID[]);

        const referenceJob = collectedJobs[0];
        const batchedCollectionJob = new Job<ApplyCollectionFiltersJobData>({
            ...referenceJob,
            id: undefined,
            data: {
                collectionIds: unique(collectionIdsToUpdate),
                ctx: referenceJob.data.ctx,
                applyToChangedVariantsOnly: referenceJob.data.applyToChangedVariantsOnly,
            },
        });

        return [batchedCollectionJob];
    }
}
