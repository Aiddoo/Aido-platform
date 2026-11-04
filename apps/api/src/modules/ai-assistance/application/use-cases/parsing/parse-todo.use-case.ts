import type { ParsedTodoData } from "@aido/api";

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
import type { AiGenerationMeta } from "../../ports/generation/ai-generator.port.js";
import type { AiDataSharingConsentDecisionReaderPort } from "../../ports/parsing/ai-data-sharing-consent.reader.port.js";
import { type UserCategoryReaderPort } from "../../ports/parsing/user-category-reader.port.js";
import type { UserLocalePreferenceReaderPort } from "../../ports/parsing/user-locale-preference.reader.port.js";
import { generateWithPrompt } from "../../prompts/kit/prompt-definition.js";
import { parseTodoPrompt } from "../../prompts/parsing/parse-todo/index.js";
import { describeParsingFailure } from "../../services/parsing/ai-parsing-error-code.js";
import { settleChargedGeneration } from "../../services/parsing/charged-generation.js";
import { resolveRequestLocale } from "../../services/parsing/resolve-request-locale.js";

/** 공개 응답의 토큰 사용량 (사고 토큰은 로그에만 남긴다). */
export interface ParseTokenUsage {
  input: number;
  output: number;
}

/** 파싱 메타데이터 (모델·처리시간·토큰·프롬프트 버전). */
export interface ParseTodoMeta {
  model: string;
  processingTimeMs: number;
  tokenUsage: ParseTokenUsage;
  promptVersion: string;
}

/** 사용량을 유지할지 함께 돌려준다. 실행할 행동이 없던 입력은 차감하지 않는다. */
interface ChargedResult<T> {
  readonly result: T;
  readonly charge: boolean;
}

/** 자연어 → 단건 투두 파싱 결과. */
export interface ParseTodoResult {
  data: ParsedTodoData;
  meta: ParseTodoMeta;
  /** 이번 요청의 확정·환불을 반영한 AI_PARSE 한도·사용량. 읽지 못했으면 null이고 응답에서 빠진다 */
  featureQuota: MeteredFeatureQuota | null;
}

/**
 * 자연어 텍스트를 투두 데이터로 파싱하는 입력.
 * 사용량을 차감하는 쓰기 유스케이스다.
 */
export interface ParseTodoInput {
  text: string;
  userId: string;
  /** X-Timezone 헤더. 없으면 저장된 사용자 시간대를 쓴다. */
  timezone: string | undefined;
  categoryId: number | undefined;
  /** Accept-Language 헤더. 없으면 저장된 사용자 언어를 쓴다. */
  locale: SupportedLocale | undefined;
}

type ResolvedParseTodoInput = Omit<ParseTodoInput, "timezone" | "locale"> & {
  readonly timezone: string;
  readonly locale: SupportedLocale;
};

/**
 * 자연어 → 단건 투두 파싱 use-case.
 *
 * 사용량 원자적 예약 → 프롬프트 조립 → 동의 범위 안의 업체로 AI 생성 → 정규화.
 * 생성 실패 시 예약을 한 번 환불하고, 실패 종류에 따라 요청 과다(AI_1310)/호출 실패(AI_1301)/
 * 할 일 만들기 실패(AI_1302)를 details.charged=false와 함께 던진다.
 */
interface ParseTodoDependencies {
  readonly generator: Pick<AiGeneratorPort, "generate">;
  readonly consentReader: Pick<AiDataSharingConsentDecisionReaderPort, "findAiDataSharingConsent">;
  readonly categoryReader: Pick<UserCategoryReaderPort, "findByUserId">;
  readonly quota: Pick<QuotaLedgerPort, "reserve" | "commit" | "refund" | "read">;
  readonly localePreferenceReader: Pick<UserLocalePreferenceReaderPort, "read">;
  readonly logger: Pick<ApplicationLogger, "log" | "warn" | "error">;
}

export class ParseTodo {
  readonly #dependencies: ParseTodoDependencies;

  constructor(dependencies: ParseTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ParseTodoInput): Promise<ParseTodoResult> {
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
      reason: "parse-todo",
    });
    const { result, featureQuota } = await settleChargedGeneration(this.#dependencies, {
      reservation,
      userId,
      feature: "AI_PARSE",
      task: parseTodoPrompt.id,
      generate: async () => {
        const parsed = await this.#parse({ ...input, timezone, locale }, startTime);
        return { result: parsed.result, outcome: parsed.charge ? "CHARGE" : "NO_ACTION" };
      },
    });
    return { ...result, featureQuota };
  }

  async #parse(
    input: ResolvedParseTodoInput,
    startTime: number,
  ): Promise<ChargedResult<Omit<ParseTodoResult, "featureQuota">>> {
    const { text, userId, timezone, categoryId, locale } = input;
    const definition = parseTodoPrompt;
    const at = now();

    // 사용자가 카테고리를 고른 요청은 목록을 보내지 않아 토큰을 아낀다.
    const userCategories =
      categoryId == null ? await this.#dependencies.categoryReader.findByUserId(userId) : [];
    const built = definition.build({ text, timezone, now: at, categories: userCategories }, locale);
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
          text,
          timezone,
          now: at,
          locale,
          ownedCategoryIds: new Set(userCategories.map((category) => category.id)),
          requestedCategoryId: categoryId,
        },
        { agreedConsentVersion: agreedVersion, userId },
      );

      const charge = value.intent === "TASK";
      this.#dependencies.logger.log({
        ...generationCompletedLog(
          { ...logBase, outcome: charge ? "SUCCESS" : "NO_ACTION", quotaCharged: charge },
          meta,
        ),
        warnings: value.warnings,
      });
      return {
        result: {
          data: value.data,
          meta: toParseMeta(meta, definition.version, Date.now() - startTime),
        },
        charge,
      };
    } catch (error) {
      const failure = describeParsingFailure(error);
      this.#dependencies.logger.error(
        generationFailedLog({
          ...logBase,
          outcome: "FAILED",
          ...failure,
          latencyMs: Date.now() - startTime,
          quotaCharged: false,
        }),
      );
      // 호출부가 예약을 환불하므로 앱이 "횟수는 차감되지 않았어요"를 보여 줄 수 있다. 환불에 실패하면 호출부가 뗀다.
      throw new ApplicationException(failure.errorCode, { charged: false });
    }
  }
}

export function toParseMeta(
  meta: AiGenerationMeta,
  promptVersion: string,
  processingTimeMs: number,
): ParseTodoMeta {
  return {
    model: meta.model,
    processingTimeMs,
    tokenUsage: { input: meta.inputTokens, output: meta.outputTokens },
    promptVersion,
  };
}
