import {
	AI_SUGGESTION_LIMITS,
	type RecurringSuggestion as RecurringSuggestionDto,
	type SuggestionActionResponse,
} from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import dayjs from "dayjs";
import { now } from "@/common/date/utils/core";
import { toDateString } from "@/common/date/utils/format";
import { EntitlementService } from "@/common/entitlement/entitlement.service";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import type { Prisma } from "@/generated/prisma/client";
import { AI_PROVIDER, type AiProvider } from "../ai/providers/ai.provider";
import { TodoService } from "../todo/todo.service";
import { AiSuggestionMapper } from "./ai-suggestion.mapper";
import { AiSuggestionRepository } from "./ai-suggestion.repository";
import type { SuggestionActionDto } from "./dtos";
import {
	buildDetectPatternsPrompt,
	detectedPatternsSchema,
} from "./prompts/detect-patterns.prompt";

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
	) {}

	// =========================================================================
	// 조회
	// =========================================================================

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

	// =========================================================================
	// 액션 (수락/거절)
	// =========================================================================

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

		const daysOfWeek = suggestion.daysOfWeek as unknown as string[];
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
					daysOfWeek: daysOfWeek as never,
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
			await this.aiSuggestionRepository.updateStatus(suggestionId, "PENDING");
			throw error;
		}
	}

	async #enforcePremium(userId: string): Promise<void> {
		const hasPremium = await this.entitlementService.hasPremiumAccess(userId);
		if (!hasPremium) {
			throw BusinessExceptions.aiSuggestionPremiumRequired();
		}
	}

	// =========================================================================
	// 패턴 분석 및 제안 생성
	// =========================================================================

	/**
	 * 사용자의 최근 할 일을 분석하여 반복 제안을 생성합니다.
	 *
	 * @returns 생성된 제안 수
	 */
	async analyzeAndCreateSuggestions(userId: string): Promise<number> {
		const currentDate = dayjs.utc(now());
		const from = currentDate
			.subtract(AI_SUGGESTION_LIMITS.ANALYSIS_WEEKS, "week")
			.toDate();
		const to = currentDate.toDate();

		// 1. 최근 할 일 조회
		const todos = await this.aiSuggestionRepository.findRecentTodos(
			userId,
			from,
			to,
		);

		if (todos.length < AI_SUGGESTION_LIMITS.MIN_OCCURRENCES) {
			this.#logger.debug(
				`제안 분석 스킵: userId=${userId}, todoCount=${todos.length} (최소 ${AI_SUGGESTION_LIMITS.MIN_OCCURRENCES}개 필요)`,
			);
			return 0;
		}

		// 2. AI 패턴 감지
		const prompt = buildDetectPatternsPrompt(
			todos,
			AI_SUGGESTION_LIMITS.MIN_OCCURRENCES,
		);

		const aiResult = await this.aiProvider.generateStructured({
			prompt,
			schema: detectedPatternsSchema,
			maxTokens: 1000,
			temperature: 0.3,
		});

		const { patterns } = aiResult.output;

		if (patterns.length === 0) {
			this.#logger.debug(`패턴 미감지: userId=${userId}`);
			return 0;
		}

		// 3. 기존 PENDING 제안 제목 조회 (중복 방지)
		const existingTitles =
			await this.aiSuggestionRepository.findPendingTitles(userId);

		// 4. 만료된 제안 삭제
		await this.aiSuggestionRepository.deleteExpired(userId);

		// 5. 새 제안 저장 (최대 5개, 중복 제외)
		const expiresAt = currentDate
			.add(AI_SUGGESTION_LIMITS.SUGGESTION_EXPIRY_DAYS, "day")
			.toDate();

		let createdCount = 0;
		for (const pattern of patterns) {
			if (createdCount >= AI_SUGGESTION_LIMITS.MAX_SUGGESTIONS_PER_USER) {
				break;
			}

			if (existingTitles.has(pattern.title)) {
				continue;
			}

			await this.aiSuggestionRepository.create({
				user: { connect: { id: userId } },
				title: pattern.title,
				daysOfWeek: pattern.daysOfWeek as unknown as Prisma.InputJsonValue,
				scheduledTime: pattern.scheduledTime,
				confidence: pattern.confidence,
				reason: pattern.reason,
				matchedTodos: pattern.matchedTitles as unknown as Prisma.InputJsonValue,
				expiresAt,
			});

			createdCount++;
		}

		this.#logger.log(
			`제안 생성 완료: userId=${userId}, patterns=${patterns.length}, created=${createdCount}`,
		);

		return createdCount;
	}
}
