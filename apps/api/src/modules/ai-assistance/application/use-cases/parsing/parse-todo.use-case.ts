import type { ParsedTodoData } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import type { SupportedLocale } from "#api/shared/domain/locale";

import {
  generationCompletedLog,
  generationFailedLog,
} from "../../observability/parsing/ai-generation-log.events.js";
import { AiParsingLogEvent } from "../../observability/parsing/ai-parsing-log.events.js";
import type { AiProvider } from "../../ports/parsing/ai-provider.port.js";
import type { AiQuotaPort } from "../../ports/parsing/ai-quota.port.js";
import type { AiTaskSettings } from "../../ports/parsing/ai-task-settings.port.js";
import { type UserCategoryReaderPort } from "../../ports/parsing/user-category-reader.port.js";
import type { UserLocalePreferenceReaderPort } from "../../ports/parsing/user-locale-preference.reader.port.js";
import { parseTodoPrompts } from "../../prompts/parsing/parse-todo/index.js";
import type { GenerationMeta } from "../../prompts/structured-output.js";
import { resolveGenerationPolicy } from "../../services/parsing/ai-generation-policy.js";
import { describeParsingFailure } from "../../services/parsing/ai-parsing-error-code.js";
import { resolveRequestLocale } from "../../services/parsing/resolve-request-locale.js";

/** 공개 응답의 토큰 사용량 (사고 토큰은 로그에만 남긴다). */
export interface ParseTokenUsage {
  input: number;
  output: number;
}

/** 파싱 메타데이터 (모델·처리시간·토큰). */
export interface ParseTodoMeta {
  model: string;
  processingTimeMs: number;
  tokenUsage: ParseTokenUsage;
}

/** 자연어 → 단건 투두 파싱 결과. */
export interface ParseTodoResult {
  data: ParsedTodoData;
  meta: ParseTodoMeta;
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
 * 가용성 확인 → 사용량 원자적 차감 → 프롬프트 조립 → AI 생성 → 정규화.
 * AI 호출 실패 시 사용량을 보상 감소하고, 공급자 오류 종류에 따라
 * 요청 과다(AI_1310)/호출 실패(AI_1301)/파싱 실패(AI_1302)를 구분해 던진다.
 */
interface ParseTodoDependencies {
  readonly aiProvider: Pick<AiProvider, "isAvailable" | "generateStructured">;
  readonly categoryReader: Pick<UserCategoryReaderPort, "findByUserId">;
  readonly quota: Pick<AiQuotaPort, "reserve" | "release">;
  readonly localePreferenceReader: Pick<UserLocalePreferenceReaderPort, "read">;
  readonly settings: AiTaskSettings;
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

    if (!this.#dependencies.aiProvider.isAvailable()) {
      this.#dependencies.logger.warn({ event: AiParsingLogEvent.UNAVAILABLE, userId });
      throw new ApplicationException(ErrorCode.AI_1301);
    }

    const { timezone, locale } = await resolveRequestLocale(
      this.#dependencies.localePreferenceReader,
      userId,
      input,
    );
    const reservation = await this.#dependencies.quota.reserve(userId);
    try {
      return await this.#parse({ ...input, timezone, locale }, startTime);
    } catch (error) {
      await this.#dependencies.quota.release(reservation);
      throw error;
    }
  }

  async #parse(input: ResolvedParseTodoInput, startTime: number): Promise<ParseTodoResult> {
    const { text, userId, timezone, categoryId, locale } = input;
    const definition = parseTodoPrompts.v1[locale];
    const at = now();

    // 사용자가 카테고리를 고른 요청은 목록을 보내지 않아 토큰을 아낀다.
    const userCategories =
      categoryId === undefined ? await this.#dependencies.categoryReader.findByUserId(userId) : [];
    const { system, prompt } = definition.build({
      text,
      timezone,
      now: at,
      categories: userCategories.map(({ id, name }) => ({ id, name })),
    });
    const logBase = {
      task: "parse-todo",
      promptVersion: definition.promptVersion,
      userId,
    } as const;

    try {
      const { value, meta } = await definition.output.generate(
        this.#dependencies.aiProvider,
        {
          task: "parse-todo",
          promptVersion: definition.promptVersion,
          system,
          prompt,
          policy: resolveGenerationPolicy("parse-todo", this.#dependencies.settings),
        },
        {
          text,
          timezone,
          now: at,
          locale,
          ownedCategoryIds: new Set(userCategories.map((category) => category.id)),
          requestedCategoryId: categoryId,
        },
      );

      this.#dependencies.logger.log(
        generationCompletedLog({ ...logBase, outcome: "SUCCESS", quotaCharged: true }, meta),
      );
      return { data: value.data, meta: toParseMeta(meta, Date.now() - startTime) };
    } catch (error) {
      const failure = describeParsingFailure(error);
      this.#dependencies.logger.error(
        generationFailedLog({
          ...logBase,
          outcome: "FAILED",
          errorKind: failure.kind,
          statusCode: failure.statusCode,
          errorCode: failure.errorCode,
          latencyMs: Date.now() - startTime,
          quotaCharged: false,
        }),
      );
      throw new ApplicationException(failure.errorCode);
    }
  }
}

export function toParseMeta(meta: GenerationMeta, processingTimeMs: number): ParseTodoMeta {
  return {
    model: meta.model,
    processingTimeMs,
    tokenUsage: { input: meta.usage.input, output: meta.usage.output },
  };
}
