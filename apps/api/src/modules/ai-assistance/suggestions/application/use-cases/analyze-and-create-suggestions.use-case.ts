import { AI_SUGGESTION_LIMITS } from "@aido/api/vocabulary";
import { orderBy } from "es-toolkit";
import { match } from "ts-pattern";

import type { EntitlementReaderPort } from "#api/modules/access/feature-grants/access-feature-grants.public";
import type { UserMutationLockPort } from "#api/modules/identity/users/identity-users.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import type { SupportedLocale } from "#api/shared/domain/locale";

import {
  type AiFailureKind,
  AiGenerationError,
  isTransientAiFailure,
  isWithheldAiFailure,
} from "../../../generation/application/ai-generation.errors.js";
import {
  buildGenerationCompletedLog,
  buildGenerationFailedLog,
  toGenerationFailure,
} from "../../../generation/application/ai-generation.log-events.js";
import { generateWithPrompt } from "../../../generation/application/messages/prompt-definition.messages.js";
import type { AiGeneratorPort } from "../../../generation/application/ports/ai-generator.port.js";
import type {
  ScheduledAiConsent,
  ScheduledAiConsentReader,
} from "../../../generation/application/scheduled-ai-consent.reader.js";
import { resolveSuggestedCategoryId } from "../../domain/category-resolver.domain-service.js";
import {
  type SuggestionAnalysisResult,
  SuggestionAnalysisRun,
} from "../../domain/suggestion-analysis-run.entity.js";
import { hasEnoughRecentTodos } from "../../domain/suggestion-analysis-state.domain-service.js";
import type {
  SuggestionAnalysisOutcome,
  SuggestionAnalysisTrigger,
} from "../../domain/suggestion-analysis.constants.js";
import {
  buildSuggestionCandidates,
  suggestionModeOf,
} from "../../domain/suggestion-candidates.domain-service.js";
import { SuggestionEvidence } from "../../domain/suggestion-evidence.vo.js";
import { Suggestion } from "../../domain/suggestion.aggregate.js";
import {
  type DetectedPattern,
  SUGGESTION_ANALYSIS_PERIOD_DAYS,
} from "../../domain/suggestion.constants.js";
import { AiSuggestionLogEvent } from "../ai-suggestion.log-events.js";
import { suggestionPromptFor } from "../messages/suggestion-prompt.messages.js";
import type { SuggestionAnalysisRunRepositoryPort } from "../ports/suggestion-analysis-run.repository.port.js";
import type { SuggestionRepositoryPort } from "../ports/suggestion.repository.port.js";
import type { SuggestionContext } from "../read-models/suggestion-context.read-model.js";
import type { SuggestionContextReader } from "../suggestion-context.reader.js";
import { SuggestionLockKeys } from "../suggestions.lock-keys.js";

interface AnalyzeAndCreateSuggestionsDependencies {
  readonly repository: Pick<
    SuggestionRepositoryPort,
    "deletePendingByUserId" | "deleteExpiredByUserId" | "nextIds" | "saveMany"
  >;
  readonly runs: Pick<SuggestionAnalysisRunRepositoryPort, "findByUserId" | "save">;
  readonly generator: Pick<AiGeneratorPort, "generate">;
  readonly scheduledAiConsent: Pick<ScheduledAiConsentReader, "find">;
  readonly clock: ClockPort;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly mutationLock: Pick<MutationLockPort, "acquire">;
  readonly contextBuilder: Pick<SuggestionContextReader, "build">;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "canInTransaction">;
  readonly userMutationLock: Pick<UserMutationLockPort, "lockById">;
}

export interface AnalyzeAndCreateSuggestionsCommand {
  readonly userId: string;
  readonly timezone: string;
  readonly locale?: SupportedLocale;
  readonly localDate: Temporal.PlainDate;
  readonly trigger: SuggestionAnalysisTrigger;
  readonly isFinalAttempt: boolean;
}

export interface AnalyzeAndCreateSuggestionsResult extends SuggestionAnalysisResult {
  readonly trigger: SuggestionAnalysisTrigger;
}

type GenerationOutcome =
  | { readonly patterns: DetectedPattern[] }
  | { readonly outcome: SuggestionAnalysisOutcome };

export class AnalyzeAndCreateSuggestionsUseCase {
  readonly #dependencies: AnalyzeAndCreateSuggestionsDependencies;

  constructor(dependencies: AnalyzeAndCreateSuggestionsDependencies) {
    this.#dependencies = dependencies;
  }

