import type { SupportedLocale } from "@aido/api/vocabulary";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import {
  createAiSuggestionNotificationMessage,
  PublishNotificationUseCase,
} from "#api/modules/notification/notifications/notification-notifications.public";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { AiGenerationLogEvent } from "../../../ai-generations/application/ai-generations.log-events.js";
import { UserLocalePreferenceReaderPort } from "../../../ai-generations/application/ports/user-locale-preference.reader.port.js";
import { AnalyzeAndCreateSuggestionsUseCase } from "../../application/use-cases/analyze-and-create-suggestions.use-case.js";
import {
  AI_SUGGESTION_ON_DEMAND_WORKER,
  AI_SUGGESTION_QUEUE,
  type AiSuggestionAnalyzeData,
  type AiSuggestionRuntimeJob,
  AiSuggestionJobName,
  isFinalSuggestionAttempt,
} from "./ai-suggestion.queue.js";
import { SuggestionAnalysisScheduler } from "./suggestion-analysis.scheduler.js";

/** AI 제안 푸시의 카피 성과를 이전 문구와 분리한다. */
const AI_SUGGESTION_NOTIFICATION_CAMPAIGN_KEY = "ai_suggestion_v2";

@Injectable()
export class SuggestionAnalysisProcessor implements OnModuleInit {
  readonly #logger = new Logger(SuggestionAnalysisProcessor.name);

  readonly #analyzeSuggestions: Pick<AnalyzeAndCreateSuggestionsUseCase, "execute">;
  readonly #notificationPublisher: Pick<PublishNotificationUseCase, "execute">;
  readonly #localePreferenceReader: Pick<UserLocalePreferenceReaderPort, "read">;
  readonly #scheduler: Pick<SuggestionAnalysisScheduler, "dispatchAnalysis">;
  readonly #jobQueue: JobQueuePort;
  readonly #clock: ClockPort;

  constructor(
    @Inject(AnalyzeAndCreateSuggestionsUseCase)
    analyzeSuggestions: Pick<AnalyzeAndCreateSuggestionsUseCase, "execute">,
    @Inject(PublishNotificationUseCase)
    notificationPublisher: Pick<PublishNotificationUseCase, "execute">,
    @Inject(UserLocalePreferenceReaderPort)
    localePreferenceReader: Pick<UserLocalePreferenceReaderPort, "read">,
    @Inject(SuggestionAnalysisScheduler)
    scheduler: Pick<SuggestionAnalysisScheduler, "dispatchAnalysis">,
    jobQueue: JobQueuePort,
    clock: ClockPort,
  ) {
    this.#analyzeSuggestions = analyzeSuggestions;
    this.#notificationPublisher = notificationPublisher;
    this.#localePreferenceReader = localePreferenceReader;
    this.#scheduler = scheduler;
    this.#jobQueue = jobQueue;
    this.#clock = clock;
  }

  async onModuleInit(): Promise<void> {
    for (const queue of [AI_SUGGESTION_QUEUE, AI_SUGGESTION_ON_DEMAND_WORKER]) {
      await this.#jobQueue.work(queue, async (jobs) => {
        for (const job of jobs) {
          await this.process(job.data, job.attempt);
        }
      });
    }
  }

  /** attempt는 1부터 센다. 생략하면 재시도 없는 단발 실행으로 본다. */
  async process(job: AiSuggestionRuntimeJob, attempt = Number.POSITIVE_INFINITY): Promise<void> {
    if (job.name === AiSuggestionJobName.DISPATCH) {
      await this.#scheduler.dispatchAnalysis();
      return;
    }
    await this.#analyze(job.data, attempt);
  }

  async #analyze(data: AiSuggestionAnalyzeData, attempt: number): Promise<void> {
    const queueName = AI_SUGGESTION_QUEUE.name;
    const { userId, timezone } = data;
    const startedAt = this.#clock.now();
    this.#logger.debug({ event: AiGenerationLogEvent.JOB_STARTED, queueName, userId });

    // 제안 문구(AI 생성)와 푸시 알림이 같은 언어를 쓰도록 분석 전에 locale을 조회한다
    const { locale } = await this.#localePreferenceReader.read(UserId.reconstitute(userId));
    const result = await this.#analyzeSuggestions.execute({
      userId,
      timezone,
      locale,
      localDate: Temporal.PlainDate.from(data.localDate),
      trigger: data.trigger,
      isFinalAttempt: isFinalSuggestionAttempt(attempt),
    });
    if (result == null) {
      this.#logger.debug({ event: AiGenerationLogEvent.JOB_SKIPPED, queueName, userId });
      return;
    }

    // 지금 받기는 사용자가 앱에서 결과를 기다리므로 푸시·알림함을 만들지 않는다
    if (result.trigger === "SCHEDULED" && result.outcome === "SUGGESTIONS_CREATED") {
      await this.#notify(userId, locale);
    }

    this.#logger.log({
      event: AiGenerationLogEvent.JOB_COMPLETED,
      queueName,
      userId,
      trigger: result.trigger,
      durationMs: this.#clock.now().epochMilliseconds - startedAt.epochMilliseconds,
    });
  }

  async #notify(userId: string, locale: SupportedLocale): Promise<void> {
    const message = createAiSuggestionNotificationMessage({ locale });
    await this.#notificationPublisher.execute({
      userId,
      type: "AI_SUGGESTION",
      purpose: "SCHEDULED_SERVICE",
      campaignKey: AI_SUGGESTION_NOTIFICATION_CAMPAIGN_KEY,
      variantId: message.variantId,
      title: message.title,
      body: message.body,
      copyKey: message.copyKey,
      copyFacts: message.copyFacts,
    });
  }
}
