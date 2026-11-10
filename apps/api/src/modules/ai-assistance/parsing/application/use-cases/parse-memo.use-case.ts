import type { ParsedMemoData } from "@aido/api";
import { sumBy } from "es-toolkit";
import { ZodError } from "zod";

import type { MeteredFeatureQuota, QuotaLedgerPort } from "#api/modules/access/access-quota.public";
import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { now } from "#api/shared/domain/date/utils/core";
import type { SupportedLocale } from "#api/shared/domain/locale";

import { describeParsingFailure } from "../../../generation/application/ai-generation-failure.mapper.js";
import {
  buildGenerationCompletedLog,
  buildGenerationFailedLog,
} from "../../../generation/application/ai-generation.log-events.js";
import { generateWithPrompt } from "../../../generation/application/messages/prompt-definition.messages.js";
import type { AiDataSharingConsentDecisionReaderPort } from "../../../generation/application/ports/ai-data-sharing-consent.reader.port.js";
import type { AiGeneratorPort } from "../../../generation/application/ports/ai-generator.port.js";
import type { UserLocalePreferenceReaderPort } from "../../../generation/application/ports/user-locale-preference.reader.port.js";
import { resolveRequestLocale } from "../../../generation/application/request-locale.reader.js";
import { buildWithinLimit } from "../../../planning/application/messages/planning-context.messages.js";
import { fingerprintRequest } from "../../../shared/domain/request-fingerprint.domain-service.js";
import { settleChargedGeneration } from "../../infrastructure/adapters/quota-charged-generation.adapter.js";
import { parseMemoPrompt } from "../messages/parse-memo-prompt.messages.js";
import type { UpcomingTodoReaderPort } from "../ports/upcoming-todo.reader.port.js";
import { type UserCategoryReaderPort } from "../ports/user-category.reader.port.js";
import { type ParseTodoMeta, toParseMeta } from "./parse-todo.use-case.js";

/** parse-todo 메타에 상한을 넘어 만들지 않은 할 일 수를 더한다. */
export interface ParseMemoMeta extends ParseTodoMeta {
  omittedTodoCount: number;
}

/** 메모 → 다중 투두 파싱 결과 (LLM 출력에 categoryId 주입). */
export interface ParseMemoResult {
  data: ParsedMemoData;
  meta: ParseMemoMeta;
  /** 이번 요청의 확정·환불을 반영한 AI_PARSE 한도·사용량. 읽지 못했으면 null이고 응답에서 빠진다 */
  featureQuota: MeteredFeatureQuota | null;
}

/**
 * 메모 내용을 다중 Todo + SubTodo 데이터로 파싱하는 입력.
 * parse-todo와 월간 사용량을 공유하는 쓰기 유스케이스다.
 */
export interface ParseMemoInput {
  content: string;
  userId: string;
  /** X-Timezone 헤더. 없으면 저장된 사용자 시간대를 쓴다. */
  timezone: string | undefined;
  categoryId: number;
  /** Accept-Language 헤더. 없으면 저장된 사용자 언어를 쓴다. */
  locale: SupportedLocale | undefined;
  /** Idempotency-Key 헤더. 출시 앱은 보내지 않아 요청마다 차감한다. */
  idempotencyKey: string | null;
  /** 앱이 연결을 끊으면 AI 호출을 멈추고 환불한다. */
  signal?: AbortSignal;
}

type ResolvedParseMemoInput = Omit<ParseMemoInput, "timezone" | "locale"> & {
  readonly timezone: string;
  readonly locale: SupportedLocale;
};

/**
 * 메모 → 다중 투두 파싱 use-case.
 *
 * parse-todo와 동일한 사용량/에러 규약을 따르되, 할 일은 합치지 않고 앞의 5개만 만들며
 * 나머지 수를 meta.omittedTodoCount로 알린다. 미지 카테고리는 요청 기본 categoryId로 대체한다.
 */
interface ParseMemoDependencies {
  readonly generator: Pick<AiGeneratorPort, "generate">;
  readonly consentReader: Pick<AiDataSharingConsentDecisionReaderPort, "findAiDataSharingConsent">;
  readonly categoryReader: Pick<UserCategoryReaderPort, "findByUserId">;
  readonly upcomingTodoReader: Pick<UpcomingTodoReaderPort, "findByUserId">;
  readonly quota: Pick<QuotaLedgerPort, "reserve" | "reopen" | "commit" | "refund" | "read">;
  readonly localePreferenceReader: Pick<UserLocalePreferenceReaderPort, "read">;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn" | "error">;
}