  // 커밋 뒤 worker가 죽거나 알림이 실패해 같은 job이 다시 오면 null로 끝내 분석·제안 교체·푸시를 되풀이하지 않는다
  async execute(
    command: AnalyzeAndCreateSuggestionsCommand,
  ): Promise<AnalyzeAndCreateSuggestionsResult | null> {
    const owner = UserId.reconstitute(command.userId);
    const run = await this.#start(owner, command, this.#dependencies.clock.now());
    if (run.isFinishedOn(command.localDate)) {
      return null;
    }
    const queueWait = run.queueWait;
    const result = await this.#analyze(owner, command).catch(async (error: unknown) => {
      // 일시 오류는 job이 다시 시도하므로 마지막 시도만 실패로 남긴다
      if (command.isFinalAttempt) {
        this.#logFinished(command, await this.#skip(owner, command, "FAILED", null), queueWait);
      }
      throw error;
    });
    this.#logFinished(command, result, queueWait);
    return { ...result, trigger: command.trigger };
  }

  async #start(
    owner: UserId,
    command: AnalyzeAndCreateSuggestionsCommand,
    now: Temporal.Instant,
  ): Promise<SuggestionAnalysisRun> {
    return this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([SuggestionLockKeys.analysisRun(owner)]);
      // 1.16.0 배포 전에 쌓인 job은 실행 기록 없이 온다. 1.17.0에서 지운다(compatibility.md)
      const run =
        (await this.#dependencies.runs.findByUserId(owner)) ??
        SuggestionAnalysisRun.create({
          userId: owner,
          localDate: command.localDate,
          trigger: command.trigger,
          now,
        });
      if (run.start(command.localDate, now)) {
        await this.#dependencies.runs.save(run);
      }
      return run;
    });
  }

  async #analyze(
    owner: UserId,
    command: AnalyzeAndCreateSuggestionsCommand,
  ): Promise<SuggestionAnalysisResult> {
    if (!(await this.#dependencies.entitlementReader.canInTransaction(owner, "AI_SUGGESTION"))) {
      return this.#skip(owner, command, "NOT_PREMIUM", null);
    }
    const consent = await this.#dependencies.scheduledAiConsent.find(command.userId);
    if (!consent.allowed) {
      return this.#skip(owner, command, "CONSENT_MISSING", null);
    }
    const context = await this.#dependencies.contextBuilder.build(command.userId, command.timezone);
    const recentTodoCount = context.todos.length;
    if (!hasEnoughRecentTodos(recentTodoCount)) {
      return this.#skip(owner, command, "NO_RECENT_TODOS", recentTodoCount);
    }
    const candidates = buildSuggestionCandidates(
      context.todos,
      suggestionModeOf(recentTodoCount),
      context.repeatingTitles,
    );
    if (candidates.length === 0) {
      return this.#skip(owner, command, "NO_PATTERN_FOUND", recentTodoCount);
    }
    const generation = await this.#generate(command, context, consent);
    if ("outcome" in generation) {
      return this.#skip(owner, command, generation.outcome, recentTodoCount);
    }
    if (generation.patterns.length === 0) {
      return this.#skip(owner, command, "NO_PATTERN_FOUND", recentTodoCount);
    }
    return this.#save(owner, command, context, generation.patterns);
  }

  async #generate(
    command: AnalyzeAndCreateSuggestionsCommand,
    context: SuggestionContext,
    consent: ScheduledAiConsent,
  ): Promise<GenerationOutcome> {
    const { userId, locale = "ko" } = command;
    const definition = suggestionPromptFor(command.trigger);
    const logBase = {
      task: definition.id,
      promptVersion: definition.version,
      userId,
      quotaCharged: false,
    } as const;
    const startedAt = this.#dependencies.clock.now().epochMilliseconds;
    return generateWithPrompt(
      this.#dependencies.generator,
      definition,
      definition.build(context, locale),
      { context, locale },
      { agreedConsentVersion: consent.agreedVersion, userId },
    ).then(
      (generation) => {
        this.#dependencies.logger.log(
          buildGenerationCompletedLog({ ...logBase, outcome: "SUCCESS" }, generation.meta),
        );
        return { patterns: generation.value };
      },
      (error: unknown) => {
        if (error instanceof AiGenerationError && isWithheldAiFailure(error.kind)) {
          return { outcome: toAnalysisOutcome(error.kind) };
        }
        const failure = toGenerationFailure(error);
        const settled = error instanceof AiGenerationError && !isTransientAiFailure(error.kind);
        this.#dependencies.logger.warn(
          buildGenerationFailedLog({
            ...logBase,
            outcome: settled || command.isFinalAttempt ? "FAILED" : "RETRYING",
            ...failure,
            latencyMs: this.#dependencies.clock.now().epochMilliseconds - startedAt,
          }),
        );
        // 일시 장애만 잡 재시도로 넘긴다. 출력 오류·차단·잘림은 다시 불러도 같은 비용으로 같게 실패한다.
        if (!settled) {
          throw error;
        }
        return { outcome: toAnalysisOutcome(failure.errorType) };
      },
    );
  }

  async #save(
    owner: UserId,
    command: AnalyzeAndCreateSuggestionsCommand,
    context: SuggestionContext,
    patterns: readonly DetectedPattern[],
  ): Promise<SuggestionAnalysisResult> {
    const now = this.#dependencies.clock.now();
    const expiresAt = now.add({ hours: AI_SUGGESTION_LIMITS.SUGGESTION_EXPIRY_DAYS * 24 });
    const recentTodoCount = context.todos.length;
    const limitedPatterns = orderBy(patterns, ["confidence"], ["desc"]).slice(
      0,
      AI_SUGGESTION_LIMITS.MAX_SUGGESTIONS_PER_USER,
    );

    return this.#dependencies.unitOfWork.run(async () => {
      const { userMutationLock, entitlementReader, repository } = this.#dependencies;
      if (
        !(await userMutationLock.lockById(owner)) ||
        !(await entitlementReader.canInTransaction(owner, "AI_SUGGESTION"))
      ) {
        return this.#finish(owner, command, {
          outcome: "NOT_PREMIUM",
          recentTodoCount,
          createdSuggestionCount: 0,
        });
      }
      await repository.deletePendingByUserId(owner);
      await repository.deleteExpiredByUserId(owner, now);

      const ids = await repository.nextIds(limitedPatterns.length);
      const suggestions = limitedPatterns.flatMap((pattern, index) => {
        const id = ids[index];
        return id == null
          ? []
          : [
              Suggestion.create({
                id,
                userId: owner,
                title: pattern.title,
                daysOfWeek: pattern.daysOfWeek,
                scheduledTime: pattern.scheduledTime,
                confidence: pattern.confidence,
                reason: pattern.reason,
                matchedTodos: pattern.matchedTitles,
                expiresAt,
                suggestedCategoryId: resolveSuggestedCategoryId(
                  pattern.title,
                  pattern.matchedTitles,
                  context.todos,
                ),
                evidence: SuggestionEvidence.create({
                  recordedCount: pattern.recordedCount,
                  completedCount: pattern.completedCount,
                  periodDays: SUGGESTION_ANALYSIS_PERIOD_DAYS,
                }),
                now,
              }),
            ];
      });
      await repository.saveMany(suggestions);
      return this.#finish(owner, command, {
        outcome: "SUGGESTIONS_CREATED",
        recentTodoCount,
        createdSuggestionCount: suggestions.length,
      });
    });
  }

  #skip(
    owner: UserId,
    command: AnalyzeAndCreateSuggestionsCommand,
    outcome: SuggestionAnalysisOutcome,
    recentTodoCount: number | null,
  ): Promise<SuggestionAnalysisResult> {
    return this.#dependencies.unitOfWork.run(() =>
      this.#finish(owner, command, { outcome, recentTodoCount, createdSuggestionCount: 0 }),
    );
  }

  // 활성 UoW 안에서 부른다. 사용자 잠금을 잡았다면 그 뒤에 장부 잠금을 잡는다
  async #finish(
    owner: UserId,
    command: AnalyzeAndCreateSuggestionsCommand,
    result: SuggestionAnalysisResult,
  ): Promise<SuggestionAnalysisResult> {
    await this.#dependencies.mutationLock.acquire([SuggestionLockKeys.analysisRun(owner)]);
    const run = await this.#dependencies.runs.findByUserId(owner);
    if (run != null && run.finish(command.localDate, result, this.#dependencies.clock.now())) {
      await this.#dependencies.runs.save(run);
    }
    return result;
  }

  // 처리 시간은 processor의 ai.job.completed가 남기고 여기서는 실행 기록에 남는 결과만 남긴다
  #logFinished(
    command: AnalyzeAndCreateSuggestionsCommand,
    result: SuggestionAnalysisResult,
    queueWait: Temporal.Duration | null,
  ): void {
    const entry = {
      event: AiSuggestionLogEvent.ANALYSIS_FINISHED,
      userId: command.userId,
      trigger: command.trigger,
      outcome: result.outcome,
      recentTodoCount: result.recentTodoCount,
      createdSuggestionCount: result.createdSuggestionCount,
      queueWaitMs: queueWait?.total("milliseconds") ?? null,
    };
    if (result.outcome === "FAILED") {
      this.#dependencies.logger.warn(entry);
      return;
    }
    this.#dependencies.logger.log(entry);
  }
}

function toAnalysisOutcome(kind: AiFailureKind): SuggestionAnalysisOutcome {
  return match(kind)
    .returnType<SuggestionAnalysisOutcome>()
    .with("UNAVAILABLE", "HALTED", () => "AI_UNAVAILABLE")
    .with("USER_SPEND_LIMITED", () => "SPEND_LIMIT_REACHED")
    .with(
      "QUOTA_EXHAUSTED",
      "AUTH",
      "RATE_LIMITED",
      "OVERLOADED",
      "UPSTREAM",
      "TIMEOUT",
      "BAD_REQUEST",
      "BLOCKED",
      "TRUNCATED",
      "INVALID_OUTPUT",
      "CIRCUIT_OPEN",
      () => "FAILED",
    )
    .exhaustive();
}
