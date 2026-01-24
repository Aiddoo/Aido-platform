/**
 * AI Service
 *
 * 자연어 투두 파싱 및 일일 사용량 관리를 담당합니다.
 *
 * 핵심 기능:
 * - 자연어 → 구조화된 투두 변환 (Gemini 2.0 Flash)
 * - 일일 사용량 추적 (무료 유저: 5회/일)
 * - KST 기준 자정 리셋
 */
import type { ParsedTodoData } from "@aido/validators";
import { parsedTodoDataSchema } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database/database.service";
import { buildParseTodoPrompt } from "./prompts/parse-todo.prompt";
import {
	AI_PROVIDER,
	type AiProvider,
	type TokenUsage,
} from "./providers/ai.provider";

/** 일일 AI 사용 제한 (무료 유저) */
const DAILY_LIMIT = 5;

/** KST 시간대 오프셋 (밀리초) */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * AI 사용량 정보
 */
export interface UsageInfo {
	/** 오늘 사용한 횟수 */
	used: number;
	/** 일일 제한 횟수 */
	limit: number;
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
	private readonly logger = new Logger(AiService.name);

	constructor(
		@Inject(AI_PROVIDER)
		private readonly aiProvider: AiProvider,
		private readonly prisma: DatabaseService,
	) {}

	/**
	 * 자연어 텍스트를 투두 데이터로 파싱
	 *
	 * @param text - 파싱할 자연어 텍스트
	 * @param userId - 사용자 ID
	 * @returns 파싱된 투두 데이터와 메타 정보
	 * @throws AI_0001 - AI 서비스 불가
	 * @throws AI_0002 - 파싱 실패
	 */
	async parseTodo(text: string, userId: string): Promise<ParseTodoResult> {
		const startTime = Date.now();

		// 1. AI Provider 가용성 확인
		if (!this.aiProvider.isAvailable()) {
			this.logger.error("AI provider is not available");
			throw BusinessExceptions.aiServiceUnavailable();
		}

		// 2. 최적화된 프롬프트 생성
		const prompt = buildParseTodoPrompt(text, new Date());

		this.logger.debug(`Parsing todo: "${text}"`);

		try {
			// 3. AI 호출 (구조화된 출력)
			const result = await this.aiProvider.generateStructured({
				prompt,
				schema: parsedTodoDataSchema,
				maxTokens: 150,
				temperature: 0.1,
			});

			const processingTimeMs = Date.now() - startTime;

			// 4. 사용량 증가 (Guard에서 체크 완료됨)
			await this.incrementUsage(userId);

			this.logger.log(
				`Todo parsed: "${result.output.title}" (${processingTimeMs}ms, ` +
					`input: ${result.usage.input}, output: ${result.usage.output})`,
			);

			return {
				data: result.output,
				meta: {
					model: result.model,
					processingTimeMs,
					tokenUsage: result.usage,
				},
			};
		} catch (error) {
			this.logger.error(`AI parsing failed: ${error}`);

			// AI SDK 에러 분류
			if (error instanceof Error) {
				// API 키 문제 또는 네트워크 오류
				if (
					error.message.includes("API key") ||
					error.message.includes("network")
				) {
					throw BusinessExceptions.aiServiceUnavailable();
				}
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
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { aiUsageCount: true, aiUsageResetAt: true },
		});

		if (!user) {
			throw BusinessExceptions.userNotFound(userId);
		}

		const isNewDay = this.isNewDay(user.aiUsageResetAt);

		return {
			used: isNewDay ? 0 : user.aiUsageCount,
			limit: DAILY_LIMIT,
			resetsAt: this.getNextResetTime(),
		};
	}

	/**
	 * 사용량 제한 체크
	 *
	 * @param userId - 사용자 ID
	 * @returns 사용 가능 여부
	 */
	async checkUsageLimit(userId: string): Promise<boolean> {
		const usage = await this.getUsage(userId);
		return usage.used < usage.limit;
	}

	/**
	 * 사용량 증가
	 *
	 * @param userId - 사용자 ID
	 */
	private async incrementUsage(userId: string): Promise<void> {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { aiUsageCount: true, aiUsageResetAt: true },
		});

		if (!user) {
			throw BusinessExceptions.userNotFound(userId);
		}

		if (this.isNewDay(user.aiUsageResetAt)) {
			// 날짜가 바뀌었으면 리셋하고 1로 설정
			await this.prisma.user.update({
				where: { id: userId },
				data: {
					aiUsageCount: 1,
					aiUsageResetAt: new Date(),
				},
			});
			this.logger.debug(`Usage reset for user ${userId} (new day)`);
		} else {
			// 같은 날이면 증가
			await this.prisma.user.update({
				where: { id: userId },
				data: {
					aiUsageCount: { increment: 1 },
				},
			});
		}
	}

	/**
	 * 새로운 날인지 확인 (KST 기준)
	 *
	 * @param lastReset - 마지막 리셋 시간
	 * @returns 새로운 날 여부
	 */
	private isNewDay(lastReset: Date): boolean {
		const now = new Date();
		const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
		const kstLast = new Date(lastReset.getTime() + KST_OFFSET_MS);

		// KST 기준 날짜 비교
		return kstNow.toDateString() !== kstLast.toDateString();
	}

	/**
	 * 다음 리셋 시간 계산 (KST 자정)
	 *
	 * @returns ISO 8601 형식의 다음 리셋 시간
	 */
	private getNextResetTime(): string {
		const now = new Date();
		const kstNow = new Date(now.getTime() + KST_OFFSET_MS);

		// KST 기준 내일 자정
		const tomorrow = new Date(kstNow);
		tomorrow.setDate(tomorrow.getDate() + 1);
		tomorrow.setHours(0, 0, 0, 0);

		// UTC로 변환하여 반환
		const utcMidnight = new Date(tomorrow.getTime() - KST_OFFSET_MS);
		return utcMidnight.toISOString();
	}
}
