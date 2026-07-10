import { ErrorCode } from "@aido/errors";
import { parsedTodoDataSchema } from "@aido/validators";
import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { APICallError } from "ai";
import { now } from "@/shared/domain/date/utils/core";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { buildParseTodoPrompt } from "../../../domain/services/prompts/parse-todo.prompt";
import { buildParseTodoPromptEn } from "../../../domain/services/prompts/parse-todo.prompt.en";
import { AI_PROVIDER, type AiProvider } from "../../ports/ai-provider.port";
import {
	USER_CATEGORY_READER,
	type UserCategoryReaderPort,
} from "../../ports/user-category-reader.port";
import { AiUsageMeter } from "../../services/ai-usage-meter.service";
import { ParseTodoCommand, type ParseTodoResult } from "./parse-todo.command";

/**
 * 자연어 → 단건 투두 파싱 핸들러.
 *
 * 가용성 확인 → 사용량 원자적 차감 → 프롬프트 조립 → AI 생성 → 카테고리 정합.
 * AI 호출 실패 시 사용량을 보상 감소하고, 호출 실패(AI_1301)/파싱 실패(AI_1302)를
 * 구분해 던진다.
 */
@CommandHandler(ParseTodoCommand)
export class ParseTodoHandler
	implements ICommandHandler<ParseTodoCommand, ParseTodoResult>
{
	readonly #logger = new Logger(ParseTodoHandler.name);

	constructor(
		@Inject(AI_PROVIDER)
		private readonly aiProvider: AiProvider,
		@Inject(USER_CATEGORY_READER)
		private readonly categoryReader: UserCategoryReaderPort,
		private readonly usageMeter: AiUsageMeter,
	) {}

	async execute(command: ParseTodoCommand): Promise<ParseTodoResult> {
		const { text, userId, timezone, categoryId, locale } = command;
		const startTime = Date.now();

		if (!this.aiProvider.isAvailable()) {
			this.#logger.warn(`AI 서비스 불가: userId=${userId}`);
			throw new ApplicationException(ErrorCode.AI_1301);
		}

		await this.usageMeter.checkAndIncrement(userId);

		const userCategories = await this.categoryReader.findByUserId(userId);
		const categoryIds = new Set(userCategories.map((c) => c.id));

		const buildTodoPrompt =
			locale === "en" ? buildParseTodoPromptEn : buildParseTodoPrompt;
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
				temperature: 0.1,
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

			if (error instanceof APICallError) {
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