export class ParseMemo {
  readonly #dependencies: ParseMemoDependencies;

  constructor(dependencies: ParseMemoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ParseMemoInput): Promise<ParseMemoResult> {
    const { userId, content, categoryId, idempotencyKey } = input;
    const startTime = Date.now();

    const { timezone, locale } = await resolveRequestLocale(
      this.#dependencies.localePreferenceReader,
      userId,
      input,
    );
    const { quota } = this.#dependencies;
    const reservation = await quota.reserve({
      userId,
      feature: "AI_PARSE",
      idempotencyKey,
      ...(idempotencyKey != null && {
        requestHash: fingerprintRequest(userId, { content, categoryId }),
      }),
      reason: "parse-memo",
    });
    const { result, featureQuota } = await settleChargedGeneration(this.#dependencies, {
      // 확정 뒤 응답을 받지 못한 재시도다. 메모 결과는 서버에 남기지 않아 추가 차감 없이 다시 만든다.
      reservation: reservation.isAlreadyCommitted ? await quota.reopen(reservation) : reservation,
      userId,
      feature: "AI_PARSE",
      task: parseMemoPrompt.id,
      generate: async () => {
        const parsed = await this.#parse({ ...input, timezone, locale }, startTime);
        // 실행할 행동이 없던 메모는 사용량을 차감하지 않는다.
        return { result: parsed.result, outcome: parsed.shouldCharge ? "CHARGE" : "NO_ACTION" };
      },
    });
    return { ...result, featureQuota };
  }

  async #parse(
    input: ResolvedParseMemoInput,
    startTime: number,
  ): Promise<{
    readonly result: Omit<ParseMemoResult, "featureQuota">;
    readonly shouldCharge: boolean;
  }> {
    const { content, userId, timezone, categoryId, locale } = input;
    const definition = parseMemoPrompt;
    const at = now();

    const [userCategories, upcomingTodos] = await Promise.all([
      this.#dependencies.categoryReader.findByUserId(userId),
      this.#dependencies.upcomingTodoReader.findByUserId(userId, timezone),
    ]);
    const built = buildWithinLimit(
      definition,
      { content, timezone, now: at, categories: userCategories, upcomingTodos },
      locale,
    );
    const logBase = {
      task: definition.id,
      promptVersion: definition.version,
      userId,
    } as const;

    const { agreedVersion } =
      await this.#dependencies.consentReader.findAiDataSharingConsent(userId);
    try {
      const { value, meta } = await generateWithPrompt(
        this.#dependencies.generator,
        definition,
        built,
        {
          content,
          timezone,
          now: at,
          locale,
          ownedCategoryIds: new Set(userCategories.map((category) => category.id)),
          defaultCategoryId: categoryId,
          upcomingTodos,
        },
        { agreedConsentVersion: agreedVersion, userId, signal: input.signal },
      );
      const { parsedMemo: data, omittedTodoCount } = value;
      const charge = !value.hasNoAction;

      this.#dependencies.logger.log({
        ...buildGenerationCompletedLog(
          { ...logBase, outcome: charge ? "SUCCESS" : "NO_ACTION", quotaCharged: charge },
          meta,
        ),
        todoCount: data.todos.length,
        omittedTodoCount,
        itemCount: sumBy(data.todos, (todo) => todo.items.length),
        warnings: value.warnings,
        dateRefs: value.dateRefs,
      });
      return {
        result: {
          data,
          meta: {
            ...toParseMeta(meta, definition.version, Date.now() - startTime),
            omittedTodoCount,
          },
        },
        shouldCharge: charge,
      };
    } catch (error) {
      const failure = describeParsingFailure(error);
      this.#dependencies.logger.error({
        ...buildGenerationFailedLog({
          ...logBase,
          outcome: "FAILED",
          ...failure,
          latencyMs: Date.now() - startTime,
          quotaCharged: false,
        }),
        ...(error instanceof ZodError && {
          validationIssues: error.issues.map(({ path, code }) => ({ path, code })),
        }),
      });
      // 호출부가 예약을 환불하므로 앱이 "횟수는 차감되지 않았어요"를 보여 줄 수 있다. 환불에 실패하면 호출부가 뗀다.
      throw new ApplicationException(failure.errorCode, { charged: false });
    }
  }
}
