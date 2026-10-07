import type { LlmParsedMemoResult, ParsedMemoData } from "@aido/api";
import { llmParsedMemoResultSchema, parsedMemoDataSchema } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { sumBy } from "es-toolkit";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import type { SupportedLocale } from "#api/shared/domain/locale";

import { buildParseMemoPromptEn } from "../../../domain/services/parsing/prompts/parse-memo.prompt.en.js";
import { buildParseMemoPrompt } from "../../../domain/services/parsing/prompts/parse-memo.prompt.js";
import { AiParsingLogEvent } from "../../observability/parsing/ai-parsing-log.events.js";
import { type AiProvider, AiProviderCallError } from "../../ports/parsing/ai-provider.port.js";
import type { AiQuotaPort } from "../../ports/parsing/ai-quota.port.js";
import { type UserCategoryReaderPort } from "../../ports/parsing/user-category-reader.port.js";
import type { ParseTodoMeta } from "./parse-todo.use-case.js";

/** 메모 → 다중 투두 파싱 결과 (LLM 출력에 categoryId 주입). */
export interface ParseMemoResult {
  data: ParsedMemoData;
  meta: ParseTodoMeta;
}

/**
 * 메모 내용을 다중 Todo + SubTodo 데이터로 파싱하는 입력.
 * parse-todo와 월간 사용량을 공유하는 쓰기 유스케이스다.
 */
export interface ParseMemoInput {
  content: string;
  userId: string;
  timezone: string;
  categoryId: number;
  locale: SupportedLocale;
}

/**
 * 메모 → 다중 투두 파싱 use-case.
 *
 * parse-todo와 동일한 가용성/사용량/에러 규약을 따르되, 최대 5개 todo로 잘라내고
 * 미지 카테고리는 요청 기본 categoryId로 대체한다.
 */
interface ParseMemoDependencies {
  readonly aiProvider: AiProvider;
  readonly categoryReader: UserCategoryReaderPort;
  readonly quota: Pick<AiQuotaPort, "reserve" | "release">;
  readonly logger: ApplicationLogger;
}

export class ParseMemo {
  readonly #dependencies: ParseMemoDependencies;

  constructor(dependencies: ParseMemoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ParseMemoInput): Promise<ParseMemoResult> {
    const { userId } = input;
    const startTime = Date.now();

    if (!this.#dependencies.aiProvider.isAvailable()) {
      this.#dependencies.logger.warn({ event: AiParsingLogEvent.UNAVAILABLE, userId });
      throw new ApplicationException(ErrorCode.AI_1301);
    }

    const reservation = await this.#dependencies.quota.reserve(userId);
    try {
      return await this.#parse(input, startTime);
    } catch (error) {
      await this.#dependencies.quota.release(reservation);
      throw error;
    }
  }

  async #parse(input: ParseMemoInput, startTime: number): Promise<ParseMemoResult> {
    const { content, userId, timezone, categoryId, locale } = input;

    const userCategories = await this.#dependencies.categoryReader.findByUserId(userId);
    const categoryIds = new Set(userCategories.map((category) => category.id));

    const buildMemoPrompt = locale === "en" ? buildParseMemoPromptEn : buildParseMemoPrompt;
    const { system, prompt } = buildMemoPrompt(
      content,
      timezone,
      now(),
      userCategories.map((category) => ({ id: category.id, name: category.name })),
    );

    try {
      const result = await this.#dependencies.aiProvider.generateStructured<LlmParsedMemoResult>({
        system,
        prompt,
        schema: llmParsedMemoResultSchema,
        maxOutputTokens: 800,
      });

      const processingTimeMs = Date.now() - startTime;
      const todoCount = result.output.todos.length;
      const itemCount = sumBy(result.output.todos, (todo) => todo.items.length);

      this.#dependencies.logger.log({
        event: AiParsingLogEvent.MEMO_COMPLETED,
        userId,
        model: result.model,
        processingTimeMs,
        tokenUsage: result.usage,
        todoCount,
        itemCount,
      });

      const data = parsedMemoDataSchema.parse({
        todos: result.output.todos.slice(0, 5).map((todo) => ({
          ...todo,
          categoryId: categoryIds.has(todo.categoryId) ? todo.categoryId : categoryId,
        })),
      });

      return {
        data,
        meta: {
          model: result.model,
          processingTimeMs,
          tokenUsage: result.usage,
        },
      };
    } catch (error) {
      if (error instanceof AiProviderCallError) {
        this.#dependencies.logger.error({
          event: AiParsingLogEvent.PROVIDER_FAILED,
          userId,
          statusCode: error.statusCode,
        });
        throw new ApplicationException(ErrorCode.AI_1301);
      }

      this.#dependencies.logger.error({
        event: AiParsingLogEvent.OUTPUT_INVALID,
        userId,
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      throw new ApplicationException(ErrorCode.AI_1302, {
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
