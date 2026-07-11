import { AI_SUGGESTION_LIMITS } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import dayjs from "dayjs";

import { AI_PROVIDER, type AiProvider } from "@/ai";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { now } from "@/shared/domain/date/utils/core";
import type { SupportedLocale } from "@/shared/presentation/decorators";
import type { GridInput } from "@/weather";

import { resolveSuggestedCategoryId } from "../../../domain/services/category-resolver";
import {
	applyTypeCap,
	dedupeByTitlePrefixAndDays,
	filterWeakPatterns,
	mergeUniquePatterns,
} from "../../../domain/services/pattern-filter";
import {
	buildSuggestionPrompt,
	getDetectedPatternsSchema,
} from "../../../domain/services/prompts/detect-patterns.prompt";
import {
	AI_SUGGESTION_REPOSITORY,
	type AiSuggestionRepositoryPort,
} from "../../ports/ai-suggestion.repository.port";
import { SuggestionContextBuilder } from "../../services/suggestion-context.builder";

/**
 * 사용자의 최근 할 일을 분석하여 반복 제안을 생성하는 use-case.
 *
 * 컨텍스트 수집 → 최소 할 일 수 게이트 → AI 패턴 감지(부족 시 1회 다양성 재시도) →
 * 약패턴 필터·유형 캡·중복 제거 → 트랜잭션 내 기존 PENDING 교체·만료 정리·신규 저장.
 * 프리미엄 게이트가 없다(크론/프로세서 경로에서 호출).
 */
@Injectable()
export class AnalyzeAndCreateSuggestionsUseCase {
	readonly #logger = new Logger(AnalyzeAndCreateSuggestionsUseCase.name);

	constructor(
		@Inject(AI_SUGGESTION_REPOSITORY)
		private readonly repository: AiSuggestionRepositoryPort,
		@Inject(AI_PROVIDER)
		private readonly aiProvider: AiProvider,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
		private readonly contextBuilder: SuggestionContextBuilder,
	) {}

	async execute(
		userId: string,
		timezone: string,
		weatherGrid?: GridInput | null,
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
			await this.repository.deletePending(userId);
			await this.repository.deleteExpired(userId);

			const { count } = await this.repository.createMany(
				limitedPatterns.map((pattern) => ({
					userId,
					title: pattern.title,
					daysOfWeek: pattern.daysOfWeek,
					scheduledTime: pattern.scheduledTime,
					confidence: pattern.confidence,
					reason: pattern.reason,
					matchedTodos: pattern.matchedTitles,
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
