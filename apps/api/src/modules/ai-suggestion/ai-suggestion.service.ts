import {
	AI_SUGGESTION_LIMITS,
	dayOfWeekSchema,
	type RecurringSuggestion as RecurringSuggestionDto,
	type SuggestionActionResponse,
} from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import dayjs from "dayjs";
import { z } from "zod";
import { now } from "@/common/date/utils/core";
import { toDateString } from "@/common/date/utils/format";
import { EntitlementService } from "@/common/entitlement/entitlement.service";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database/database.service";
import type { Prisma } from "@/generated/prisma/client";
import { AI_PROVIDER, type AiProvider } from "../ai/providers/ai.provider";
import { TodoService } from "../todo/todo.service";
import { AiSuggestionMapper } from "./ai-suggestion.mapper";
import { AiSuggestionRepository } from "./ai-suggestion.repository";
import type { SuggestionActionDto } from "./dtos";
import {
	buildSuggestionPrompt,
	type DetectedPatternsResponse,
	detectedPatternsSchema,
} from "./prompts/detect-patterns.prompt";
import { SuggestionContextBuilder } from "./suggestion-context.builder";
import type { SuggestionContext, TodoSummaryForAnalysis } from "./types";

/**
 * AI 반복 제안 서비스
 *
 * 제안 목록 조회, 수락/거절 처리, 패턴 분석 및 제안 생성을 담당합니다.
 */
@Injectable()
export class AiSuggestionService {
	readonly #logger = new Logger(AiSuggestionService.name);

	constructor(
		private readonly aiSuggestionRepository: AiSuggestionRepository,
		private readonly todoService: TodoService,
		@Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
		private readonly entitlementService: EntitlementService,
		private readonly database: DatabaseService,
		private readonly contextBuilder: SuggestionContextBuilder,
	) {}

	/**
	 * 대기 중인 제안 목록 조회
	 */
	async getPendingSuggestions(
		userId: string,
	): Promise<RecurringSuggestionDto[]> {
		await this.#enforcePremium(userId);
		const suggestions =
			await this.aiSuggestionRepository.findPendingByUserId(userId);
		return AiSuggestionMapper.toManyResponse(suggestions);
	}

