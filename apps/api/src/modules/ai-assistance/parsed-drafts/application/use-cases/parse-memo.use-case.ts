import { sumBy } from "es-toolkit";
import { ZodError } from "zod";

import type { QuotaLedgerPort } from "#api/modules/access/quota-charges/access-quota-charges.public";
import type { AiDataSharingConsentReaderPort } from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import type { SupportedLocale } from "#api/shared/domain/locale";
import { instantToDate } from "#api/shared/domain/time/instant";

import { buildWithinLimit } from "../../../action-plan-drafts/application/messages/planning-context.messages.js";
import { describeGenerationFailure } from "../../../ai-generations/application/ai-generation-failure.mapper.js";
import { generationFailed } from "../../../ai-generations/application/ai-generations.errors.js";
import {
  buildGenerationCompletedLog,
  buildGenerationFailedLog,
} from "../../../ai-generations/application/ai-generations.log-events.js";
import { generateWithPrompt } from "../../../ai-generations/application/messages/prompt-definition.messages.js";
import type { AiGeneratorPort } from "../../../ai-generations/application/ports/ai-generator.port.js";
import type { UserLocalePreferenceReaderPort } from "../../../ai-generations/application/ports/user-locale-preference.reader.port.js";
import { resolveRequestLocale } from "../../../ai-generations/application/request-locale.reader.js";
import { fingerprintRequest } from "../../../shared/domain/request-fingerprint.domain-service.js";
import type { ParsedMemoTodo } from "../../domain/parsed-drafts.constants.js";
import {
  type ParseMemoNormalizeContext,
  parseMemoPrompt,
} from "../messages/parse-memo-prompt.messages.js";
import { toParseMeta } from "../parse-meta.mapper.js";
import type { ChargedGenerationPort } from "../ports/charged-generation.port.js";
import type { UpcomingTodoReaderPort } from "../ports/upcoming-todo.reader.port.js";
import type { UserCategoryReaderPort } from "../ports/user-category.reader.port.js";
import type { ParsedDraftReadModel } from "../read-models/parsed-draft.read-model.js";

/** 메모 내용을 여러 할 일과 하위 할 일로 파싱하는 입력. parse-todo와 월간 사용량을 함께 쓴다. */
export interface ParseMemoCommand {
  readonly content: string;
  readonly userId: string;
  /** X-Timezone 헤더. 없으면 저장된 사용자 시간대를 쓴다. */
  readonly timezone: string | undefined;
  readonly categoryId: number;
  /** Accept-Language 헤더. 없으면 저장된 사용자 언어를 쓴다. */
  readonly locale: SupportedLocale | undefined;
  /** Idempotency-Key 헤더. 출시 앱은 보내지 않아 요청마다 차감한다. */
  readonly idempotencyKey: string | null;
  /** 앱이 연결을 끊으면 AI 호출을 멈추고 환불한다. */
  readonly signal?: AbortSignal;
}

interface ResolvedParseMemoCommand extends ParseMemoCommand {
  readonly timezone: string;
  readonly locale: SupportedLocale;
}

type ParsedMemo = Omit<ParsedDraftReadModel<ParsedMemoTodo>, "featureQuota">;

interface ParseMemoDependencies {
  readonly generator: Pick<AiGeneratorPort, "generate">;
  readonly consentReader: Pick<AiDataSharingConsentReaderPort, "findAiDataSharingConsent">;
  readonly categoryReader: Pick<UserCategoryReaderPort, "findByUserId">;
  readonly upcomingTodoReader: Pick<UpcomingTodoReaderPort, "findByUserId">;
  readonly quota: Pick<QuotaLedgerPort, "reserve" | "reopen">;
  readonly chargedGeneration: Pick<ChargedGenerationPort, "settle">;
  readonly clock: ClockPort;
  readonly localePreferenceReader: Pick<UserLocalePreferenceReaderPort, "read">;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn" | "error">;
}

/**
 * parse-todo와 같은 사용량·오류 규약을 따르되, 할 일은 합치지 않고 앞의 5개만 만들며 나머지 수를
 * meta.omittedTodoCount로 알린다. 미지 카테고리는 요청 기본 categoryId로 대체한다.
 */
export class ParseMemoUseCase {
  readonly #dependencies: ParseMemoDependencies;

