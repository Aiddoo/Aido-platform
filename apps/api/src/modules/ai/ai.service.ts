/**
 * AI Service
 *
 * 자연어 투두 파싱 및 일일 사용량 관리를 담당합니다.
 *
 * 핵심 기능:
 * - 자연어 → 구조화된 투두 변환 (Gemini 2.5 Flash-Lite)
 * - 일일 사용량 추적 (ADMIN/ACTIVE: 무제한, 그 외: 5회/일)
 * - KST 기준 자정 리셋
 */
import type {
	LlmParsedMemoResult,
	ParsedMemoData,
	ParsedTodoData,
} from "@aido/validators";
import {
	llmParsedMemoResultSchema,
	parsedMemoDataSchema,
	parsedTodoDataSchema,
} from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { APICallError } from "ai";
import { addDays } from "@/common/date/utils/arithmetic";
import { isSameDay } from "@/common/date/utils/compare";
import { now } from "@/common/date/utils/core";
import { toISOString } from "@/common/date/utils/format";
import {
	midnightInTimezone,
	startOfDayInTimezone,
} from "@/common/date/utils/timezone";
import {
	EntitlementService,
	Feature,
} from "@/common/entitlement/entitlement.service";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database/database.service";
import { UserRepository } from "../auth/repositories/user.repository";
import { TodoCategoryRepository } from "../todo-category/todo-category.repository";

import { buildParseMemoPrompt } from "./prompts/parse-memo.prompt";
import { buildParseTodoPrompt } from "./prompts/parse-todo.prompt";
import {
	AI_PROVIDER,
	type AiProvider,
	type TokenUsage,
} from "./providers/ai.provider";

/**
 * AI 사용량 정보
 */
export interface UsageInfo {
	/** 오늘 사용한 횟수 */
	used: number;
	/** 일일 제한 횟수 (null = 무제한) */
	limit: number | null;
	/** 다음 리셋 시간 (ISO 8601) */
	resetsAt: string;
}

/**
 * 파싱 메타데이터
 */
export interface ParseTodoMeta {
	/** 사용된 모델명 */
	model: string;
	/** 처리 시간 (ms) */
	processingTimeMs: number;
	/** 토큰 사용량 */
	tokenUsage: TokenUsage;
}

/**
 * 파싱 결과
 */
export interface ParseTodoResult {
	/** 파싱된 투두 데이터 */
	data: ParsedTodoData;
	/** 메타데이터 */
	meta: ParseTodoMeta;
}

/**
 * 메모 파싱 결과 — LLM 출력에 categoryId를 주입한 형태
 */
export interface ParseMemoResult {
	/** 파싱된 다중 투두 데이터 */
	data: ParsedMemoData;
	/** 메타데이터 */
	meta: ParseTodoMeta;
}

@Injectable()
export class AiService {
	readonly #logger = new Logger(AiService.name);

	constructor(
		@Inject(AI_PROVIDER)
		private readonly aiProvider: AiProvider,
		private readonly database: DatabaseService,
		private readonly entitlementService: EntitlementService,
		private readonly userRepository: UserRepository,
		private readonly todoCategoryRepository: TodoCategoryRepository,
	) {}

