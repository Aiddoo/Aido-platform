import {
	AI_SUGGESTION_LIMITS,
	dayOfWeekSchema,
	type RecurringSuggestion as RecurringSuggestionDto,
	type SuggestionActionResponse,
} from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import dayjs from "dayjs";
import { z } from "zod";
import { AI_PROVIDER, type AiProvider } from "@/ai";
import type { Prisma } from "@/generated/prisma/client";
import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import { BusinessExceptions } from "@/shared/application/exceptions/business-exception.service";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { now } from "@/shared/domain/date/utils/core";
import { toDateString } from "@/shared/domain/date/utils/format";
import type { SupportedLocale } from "@/shared/presentation/decorators";
import { CreateRecurringTodosCommand } from "../todo";
import { AiSuggestionMapper } from "./ai-suggestion.mapper";
import { AiSuggestionRepository } from "./ai-suggestion.repository";
import type { SuggestionActionDto } from "./dtos";
import {
	buildSuggestionPrompt,
	getDetectedPatternsSchema,
} from "./prompts/detect-patterns.prompt";
import { SuggestionContextBuilder } from "./suggestion-context.builder";
import { resolveSuggestedCategoryId } from "./utils/category-resolver.util";
import {
	applyTypeCap,
	dedupeByTitlePrefixAndDays,
	filterWeakPatterns,
	mergeUniquePatterns,
} from "./utils/pattern-filter.util";

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
		private readonly commandBus: CommandBus,
		@Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
		private readonly entitlementService: EntitlementService,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
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
			const result = await this.commandBus.execute(
				new CreateRecurringTodosCommand(
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
				),
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
			this.#logger.warn(`프리미엄 미구독 접근 차단: userId=${userId}`);
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
		weatherGrid?: {
			gridX: number;
			gridY: number;
			lat: number;
			lon: number;
		} | null,
		locale: SupportedLocale = "ko",
	): Promise<number> {
		// 1. 컨텍스트 수집 (통계 분석 + 투두 조회 + 날씨)
		const context = await this.contextBuilder.build(
			userId,
			timezone,
			weatherGrid ?? null,
		);

		if (context.todos.length < AI_SUGGESTION_LIMITS.MIN_OCCURRENCES) {
			this.#logger.debug(
				`제안 분석 스킵: userId=${userId}, todoCount=${context.todos.length} (최소 ${AI_SUGGESTION_LIMITS.MIN_OCCURRENCES}개 필요)`,
			);
			return 0;
		}

		// 2. AI 제안 생성 — 제안 수 부족 시 1회 다양성 재시도
		const { system, prompt } = buildSuggestionPrompt(
			context,
			AI_SUGGESTION_LIMITS.MIN_REPEAT_OCCURRENCES,
			locale,
		);
		const patternsSchema = getDetectedPatternsSchema(locale);

		const firstResult = await this.aiProvider.generateStructured({
			system,
			prompt,
			schema: patternsSchema,
			maxOutputTokens: 1500,
			temperature: 0.3,
		});

		let patterns = filterWeakPatterns(firstResult.output.patterns, context);

		if (patterns.length < AI_SUGGESTION_LIMITS.RETRY_THRESHOLD) {
			this.#logger.debug(
				`제안 수 부족 → 재시도: userId=${userId}, first=${patterns.length}`,
			);
			const retryResult = await this.aiProvider.generateStructured({
				system,
				prompt,
				schema: patternsSchema,
				maxOutputTokens: 1500,
				temperature: AI_SUGGESTION_LIMITS.RETRY_TEMPERATURE,
			});
			const retryPatterns = filterWeakPatterns(
				retryResult.output.patterns,
				context,
			);
			patterns = mergeUniquePatterns(patterns, retryPatterns);
		}

		patterns = applyTypeCap(patterns);
		patterns = dedupeByTitlePrefixAndDays(patterns);

		if (patterns.length === 0) {
			this.#logger.debug(`패턴 미감지: userId=${userId}`);
			return 0;
		}

		// 3. 기존 PENDING 교체 + 만료 정리 + 새 제안 저장 (트랜잭션)
		const currentDate = dayjs.utc(now());
		const expiresAt = currentDate
			.add(AI_SUGGESTION_LIMITS.SUGGESTION_EXPIRY_DAYS, "day")
			.toDate();

		// 신뢰도 내림차순 정렬 후 상한 적용 (Gemini review 반영)
		const limitedPatterns = [...patterns]
			.sort((a, b) => b.confidence - a.confidence)
			.slice(0, AI_SUGGESTION_LIMITS.MAX_SUGGESTIONS_PER_USER);

		const createdCount = await this.uow.run(async () => {
			await this.aiSuggestionRepository.deletePending(userId);
			await this.aiSuggestionRepository.deleteExpired(userId);

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
					suggestedCategoryId: resolveSuggestedCategoryId(
						pattern.title,
						pattern.matchedTitles,
						context.todos,
					),
				})),
			);
			return count;
		});

		this.#logger.log(
			`제안 생성 완료: userId=${userId}, patterns=${patterns.length}, created=${createdCount}`,
		);

		return createdCount;
	}
}
