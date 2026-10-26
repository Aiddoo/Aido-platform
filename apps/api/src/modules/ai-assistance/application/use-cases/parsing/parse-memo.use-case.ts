import type { ParsedMemoData } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { sumBy } from "es-toolkit";
import { ZodError } from "zod";

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
import { parseMemoPrompts } from "../../prompts/parsing/parse-memo/index.js";
import { resolveGenerationPolicy } from "../../services/parsing/ai-generation-policy.js";
import { describeParsingFailure } from "../../services/parsing/ai-parsing-error-code.js";
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
 * parse-todo와 동일한 가용성/사용량/에러 규약을 따르되, 할 일은 합치지 않고 앞의 5개만 만들며
 * 나머지 수를 meta.omittedTodoCount로 알린다. 미지 카테고리는 요청 기본 categoryId로 대체한다.
 */
interface ParseMemoDependencies {
  readonly aiProvider: Pick<AiProvider, "isAvailable" | "generateStructured">;
  readonly categoryReader: Pick<UserCategoryReaderPort, "findByUserId">;
  readonly quota: Pick<AiQuotaPort, "reserve" | "release">;
  readonly localePreferenceReader: Pick<UserLocalePreferenceReaderPort, "read">;
  readonly settings: AiTaskSettings;
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
    let parsed: { readonly result: ParseMemoResult; readonly charge: boolean };
    try {
      parsed = await this.#parse({ ...input, timezone, locale }, startTime);
    } catch (error) {
      await this.#dependencies.quota.release(reservation);
      throw error;
    }
    // 실행할 행동이 없던 메모는 사용량을 차감하지 않는다.
    if (!parsed.charge) await this.#dependencies.quota.release(reservation);
    return parsed.result;
  }

  async #parse(
    input: ResolvedParseMemoInput,
    startTime: number,
  ): Promise<{ readonly result: ParseMemoResult; readonly charge: boolean }> {
    const { content, userId, timezone, categoryId, locale } = input;
    const definition = parseMemoPrompts[this.#dependencies.settings.promptVersion][locale];
    const at = now();

    const userCategories = await this.#dependencies.categoryReader.findByUserId(userId);
    const { system, prompt } = definition.build({
      content,
      timezone,
      now: at,
      categories: userCategories.map(({ id, name }) => ({ id, name })),
    });
    const logBase = {
      task: "parse-memo",
      promptVersion: definition.promptVersion,
      userId,
    } as const;

    try {
      const { value, meta } = await definition.output.generate(
        this.#dependencies.aiProvider,
        {
          task: "parse-memo",
          promptVersion: definition.promptVersion,
          system,
          prompt,
          policy: resolveGenerationPolicy("parse-memo", this.#dependencies.settings),
        },
        {
          content,
          timezone,
          now: at,
          locale,
          ownedCategoryIds: new Set(userCategories.map((category) => category.id)),
          defaultCategoryId: categoryId,
        },
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
            ...toParseMeta(meta, definition.promptVersion, Date.now() - startTime),
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
      throw new ApplicationException(failure.errorCode);
    }
  }
}
