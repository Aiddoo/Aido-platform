import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import {
  createAiSuggestionNotificationMessage,
  PublishNotificationUseCase,
} from "#api/modules/notification/notification-delivery.public";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { UserLocalePreferenceReaderPort } from "../../../generation/application/ports/user-locale-preference.reader.port.js";
import { AiJobLogEvent } from "../../../reports/infrastructure/jobs/ai-job.log-events.js";
import { AnalyzeAndCreateSuggestionsUseCase } from "../../application/use-cases/analyze-and-create-suggestions.use-case.js";
import {
  AI_SUGGESTION_QUEUE,
  type AiSuggestionAnalyzeData,
  type AiSuggestionRuntimeJob,
  AiSuggestionJobName,
} from "./ai-suggestion.queue.js";
import { SuggestionAnalysisScheduler } from "./suggestion-analysis.scheduler.js";

/** AI 제안 푸시의 카피 성과를 이전 문구와 분리한다. */
const AI_SUGGESTION_NOTIFICATION_CAMPAIGN_KEY = "ai_suggestion_v2";

@Injectable()
export class SuggestionAnalysisProcessor implements OnModuleInit {
  readonly #logger = new Logger(SuggestionAnalysisProcessor.name);

  readonly #analyzeSuggestions: Pick<AnalyzeAndCreateSuggestionsUseCase, "execute">;
  readonly #notificationPublisher: Pick<PublishNotificationUseCase, "publish">;
  readonly #localePreferenceReader: Pick<UserLocalePreferenceReaderPort, "read">;
  readonly #scheduler: Pick<SuggestionAnalysisScheduler, "dispatchAnalysis">;
  readonly #jobQueue: JobQueuePort;

  constructor(
    @Inject(AnalyzeAndCreateSuggestionsUseCase)
    analyzeSuggestions: Pick<AnalyzeAndCreateSuggestionsUseCase, "execute">,
    @Inject(PublishNotificationUseCase)
    notificationPublisher: Pick<PublishNotificationUseCase, "publish">,
    @Inject(UserLocalePreferenceReaderPort)
    localePreferenceReader: Pick<UserLocalePreferenceReaderPort, "read">,
    @Inject(SuggestionAnalysisScheduler)
    scheduler: Pick<SuggestionAnalysisScheduler, "dispatchAnalysis">,
    jobQueue: JobQueuePort,
  ) {
    this.#analyzeSuggestions = analyzeSuggestions;
    this.#notificationPublisher = notificationPublisher;
    this.#localePreferenceReader = localePreferenceReader;
    this.#scheduler = scheduler;
    this.#jobQueue = jobQueue;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(AI_SUGGESTION_QUEUE, async (jobs) => {
      for (const job of jobs) {
        await this.process(job.data);
      }
    });
  }

  async process(job: AiSuggestionRuntimeJob): Promise<void> {
    if (job.name === AiSuggestionJobName.DISPATCH) {
      await this.#scheduler.dispatchAnalysis();
      return;
    }
    await this.#analyze(job.data);
  }

  async #analyze({ userId, timezone, weatherGrid }: AiSuggestionAnalyzeData): Promise<void> {
    const queueName = AI_SUGGESTION_QUEUE.name;
    this.#logger.debug({ event: AiJobLogEvent.STARTED, queueName, userId });

    // 제안 문구(AI 생성)와 푸시 알림이 같은 언어를 쓰도록 분석 전에 locale을 조회한다
    const { locale } = await this.#localePreferenceReader.read(UserId.reconstitute(userId));
    const createdCount = await this.#analyzeSuggestions.execute({
      userId,
      timezone,
      weatherGrid,
      locale,
    });
    if (createdCount === 0) {
      this.#logger.debug({ event: AiJobLogEvent.SKIPPED, queueName, userId });
      return;
    }

    const message = createAiSuggestionNotificationMessage({ locale });
    await this.#notificationPublisher.publish({
      userId,
      type: "AI_SUGGESTION",
      purpose: "ENGAGEMENT",
      campaignKey: AI_SUGGESTION_NOTIFICATION_CAMPAIGN_KEY,
      variantId: message.variantId,
      title: message.title,
      body: message.body,
      copyKey: message.copyKey,
      copyFacts: message.copyFacts,
    });

    this.#logger.log({ event: AiJobLogEvent.COMPLETED, queueName, userId, createdCount });
  }
}
