import { Injectable } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import {
  type SuggestionAnalysisJob,
  SuggestionAnalysisEnqueuerPort,
} from "../../application/ports/suggestion-analysis-enqueuer.port.js";
import {
  AI_SUGGESTION_QUEUE,
  type AiSuggestionAnalyzeData,
  AiSuggestionJobKey,
  AiSuggestionJobName,
} from "./ai-suggestion.queue.js";

function toQueuedJob(job: SuggestionAnalysisJob) {
  const localDate = job.localDate.toString();
  return {
    payload: {
      name: AiSuggestionJobName.ANALYZE,
      data: {
        userId: job.userId.value,
        timezone: job.timeZone,
        weatherGrid: job.weatherGrid,
        localDate,
        trigger: job.trigger,
      } satisfies AiSuggestionAnalyzeData,
    },
    idempotencyKey: AiSuggestionJobKey.analyze(job.userId.value, localDate),
  };
}

@Injectable()
export class SuggestionAnalysisQueueAdapter extends SuggestionAnalysisEnqueuerPort {
  readonly #jobQueue: JobQueuePort;

  constructor(jobQueue: JobQueuePort) {
    super();
    this.#jobQueue = jobQueue;
  }

  async enqueue(job: SuggestionAnalysisJob): Promise<void> {
    const { payload, ...options } = toQueuedJob(job);
    await this.#jobQueue.enqueue(AI_SUGGESTION_QUEUE, payload, options);
  }

  async enqueueMany(jobs: readonly SuggestionAnalysisJob[]): Promise<void> {
    if (jobs.length === 0) {
      return;
    }
    await this.#jobQueue.enqueueMany(AI_SUGGESTION_QUEUE, jobs.map(toQueuedJob));
  }
}
