import type { JobResult } from "pg-boss";

import type { JobBatchFailures, JobEnvelope } from "#api/shared/application/ports/job-queue.port";

// 작업 묶음 결과를 pg-boss perJobResults 모양으로 정리한다. 실패한 작업마다 onFailure로 보고한다
export type JobFailureReporter<TPayload extends object> = (
  job: JobEnvelope<TPayload>,
  error: unknown,
) => void;

export type JobSettler<TPayload extends object> = (
  jobs: readonly JobEnvelope<TPayload>[],
  onFailure: JobFailureReporter<TPayload>,
) => Promise<JobResult[]>;

export async function settleWholeBatch<TPayload extends object>(
  jobs: readonly JobEnvelope<TPayload>[],
  handler: (jobs: readonly JobEnvelope<TPayload>[]) => Promise<void>,
  onFailure: JobFailureReporter<TPayload>,
): Promise<JobResult[]> {
  try {
    await handler(jobs);
  } catch (error) {
    for (const job of jobs) {
      onFailure(job, error);
    }
    throw error;
  }
  return jobs.map(({ id }) => ({ id, status: "completed" }));
}

export async function settleBatchFailures<TPayload extends object>(
  jobs: readonly JobEnvelope<TPayload>[],
  handler: (jobs: readonly JobEnvelope<TPayload>[]) => Promise<JobBatchFailures>,
  onFailure: JobFailureReporter<TPayload>,
): Promise<JobResult[]> {
  let failures: JobBatchFailures;
  try {
    failures = await handler(jobs);
  } catch (error) {
    for (const job of jobs) {
      onFailure(job, error);
    }
    throw error;
  }
  return jobs.map((job): JobResult => {
    if (!failures.has(job.id)) {
      return { id: job.id, status: "completed" };
    }
    const error = failures.get(job.id);
    onFailure(job, error);
    return { id: job.id, status: "failed", output: error };
  });
}

export async function settleEachJob<TPayload extends object>(
  jobs: readonly JobEnvelope<TPayload>[],
  handler: (jobs: readonly JobEnvelope<TPayload>[]) => Promise<void>,
  onFailure: JobFailureReporter<TPayload>,
): Promise<JobResult[]> {
  const results: JobResult[] = [];
  for (const job of jobs) {
    try {
      await handler([job]);
      results.push({ id: job.id, status: "completed" });
    } catch (error) {
      onFailure(job, error);
      // pg-boss가 handler throw를 기록할 때와 같이 오류 객체를 실패 출력으로 남긴다
      results.push({ id: job.id, status: "failed", output: error });
    }
  }
  return results;
}