  constructor(dependencies: ParseMemoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: ParseMemoCommand): Promise<ParsedDraftReadModel<ParsedMemoTodo>> {
    const { userId, content, categoryId, idempotencyKey } = command;
    const owner = UserId.reconstitute(userId);
    const startTime = this.#dependencies.clock.now().epochMilliseconds;

    const { timezone, locale } = await resolveRequestLocale(
      this.#dependencies.localePreferenceReader,
      owner,
      command,
    );
    const { quota } = this.#dependencies;
    const reservation = await quota.reserve({
      userId: owner,
      feature: "AI_PARSE",
      idempotencyKey,
      ...(idempotencyKey != null && {
        requestHash: fingerprintRequest(userId, { content, categoryId }),
      }),
      reason: "parse-memo",
    });
    const { result, featureQuota } = await this.#dependencies.chargedGeneration.settle({
      // 확정 뒤 응답을 받지 못한 재시도다. 메모 결과는 서버에 남기지 않아 추가 차감 없이 다시 만든다.
      reservation: reservation.isAlreadyCommitted ? await quota.reopen(reservation) : reservation,
      userId: owner,
      feature: "AI_PARSE",
      task: parseMemoPrompt.id,
      generate: async () => {
        const parsed = await this.#parse({ ...command, timezone, locale }, startTime);
        // 실행할 행동이 없던 메모는 사용량을 차감하지 않는다.
        return { result: parsed, outcome: parsed.draft.hasAction() ? "CHARGE" : "NO_ACTION" };
      },
    });
    return { ...result, featureQuota };
  }

  async #parse(command: ResolvedParseMemoCommand, startTime: number): Promise<ParsedMemo> {
    const { content, userId, timezone, categoryId, locale } = command;
    const owner = UserId.reconstitute(userId);
    const definition = parseMemoPrompt;
    const at = instantToDate(this.#dependencies.clock.now());

    const [userCategories, upcomingTodos] = await Promise.all([
      this.#dependencies.categoryReader.findByUserId(owner),
      this.#dependencies.upcomingTodoReader.findByUserId(owner, timezone),
    ]);
    const built = buildWithinLimit(
      definition,
      { content, timezone, now: at, categories: userCategories, upcomingTodos },
      locale,
    );
    const context: ParseMemoNormalizeContext = {
      content,
      timezone,
      now: at,
      locale,
      ownedCategoryIds: new Set(userCategories.map((category) => category.id)),
      defaultCategoryId: categoryId,
      upcomingTodos,
    };
    const logBase = { task: definition.id, promptVersion: definition.version, userId } as const;

    const consent = await this.#dependencies.consentReader.findAiDataSharingConsent(owner);
    const { agreedVersion } = consent.status();
    try {
      const { value, meta } = await generateWithPrompt(this.#dependencies.generator, definition, {
        built,
        context,
        agreedConsentVersion: agreedVersion,
        userId: owner,
        signal: command.signal,
      });
      const { draft } = value;
      const charge = draft.hasAction();
      this.#dependencies.logger.log({
        ...buildGenerationCompletedLog(
          { ...logBase, outcome: charge ? "SUCCESS" : "NO_ACTION", quotaCharged: charge },
          meta,
        ),
        todoCount: draft.todos.length,
        omittedTodoCount: draft.omittedTodoCount,
        itemCount: sumBy(draft.todos, (todo) => todo.items.length),
        warnings: value.warnings,
        dateRefs: value.dateRefs,
      });
      const processingTimeMs = this.#dependencies.clock.now().epochMilliseconds - startTime;
      return {
        draft,
        meta: toParseMeta(meta, { promptVersion: definition.version, processingTimeMs }),
      };
    } catch (error) {
      this.#logFailure(error, { ...logBase, latencyMs: this.#elapsedSince(startTime) });
      throw generationFailed(describeGenerationFailure(error).errorCode, error);
    }
  }

  #logFailure(
    error: unknown,
    base: {
      readonly task: "parse-memo";
      readonly promptVersion: string;
      readonly userId: string;
      readonly latencyMs: number;
    },
  ): void {
    this.#dependencies.logger.error({
      ...buildGenerationFailedLog({
        ...base,
        outcome: "FAILED",
        ...describeGenerationFailure(error),
        quotaCharged: false,
      }),
      ...(error instanceof ZodError && {
        validationIssues: error.issues.map(({ path, code }) => ({ path, code })),
      }),
    });
  }

  #elapsedSince(startTime: number): number {
    return this.#dependencies.clock.now().epochMilliseconds - startTime;
  }
}
