import type { ParsedMemoData } from "@aido/api";
import { sumBy } from "es-toolkit";
import { ZodError } from "zod";

import type { MeteredFeatureQuota, QuotaLedgerPort } from "#api/modules/access/access-quota.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import type { SupportedLocale } from "#api/shared/domain/locale";

import {
  generationCompletedLog,
  generationFailedLog,
} from "../../observability/generation/ai-generation-log.events.js";
import type { AiGeneratorPort } from "../../ports/generation/ai-generator.port.js";
import type { AiDataSharingConsentDecisionReaderPort } from "../../ports/parsing/ai-data-sharing-consent.reader.port.js";
import { type UserCategoryReaderPort } from "../../ports/parsing/user-category-reader.port.js";
import type { UserLocalePreferenceReaderPort } from "../../ports/parsing/user-locale-preference.reader.port.js";
import { generateWithPrompt } from "../../prompts/kit/prompt-definition.js";
import { parseMemoPrompt } from "../../prompts/parsing/parse-memo/index.js";
import {
  describeParsingFailure,
  readFeatureQuotaOrNull,
  withoutChargedClaim,
} from "../../services/parsing/ai-parsing-error-code.js";
import { resolveRequestLocale } from "../../services/parsing/resolve-request-locale.js";
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
  readonly quota: Pick<QuotaLedgerPort, "reserve" | "commit" | "refund" | "read">;
  readonly localePreferenceReader: Pick<UserLocalePreferenceReaderPort, "read">;
  readonly logger: Pick<ApplicationLogger, "log" | "warn" | "error">;
}

export class ParseMemo {
  readonly #dependencies: ParseMemoDependencies;

  constructor(dependencies: ParseMemoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ParseMemoInput): Promise<ParseMemoResult> {
    const { userId } = input;
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
      idempotencyKey: null,
      reason: "parse-memo",
    });
    let parsed: {
      readonly result: Omit<ParseMemoResult, "featureQuota">;
      readonly charge: boolean;
    };
    try {
      parsed = await this.#parse({ ...input, timezone, locale }, startTime);
    } catch (error) {
      const refunded = await quota.refund(reservation, "FAILED");
      throw refunded ? error : withoutChargedClaim(error);
    }
    // 실행할 행동이 없던 메모는 사용량을 차감하지 않는다.
    if (parsed.charge) {
      await quota.commit(reservation);
    } else {
      await quota.refund(reservation, "NO_ACTION");
    }
    const featureQuota = await readFeatureQuotaOrNull(this.#dependencies, {
      userId,
      feature: "AI_PARSE",
      task: parseMemoPrompt.id,
    });
    return { ...parsed.result, featureQuota };
  }

  async #parse(
    input: ResolvedParseMemoInput,
    startTime: number,
  ): Promise<{ readonly result: Omit<ParseMemoResult, "featureQuota">; readonly charge: boolean }> {
    const { content, userId, timezone, categoryId, locale } = input;
    const definition = parseMemoPrompt;
    const at = now();

    const userCategories = await this.#dependencies.categoryReader.findByUserId(userId);
    const built = definition.build(
      { content, timezone, now: at, categories: userCategories },
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
        },
        { agreedConsentVersion: agreedVersion, userId },
      );
      const { data, omittedTodoCount } = value;
      const charge = !value.noAction;

      this.#dependencies.logger.log({
        ...generationCompletedLog(
          { ...logBase, outcome: charge ? "SUCCESS" : "NO_ACTION", quotaCharged: charge },
          meta,
        ),
        todoCount: data.todos.length,
        omittedTodoCount,
        itemCount: sumBy(data.todos, (todo) => todo.items.length),
        warnings: value.warnings,
      });
      return {
        result: {
          data,
          meta: {
            ...toParseMeta(meta, definition.version, Date.now() - startTime),
            omittedTodoCount,
          },
        },
        charge,
      };
    } catch (error) {
      const failure = describeParsingFailure(error);
      this.#dependencies.logger.error({
        ...generationFailedLog({
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
