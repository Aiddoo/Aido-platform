import {
  type SuggestionAnalysisJob,
  SuggestionAnalysisEnqueuerPort,
} from "#api/modules/ai-assistance/suggestions/application/ports/suggestion-analysis-enqueuer.port";

export class RecordingSuggestionAnalysisEnqueuer extends SuggestionAnalysisEnqueuerPort {
  readonly jobs: SuggestionAnalysisJob[] = [];
  readonly batchSizes: number[] = [];

  async enqueue(job: SuggestionAnalysisJob): Promise<void> {
    this.batchSizes.push(1);
    this.jobs.push(job);
  }

  async enqueueMany(jobs: readonly SuggestionAnalysisJob[]): Promise<void> {
    this.batchSizes.push(jobs.length);
    this.jobs.push(...jobs);
  }
}
