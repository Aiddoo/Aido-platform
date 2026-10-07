import { Inject, Injectable, Logger, type OnModuleInit, Optional } from "@nestjs/common";

import {
  createAiSuggestionNotificationMessage,
  NotificationPublisher,
} from "#api/modules/notification/notification-delivery.public";
import { decodeRecord } from "#api/platform/database/database-records";
import { DatabaseService } from "#api/platform/database/database.service";
import { fromLegacyJob, type NamedJob } from "#api/platform/jobs/named-job";
import {
  JOB_RUNTIME,
  type JobData,
  type JobRuntimePort,
} from "#api/shared/application/ports/job-runtime.port";
import { toSupportedLocale } from "#api/shared/domain/locale";

import { AnalyzeAndCreateSuggestions } from "../../../application/use-cases/suggestions/analyze-and-create-suggestions.use-case.js";
import type { SuggestionDispatcher } from "../../jobs/suggestions/ai-suggestion-queue.js";
import {
  AI_SUGGESTION_LEGACY_QUEUE,
  AI_SUGGESTION_QUEUE,
  AI_SUGGESTION_WORKER_POLICY,
  type AiSuggestionJobMap,
  AiSuggestionJobName,
  AiSuggestionRuntimeJobSchema,
} from "../../jobs/suggestions/ai-suggestion-queue.js";
import { AiJobLogEvent } from "../../observability/jobs/ai-job-log.events.js";

type AiSuggestionJob = NamedJob<AiSuggestionJobMap>;
type AiSuggestionJobLike = {
  readonly name: string;
  readonly data: JobData;
};

/** AI 제안 푸시의 카피 성과를 이전 문구와 분리한다. */
const AI_SUGGESTION_NOTIFICATION_CAMPAIGN_KEY = "ai_suggestion_v2";

@Injectable()
export class SuggestionAnalysisProcessor implements OnModuleInit {
  readonly #logger = new Logger(SuggestionAnalysisProcessor.name);

  #suggestionJob?: SuggestionDispatcher;
  setSuggestionJob(job: SuggestionDispatcher) {
    this.#suggestionJob = job;
  }

  constructor(
    @Inject(AnalyzeAndCreateSuggestions) private readonly analyzeSuggestions: Pick<
      AnalyzeAndCreateSuggestions,
      "execute"
    >,
    @Inject(NotificationPublisher) private readonly notificationPublisher: Pick<
      NotificationPublisher,
      "publish"
    >,
    private readonly database: DatabaseService,
    @Optional() @Inject(JOB_RUNTIME) private readonly runtime?: JobRuntimePort,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.runtime === undefined) return;
    await this.runtime.work<AiSuggestionJob>(
      AI_SUGGESTION_QUEUE,
      async (jobs) => {
        for (const job of jobs) await this.process(job.data);
      },
      AI_SUGGESTION_WORKER_POLICY,
    );
    await this.runtime.work<JobData>(
      AI_SUGGESTION_LEGACY_QUEUE,
      async (jobs) => {
        for (const job of jobs) await this.process(fromLegacyJob<AiSuggestionJobMap>(job));
      },
      AI_SUGGESTION_WORKER_POLICY,
    );
  }

  onStalled(jobId: string): void {
    this.#logger.warn({ event: AiJobLogEvent.STALLED, queueName: AI_SUGGESTION_QUEUE, jobId });
  }

  onError(_error: Error): void {
    this.#logger.error({
      event: AiJobLogEvent.WORKER_FAILED,
      queueName: AI_SUGGESTION_QUEUE,
      errorType: "Error",
    });
  }

  onFailed(job: { readonly id?: string; readonly name?: string } | undefined, _error: Error) {
    this.#logger.error({
      event: AiJobLogEvent.FAILED,
      queueName: AI_SUGGESTION_QUEUE,
      jobId: job?.id,
      errorType: "Error",
    });
  }

  async process(untrustedJob: AiSuggestionJobLike): Promise<void> {
    const parsedJob = AiSuggestionRuntimeJobSchema.safeParse(untrustedJob);
    if (!parsedJob.success) {
      this.#logger.warn({ event: AiJobLogEvent.INVALID, queueName: AI_SUGGESTION_QUEUE });
      return;
    }
    const job = parsedJob.data;
    if (job.name === AiSuggestionJobName.DISPATCH) {
      await this.#suggestionJob?.dispatchAnalysis();
      return;
    }

    const { userId, timezone, weatherGrid } = job.data;

    this.#logger.debug({ event: AiJobLogEvent.STARTED, queueName: AI_SUGGESTION_QUEUE, userId });

    // 제안 문구(AI 생성)와 푸시 알림이 같은 언어를 쓰도록 분석 전에 locale을 조회한다
    const preference = decodeRecord(
      "UserPreference",
      await this.database.db.orm.public.UserPreference.where((row) => row.userId.eq(userId))
        .select("locale")
        .first(),
    );
    const locale = toSupportedLocale(preference?.locale);

    const createdCount = await this.analyzeSuggestions.execute(
      userId,
      timezone,
      weatherGrid,
      locale,
    );

    if (createdCount === 0) {
      this.#logger.debug({ event: AiJobLogEvent.SKIPPED, queueName: AI_SUGGESTION_QUEUE, userId });
      return;
    }

    const message = createAiSuggestionNotificationMessage({ locale });
    await this.notificationPublisher.publish({
      userId,
      type: "AI_SUGGESTION",
      purpose: "ENGAGEMENT",
      campaignKey: AI_SUGGESTION_NOTIFICATION_CAMPAIGN_KEY,
      variantId: message.variantId,
      title: message.title,
      body: message.body,
    });

    this.#logger.log({
      event: AiJobLogEvent.COMPLETED,
      queueName: AI_SUGGESTION_QUEUE,
      userId,
      createdCount,
    });
  }
}
