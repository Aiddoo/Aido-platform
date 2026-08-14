import { ErrorCode } from "@aido/errors";
import { AI_SUGGESTION_LIMITS, dayOfWeekSchema } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import dayjs from "dayjs";
import { z } from "zod";

import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import { now } from "@/shared/domain/date/utils/core";
import { toDateString } from "@/shared/domain/date/utils/format";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import type { Suggestion } from "../../../domain/entities/suggestion.aggregate";
import {
	AI_SUGGESTION_REPOSITORY,
	type AiSuggestionRepositoryPort,
} from "../../ports/ai-suggestion.repository.port";
import {
	RECURRING_TODO_CREATOR,
	type RecurringTodoCreatorPort,
} from "../../ports/recurring-todo-creator.port";

export interface HandleSuggestionActionInput {
	userId: string;
	suggestionId: number;
	action: "accept" | "dismiss";
	categoryId?: number;
	startDate?: string;
	endDate?: string;
	timezone: string;
}

/** 제안 수락/거절 결과 read model */
export interface SuggestionActionResult {
	message: string;
	suggestion: Suggestion;
	createdTodosCount?: number;
}

/**
 * 제안 수락/거절 처리 use-case.
 *
 * 프리미엄 강제 → 제안 조회 → 상태 전이 불변식(대기·미만료) 검증 후, 거절은 상태만
 * 갱신하고, 수락은 ACCEPTED 선반영 후 반복 할 일을 생성한다. 생성 실패 시 PENDING으로
 * best-effort 롤백한다(롤백 실패는 로그만 남기고 원본 에러를 전파).
 */
@Injectable()
export class HandleSuggestionActionUseCase {
	readonly #logger = new Logger(HandleSuggestionActionUseCase.name);

	constructor(
		@Inject(AI_SUGGESTION_REPOSITORY)
		private readonly repository: AiSuggestionRepositoryPort,
		@Inject(RECURRING_TODO_CREATOR)
		private readonly recurringTodoCreator: RecurringTodoCreatorPort,
		private readonly entitlementService: EntitlementService,
	) {}

	async execute(
		input: HandleSuggestionActionInput,
	): Promise<SuggestionActionResult> {
		await this.#enforcePremium(input.userId);

		// 1. 제안 조회
		const suggestion = await this.repository.findByIdAndUserId(
			input.suggestionId,
			input.userId,
		);
		if (!suggestion) {
			throw new ApplicationException(ErrorCode.AI_1305, {
				suggestionId: input.suggestionId,
			});
		}

		// 2. 상태·만료 불변식 검증 (AI_1306 / AI_1307)
		suggestion.ensureActionable(now());

		// 3. 거절 처리
		if (input.action === "dismiss") {
			const updated = await this.repository.updateStatus(
				input.suggestionId,
				"DISMISSED",
			);
			return {
				message: "제안이 거절되었습니다.",
				suggestion: updated,
			};
		}

		// 4. 수락 처리: categoryId 필수 검증
		if (!input.categoryId) {
			throw new ApplicationException(ErrorCode.SYS_0002, {
				field: "categoryId",
				reason: "수락 시 categoryId는 필수입니다",
			});
		}

		const daysOfWeekResult = z
			.array(dayOfWeekSchema)
			.safeParse(suggestion.daysOfWeek);
		if (!daysOfWeekResult.success) {
			throw new ApplicationException(ErrorCode.SYS_0002, {
				field: "daysOfWeek",
				reason: "제안의 요일 데이터가 유효하지 않습니다",
			});
		}
		const daysOfWeek = daysOfWeekResult.data;
		const currentDate = dayjs.utc(now());
		const startDate = input.startDate ?? toDateString(currentDate.toDate());
		const endDate =
			input.endDate ??
			toDateString(
				currentDate
					.add(AI_SUGGESTION_LIMITS.DEFAULT_RECURRING_WEEKS, "week")
					.toDate(),
			);

		// 상태를 먼저 ACCEPTED로 변경 (재수락 방지)
		const updated = await this.repository.updateStatus(
			input.suggestionId,
			"ACCEPTED",
		);

		try {
			const result = await this.recurringTodoCreator.createRecurring(
				{
					userId: input.userId,
					title: suggestion.title,
					categoryId: input.categoryId,
					startDate,
					endDate,
					daysOfWeek,
					scheduledTime: suggestion.scheduledTime,
				},
				input.timezone,
			);

			this.#logger.log(
				`제안 수락: id=${input.suggestionId}, userId=${input.userId}, createdTodos=${result.count}`,
			);

			return {
				message: "제안이 수락되어 반복 할 일이 생성되었습니다.",
				suggestion: updated,
				createdTodosCount: result.count,
			};
		} catch (error) {
			// 투두 생성 실패 시 상태를 PENDING으로 롤백
			try {
				await this.repository.updateStatus(input.suggestionId, "PENDING");
			} catch (rollbackError) {
				this.#logger.error(
					`제안 롤백 실패: id=${input.suggestionId}, rollbackError=${rollbackError}`,
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
			throw new ApplicationException(ErrorCode.AI_1309);
		}
	}
}