	/**
	 * 자연어 텍스트를 투두 데이터로 파싱
	 *
	 * @param text - 파싱할 자연어 텍스트
	 * @param userId - 사용자 ID
	 * @returns 파싱된 투두 데이터와 메타 정보
	 * @throws AI_1301 - AI 서비스 불가
	 * @throws AI_1302 - 파싱 실패
	 * @throws AI_1303 - 일일 사용량 초과
	 */
	async parseTodo(
		text: string,
		userId: string,
		timezone: string,
		categoryId?: number,
	): Promise<ParseTodoResult> {
		const startTime = Date.now();

		if (!this.aiProvider.isAvailable()) {
			this.#logger.warn(`AI 서비스 불가: userId=${userId}`);
			throw BusinessExceptions.aiServiceUnavailable();
		}

		await this.#checkAndIncrementUsage(userId);

		const userCategories =
			await this.todoCategoryRepository.findManyByUserId(userId);
		const categoryIds = new Set(userCategories.map((c) => c.id));

		const { system, prompt } = buildParseTodoPrompt(
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
				maxTokens: 200,
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
			await this.#decrementUsage(userId);

			if (error instanceof APICallError) {
				this.#logger.error(
					`AI API 호출 실패: userId=${userId}, status=${error.statusCode}, message=${error.message}`,
				);
				throw BusinessExceptions.aiServiceUnavailable();
			}

			this.#logger.error(
				`투두 파싱 실패: userId=${userId}, error=${error instanceof Error ? error.message : "Unknown"}`,
			);
			throw BusinessExceptions.aiParseFailed(
				error instanceof Error ? error.message : "Unknown error",
			);
		}
	}

	/**
	 * 메모 내용을 다중 Todo + SubTodo 데이터로 파싱
	 *
	 * @param content - 메모 내용
	 * @param userId - 사용자 ID
	 * @param timezone - 사용자 타임존 (IANA)
	 * @param categoryId - 기본 카테고리 ID (모든 todo에 주입)
	 * @returns 파싱된 다중 투두 데이터와 메타 정보
	 * @throws AI_1301 - AI 서비스 불가
	 * @throws AI_1302 - 파싱 실패
	 * @throws AI_1303 - 일일 사용량 초과
	 */
	async parseMemoToTodos(
		content: string,
		userId: string,
		timezone: string,
		categoryId: number,
	): Promise<ParseMemoResult> {
		const startTime = Date.now();

		if (!this.aiProvider.isAvailable()) {
			this.#logger.warn(`AI 서비스 불가: userId=${userId}`);
			throw BusinessExceptions.aiServiceUnavailable();
		}

		await this.#checkAndIncrementUsage(userId);

		const userCategories =
			await this.todoCategoryRepository.findManyByUserId(userId);
		const categoryIds = new Set(userCategories.map((c) => c.id));

		const { system, prompt } = buildParseMemoPrompt(
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
					maxTokens: 800,
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
			await this.#decrementUsage(userId);

			if (error instanceof APICallError) {
				this.#logger.error(
					`AI API 호출 실패: userId=${userId}, status=${error.statusCode}, message=${error.message}`,
				);
				throw BusinessExceptions.aiServiceUnavailable();
			}

			this.#logger.error(
				`메모 파싱 실패: userId=${userId}, error=${error instanceof Error ? error.message : "Unknown"}`,
			);
			throw BusinessExceptions.aiParseFailed(
				error instanceof Error ? error.message : "Unknown error",
			);
		}
	}

	/**
	 * 현재 사용량 조회
	 *
	 * @param userId - 사용자 ID
	 * @returns 사용량 정보
	 */
	async getUsage(userId: string): Promise<UsageInfo> {
		const user = await this.database.user.findUnique({
			where: { id: userId },
			select: { aiUsageCount: true, aiUsageResetAt: true },
		});

		if (!user) {
			throw BusinessExceptions.userNotFound(userId);
		}

		const dailyLimit = await this.#getDailyLimit(userId);
		const isNewDay = this.#isNewDay(user.aiUsageResetAt);

		return {
			used: isNewDay ? 0 : user.aiUsageCount,
			limit: dailyLimit,
			resetsAt: this.#getNextResetTime(),
		};
	}

	/**
	 * 사용량 체크 및 증가 (원자적 처리)
	 *
	 * 트랜잭션으로 사용량 확인과 증가를 원자적으로 처리하여
	 * 동시 요청 시 사용 제한을 정확하게 적용합니다.
	 *
	 * @param userId - 사용자 ID
	 * @throws AI_1303 - 일일 사용량 초과
	 */
	async #checkAndIncrementUsage(userId: string): Promise<void> {
		const dailyLimit = await this.#getDailyLimit(userId);

		await this.database.$transaction(async (tx) => {
			const user = await this.userRepository.findAiUsage(userId, tx);

			if (!user) {
				throw BusinessExceptions.userNotFound(userId);
			}

			const isNewDay = this.#isNewDay(user.aiUsageResetAt);
			const currentUsage = isNewDay ? 0 : user.aiUsageCount;

			this.entitlementService.enforceLimit(
				{ dailyLimit, isAdmin: false, subscriptionStatus: "" },
				currentUsage,
				BusinessExceptions.aiUsageLimitExceeded,
			);

			if (isNewDay) {
				await this.userRepository.resetAndIncrementAiUsage(userId, tx);
			} else {
				await this.userRepository.incrementAiUsage(userId, tx);
			}
		});
	}

	/**
	 * AI 호출 실패 시 사용량 롤백
	 *
	 * 롤백 자체가 실패해도 원래 에러 전파에 영향을 주지 않습니다.
	 */
	async #decrementUsage(userId: string): Promise<void> {
		try {
			await this.userRepository.decrementAiUsage(userId);
			this.#logger.debug(`AI usage decremented for user: ${userId}`);
		} catch (rollbackError) {
			this.#logger.error(
				`Failed to rollback AI usage for ${userId}:`,
				rollbackError,
			);
		}
	}

	/** 사용자별 일일 제한 조회 (EntitlementService 위임) */
	async #getDailyLimit(userId: string): Promise<number | null> {
		const entitlement = await this.entitlementService.getFeatureLimit(
			userId,
			Feature.AI_PARSE,
		);
		return entitlement.dailyLimit;
	}

	/**
	 * 새로운 날인지 확인 (KST 기준)
	 *
	 * @param lastReset - 마지막 리셋 시간
	 * @returns 새로운 날 여부
	 */
	#isNewDay(lastReset: Date | null): boolean {
		if (!lastReset) return true;
		const kstToday = startOfDayInTimezone(now(), "Asia/Seoul");
		const kstLastDay = startOfDayInTimezone(lastReset, "Asia/Seoul");
		return !isSameDay(kstToday, kstLastDay);
	}

	/**
	 * 다음 리셋 시간 계산 (KST 자정)
	 *
	 * @returns ISO 8601 형식의 다음 리셋 시간
	 */
	#getNextResetTime(): string {
		const kstTodayMidnight = midnightInTimezone(now(), "Asia/Seoul");
		const kstTomorrowMidnight = addDays(1, kstTodayMidnight);
		return toISOString(kstTomorrowMidnight);
	}
}