	/**
	 * 제안 수락 또는 거절 처리
	 */
	async handleAction(
		userId: string,
		suggestionId: number,
		dto: SuggestionActionDto,
		timezone: string,
	): Promise<SuggestionActionResponse> {
		await this.#enforcePremium(userId);

		// 1. 제안 조회
		const suggestion = await this.aiSuggestionRepository.findByIdAndUserId(
			suggestionId,
			userId,
		);

		if (!suggestion) {
			throw BusinessExceptions.aiSuggestionNotFound(suggestionId);
		}

		// 2. 상태 확인
		if (suggestion.status !== "PENDING") {
			throw BusinessExceptions.aiSuggestionAlreadyProcessed(
				suggestionId,
				suggestion.status,
			);
		}

		// 3. 만료 확인
		if (suggestion.expiresAt < now()) {
			throw BusinessExceptions.aiSuggestionExpired(suggestionId);
		}

		// 4. 액션 처리
		if (dto.action === "dismiss") {
			const updated = await this.aiSuggestionRepository.updateStatus(
				suggestionId,
				"DISMISSED",
			);

			return {
				message: "제안이 거절되었습니다.",
				suggestion: AiSuggestionMapper.toResponse(updated),
			};
		}

		// accept 처리: categoryId 필수 검증
		if (!dto.categoryId) {
			throw BusinessExceptions.invalidParameter({
				field: "categoryId",
				reason: "수락 시 categoryId는 필수입니다",
			});
		}

		const daysOfWeekResult = z
			.array(dayOfWeekSchema)
			.safeParse(suggestion.daysOfWeek);
		if (!daysOfWeekResult.success) {
			throw BusinessExceptions.invalidParameter({
				field: "daysOfWeek",
				reason: "제안의 요일 데이터가 유효하지 않습니다",
			});
		}
		const daysOfWeek = daysOfWeekResult.data;
		const currentDate = dayjs.utc(now());
		const startDate = dto.startDate ?? toDateString(currentDate.toDate());
		const endDate =
			dto.endDate ??
			toDateString(
				currentDate
					.add(AI_SUGGESTION_LIMITS.DEFAULT_RECURRING_WEEKS, "week")
					.toDate(),
			);

		// 상태를 먼저 ACCEPTED로 변경 (재수락 방지)
		const updated = await this.aiSuggestionRepository.updateStatus(
			suggestionId,
			"ACCEPTED",
		);

		try {
			const result = await this.todoService.createRecurring(
				{
					userId,
					title: suggestion.title,
					categoryId: dto.categoryId,
					startDate,
					endDate,
					daysOfWeek,
					scheduledTime: suggestion.scheduledTime,
				},
				timezone,
			);

			this.#logger.log(
				`제안 수락: id=${suggestionId}, userId=${userId}, createdTodos=${result.count}`,
			);

			return {
				message: "제안이 수락되어 반복 할 일이 생성되었습니다.",
				suggestion: AiSuggestionMapper.toResponse(updated),
				createdTodosCount: result.count,
			};
		} catch (error) {
			// 투두 생성 실패 시 상태를 PENDING으로 롤백
			try {
				await this.aiSuggestionRepository.updateStatus(suggestionId, "PENDING");
			} catch (rollbackError) {
				this.#logger.error(
					`제안 롤백 실패: id=${suggestionId}, rollbackError=${rollbackError}`,
					rollbackError instanceof Error ? rollbackError.stack : undefined,
				);
			}
			throw error;
		}
	}

	async #enforcePremium(userId: string): Promise<void> {
		const hasPremium = await this.entitlementService.hasPremiumAccess(userId);
		if (!hasPremium) {
			throw BusinessExceptions.aiSuggestionPremiumRequired();
		}
	}

	/**
	 * 사용자의 최근 할 일을 분석하여 반복 제안을 생성합니다.
	 *
	 * @returns 생성된 제안 수
	 */
	async analyzeAndCreateSuggestions(
		userId: string,
		timezone: string,
	): Promise<number> {
		// 1. 컨텍스트 수집 (통계 분석 + 투두 조회 + 날씨)
		const context = await this.contextBuilder.build(userId, timezone);

		if (context.todos.length < AI_SUGGESTION_LIMITS.MIN_OCCURRENCES) {
			this.#logger.debug(
				`제안 분석 스킵: userId=${userId}, todoCount=${context.todos.length} (최소 ${AI_SUGGESTION_LIMITS.MIN_OCCURRENCES}개 필요)`,
			);
			return 0;
		}

		// 2. AI 제안 생성
		const prompt = buildSuggestionPrompt(
			context,
			AI_SUGGESTION_LIMITS.MIN_OCCURRENCES,
		);

		const aiResult = await this.aiProvider.generateStructured({
			prompt,
			schema: detectedPatternsSchema,
			maxTokens: 1500,
			temperature: 0.3,
		});

		const patterns = this.#filterWeakPatterns(
			aiResult.output.patterns,
			context,
		);

		if (patterns.length === 0) {
			this.#logger.debug(`패턴 미감지: userId=${userId}`);
			return 0;
		}

		// 3. 기존 PENDING 교체 + 만료 정리 + 새 제안 저장 (트랜잭션)
		const currentDate = dayjs.utc(now());
		const expiresAt = currentDate
			.add(AI_SUGGESTION_LIMITS.SUGGESTION_EXPIRY_DAYS, "day")
			.toDate();

		const limitedPatterns = patterns.slice(
			0,
			AI_SUGGESTION_LIMITS.MAX_SUGGESTIONS_PER_USER,
		);

		const createdCount = await this.database.$transaction(async (tx) => {
			await this.aiSuggestionRepository.deletePending(userId, tx);
			await this.aiSuggestionRepository.deleteExpired(userId, tx);

			const { count } = await this.aiSuggestionRepository.createMany(
				limitedPatterns.map((pattern) => ({
					userId,
					title: pattern.title,
					daysOfWeek: pattern.daysOfWeek as unknown as Prisma.InputJsonValue,
					scheduledTime: pattern.scheduledTime,
					confidence: pattern.confidence,
					reason: pattern.reason,
					matchedTodos:
						pattern.matchedTitles as unknown as Prisma.InputJsonValue,
					expiresAt,
					suggestedCategoryId: this.#findSuggestedCategoryId(
						pattern.matchedTitles,
						context.todos,
					),
				})),
				tx,
			);
			return count;
		});

		this.#logger.log(
			`제안 생성 완료: userId=${userId}, patterns=${patterns.length}, created=${createdCount}`,
		);

		return createdCount;
	}

	/**
	 * AI가 반환한 패턴 중 약한 패턴을 필터링
	 *
	 * - 반복 패턴(같은 제목 반복): matchedTitles가 minOccurrences 미만이면 제거
	 * - 순차/발전 패턴(서로 다른 제목): 2개 이상이면 허용
	 * - 시즌 추천(matchedTitles 빈 배열): 허용
	 * - 날씨 컨텍스트 없는데 날씨 관련 제안: 제거
	 */
	#filterWeakPatterns(
		patterns: DetectedPatternsResponse["patterns"],
		context: SuggestionContext,
	): DetectedPatternsResponse["patterns"] {
		return patterns.filter((p) => {
			// 시즌 추천: matchedTitles가 빈 배열이면 허용
			if (p.matchedTitles.length === 0) {
				return true;
			}

			// 날씨 컨텍스트 없는데 날씨 관련 제안 필터링
			if (!context.weather && this.#isWeatherRelated(p.reason)) {
				return false;
			}

			const uniqueTitles = new Set(p.matchedTitles);
			const isRepetition = uniqueTitles.size === 1;

			if (isRepetition) {
				return p.matchedTitles.length >= AI_SUGGESTION_LIMITS.MIN_OCCURRENCES;
			}
			return p.matchedTitles.length >= 2;
		});
	}

	/**
	 * reason 텍스트에서 날씨 관련 키워드 감지
	 */
	#isWeatherRelated(reason: string): boolean {
		const weatherKeywords = [
			"날씨",
			"비",
			"눈",
			"소나기",
			"우천",
			"실내",
			"악천후",
		];
		return weatherKeywords.some((keyword) => reason.includes(keyword));
	}

	/**
	 * 매칭된 투두의 최빈 카테고리 ID를 반환
	 */
	#findSuggestedCategoryId(
		matchedTitles: string[],
		todos: TodoSummaryForAnalysis[],
	): number | null {
		const matched = todos.filter((t) =>
			matchedTitles.some((mt) => t.title === mt),
		);

		if (matched.length === 0) {
			return null;
		}

		const freq = new Map<number, number>();
		for (const t of matched) {
			freq.set(t.categoryId, (freq.get(t.categoryId) ?? 0) + 1);
		}

		return [...freq.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
	}
}
