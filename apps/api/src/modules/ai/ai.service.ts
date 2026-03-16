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
import type { ParsedTodoData } from "@aido/validators";
import { parsedTodoDataSchema } from "@aido/validators";
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
import { UserRepository } from "@/modules/auth/repositories/user.repository";

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

@Injectable()
export class AiService {
	readonly #logger = new Logger(AiService.name);

	constructor(
		@Inject(AI_PROVIDER)
		private readonly aiProvider: AiProvider,
		private readonly database: DatabaseService,
		private readonly entitlementService: EntitlementService,
		private readonly userRepository: UserRepository,
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

		// 1. AI Provider 가용성 확인
		if (!this.aiProvider.isAvailable()) {
			this.#logger.error("AI provider is not available");
			throw BusinessExceptions.aiServiceUnavailable();
		}

		// 2. 사용량 체크 및 증가 (원자적 처리)
		await this.#checkAndIncrementUsage(userId);

		// 3. 최적화된 프롬프트 생성
		const prompt = buildParseTodoPrompt(text, timezone, now());

		this.#logger.debug(`Parsing todo: "${text}"`);

		try {
			// 4. AI 호출 (구조화된 출력)
			const result = await this.aiProvider.generateStructured({
				prompt,
				schema: parsedTodoDataSchema,
				maxTokens: 200,
				temperature: 0.1,
			});

			const processingTimeMs = Date.now() - startTime;

			this.#logger.log(
				`Todo parsed: "${result.output.title}" (${processingTimeMs}ms, ` +
					`input: ${result.usage.input}, output: ${result.usage.output})`,
			);

			return {
				data: {
					...result.output,
					...(categoryId != null && { categoryId }),
				},
				meta: {
					model: result.model,
					processingTimeMs,
					tokenUsage: result.usage,
				},
			};
		} catch (error) {
			this.#logger.error(`AI parsing failed: ${error}`);

			// AI 호출 실패 시 사용량 롤백 (사용자에게 공평하게)
			await this.#decrementUsage(userId);

			// AI SDK 에러 타입 기반 분기 처리
			if (error instanceof APICallError) {
				// API 호출 실패 (네트워크, 인증, 서버 오류 등)
				this.#logger.error("AI API call failed", {
					status: error.statusCode,
					message: error.message,
				});
				throw BusinessExceptions.aiServiceUnavailable();
			}

			// 기타 에러는 파싱 실패로 처리
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
