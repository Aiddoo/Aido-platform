import { ErrorCode } from "@aido/errors";
import type { LlmParsedMemoResult } from "@aido/validators";
import {
	llmParsedMemoResultSchema,
	parsedMemoDataSchema,
} from "@aido/validators";
import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { APICallError } from "ai";
import { now } from "@/shared/domain/date/utils/core";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { buildParseMemoPrompt } from "../../../domain/services/prompts/parse-memo.prompt";
import { buildParseMemoPromptEn } from "../../../domain/services/prompts/parse-memo.prompt.en";
import { AI_PROVIDER, type AiProvider } from "../../ports/ai-provider.port";
import {
	USER_CATEGORY_READER,
	type UserCategoryReaderPort,
} from "../../ports/user-category-reader.port";
import { AiUsageMeter } from "../../services/ai-usage-meter.service";
import { ParseMemoCommand, type ParseMemoResult } from "./parse-memo.command";

/**
 * 메모 → 다중 투두 파싱 핸들러.
 *
 * parse-todo와 동일한 가용성/사용량/에러 규약을 따르되, 최대 5개 todo로 잘라내고
 * 미지 카테고리는 요청 기본 categoryId로 대체한다.
 */
@CommandHandler(ParseMemoCommand)
export class ParseMemoHandler
	implements ICommandHandler<ParseMemoCommand, ParseMemoResult>
{
	readonly #logger = new Logger(ParseMemoHandler.name);

	constructor(
		@Inject(AI_PROVIDER)
		private readonly aiProvider: AiProvider,
		@Inject(USER_CATEGORY_READER)
		private readonly categoryReader: UserCategoryReaderPort,
		private readonly usageMeter: AiUsageMeter,
	) {}

	async execute(command: ParseMemoCommand): Promise<ParseMemoResult> {
		const { content, userId, timezone, categoryId, locale } = command;
		const startTime = Date.now();

		if (!this.aiProvider.isAvailable()) {
			this.#logger.warn(`AI 서비스 불가: userId=${userId}`);
			throw new ApplicationException(ErrorCode.AI_1301);
		}

		await this.usageMeter.checkAndIncrement(userId);

		const userCategories = await this.categoryReader.findByUserId(userId);
		const categoryIds = new Set(userCategories.map((c) => c.id));

		const buildMemoPrompt =
			locale === "en" ? buildParseMemoPromptEn : buildParseMemoPrompt;
		const { system, prompt } = buildMemoPrompt(
			content,
			timezone,
			now(),
			userCategories.map((c) => ({ id: c.id, name: c.name })),
		);

		try {
			const result =
				await this.aiProvider.generateStructured<LlmParsedMemoResult>({
					system,
					prompt,
					schema: llmParsedMemoResultSchema,
					maxOutputTokens: 800,
					temperature: 0.1,
				});

			const processingTimeMs = Date.now() - startTime;
			const todoCount = result.output.todos.length;
			const itemCount = result.output.todos.reduce(
				(sum, t) => sum + t.items.length,
				0,
			);

			this.#logger.log(
				`메모 파싱 완료: userId=${userId}, ${todoCount} todos, ${itemCount} items, ` +
					`${processingTimeMs}ms, tokens=${result.usage.input}/${result.usage.output}`,
			);

			const data = parsedMemoDataSchema.parse({
				todos: result.output.todos.slice(0, 5).map((todo) => ({
					...todo,
					categoryId: categoryIds.has(todo.categoryId)
						? todo.categoryId
						: categoryId,
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
			await this.usageMeter.decrement(userId);

			if (error instanceof APICallError) {
				this.#logger.error(
					`AI API 호출 실패: userId=${userId}, status=${error.statusCode}, message=${error.message}`,
				);
				throw new ApplicationException(ErrorCode.AI_1301);
			}

			this.#logger.error(
				`메모 파싱 실패: userId=${userId}, error=${error instanceof Error ? error.message : "Unknown"}`,
			);
			throw new ApplicationException(ErrorCode.AI_1302, {
				details: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}
}
