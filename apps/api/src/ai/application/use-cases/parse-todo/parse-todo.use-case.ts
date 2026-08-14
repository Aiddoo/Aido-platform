import { ErrorCode } from "@aido/errors";
import type { ParsedTodoData } from "@aido/validators";
import { parsedTodoDataSchema } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { now } from "@/shared/domain/date/utils/core";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import type { SupportedLocale } from "@/shared/domain/locale";

import { buildParseTodoPrompt } from "../../../domain/services/prompts/parse-todo.prompt";
import { buildParseTodoPromptEn } from "../../../domain/services/prompts/parse-todo.prompt.en";
import {
	AI_PROVIDER,
	type AiProvider,
	AiProviderCallError,
	type TokenUsage,
} from "../../ports/ai-provider.port";
import {
	USER_CATEGORY_READER,
	type UserCategoryReaderPort,
} from "../../ports/user-category-reader.port";
import { AiUsageMeter } from "../../services/ai-usage-meter.service";

/** 파싱 메타데이터 (모델·처리시간·토큰). */
export interface ParseTodoMeta {
	model: string;
	processingTimeMs: number;
	tokenUsage: TokenUsage;
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
	timezone: string;
	categoryId: number | undefined;
	locale: SupportedLocale;
}

/**
 * 자연어 → 단건 투두 파싱 use-case.
 *
 * 가용성 확인 → 사용량 원자적 차감 → 프롬프트 조립 → AI 생성 → 카테고리 정합.
 * AI 호출 실패 시 사용량을 보상 감소하고, 호출 실패(AI_1301)/파싱 실패(AI_1302)를
 * 구분해 던진다.
 */
@Injectable()
export class ParseTodoUseCase {
	readonly #logger = new Logger(ParseTodoUseCase.name);

	constructor(
		@Inject(AI_PROVIDER)
		private readonly aiProvider: AiProvider,
		@Inject(USER_CATEGORY_READER)
		private readonly categoryReader: UserCategoryReaderPort,
		private readonly usageMeter: AiUsageMeter,
	) {}

	async execute(input: ParseTodoInput): Promise<ParseTodoResult> {
		const { text, userId, timezone, categoryId, locale } = input;
		const startTime = Date.now();

		if (!this.aiProvider.isAvailable()) {
			this.#logger.warn(`AI 서비스 불가: userId=${userId}`);
			throw new ApplicationException(ErrorCode.AI_1301);
		}

		await this.usageMeter.checkAndIncrement(userId);

		const userCategories = await this.categoryReader.findByUserId(userId);
		const categoryIds = new Set(userCategories.map((c) => c.id));

		const buildTodoPrompt = locale === "en" ? buildParseTodoPromptEn : buildParseTodoPrompt;
		const { system, prompt } = buildTodoPrompt(
			text,
			timezone,
			now(),
			userCategories.map((c) => ({ id: c.id, name: c.name })),
		);

		try {
			const result = await this.aiProvider.generateStructured({
				system,
				prompt,
				schema: parsedTodoDataSchema,
				maxOutputTokens: 200,
			});

			const processingTimeMs = Date.now() - startTime;

			this.#logger.log(
				`투두 파싱 완료: userId=${userId}, title="${result.output.title}", ` +
					`${processingTimeMs}ms, tokens=${result.usage.input}/${result.usage.output}`,
			);

			const inferredCategoryId = categoryIds.has(result.output.categoryId ?? 0)
				? result.output.categoryId
				: undefined;

			return {
				data: {
					...result.output,
					categoryId: categoryId ?? inferredCategoryId,
				},
				meta: {
					model: result.model,
					processingTimeMs,
					tokenUsage: result.usage,
				},
			};
		} catch (error) {
			await this.usageMeter.decrement(userId);

			if (error instanceof AiProviderCallError) {
				this.#logger.error(
					`AI API 호출 실패: userId=${userId}, status=${error.statusCode}, message=${error.message}`,
				);
				throw new ApplicationException(ErrorCode.AI_1301);
			}

			this.#logger.error(
				`투두 파싱 실패: userId=${userId}, error=${error instanceof Error ? error.message : "Unknown"}`,
			);
			throw new ApplicationException(ErrorCode.AI_1302, {
				details: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}
}
