import { AI_SUGGESTION_LIMITS, dayOfWeekSchema } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import dayjs from "dayjs";
import { z } from "zod";

import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import type { UserMutationLockPort } from "#api/modules/identity/identity-user-access.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { Suggestion } from "../../../domain/aggregates/suggestions/suggestion.aggregate.js";
import { AiSuggestionLogEvent } from "../../observability/suggestions/ai-suggestion-log.events.js";
import { type AiSuggestionRepositoryPort } from "../../ports/suggestions/ai-suggestion.repository.port.js";
import { type RecurringTodoCreatorPort } from "../../ports/suggestions/recurring-todo-creator.port.js";

export interface HandleSuggestionActionInput {
  readonly userId: string;
  readonly suggestionId: number;
  readonly action: "accept" | "dismiss";
  readonly categoryId?: number;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly timezone: string;
}

/** 제안 수락/거절 결과 read model */
export interface SuggestionActionResult {
  readonly message: string;
  readonly suggestion: Suggestion;
  readonly createdTodosCount?: number;
}

/**
 * 제안 수락/거절 처리 use-case.
 *
 * 사용자 잠금과 최신 권한 확인 뒤 도메인 상태를 전이한다.
 * 상태 저장과 반복 할 일 생성은 한 transaction에서 성공하거나 함께 rollback된다.
 */
interface HandleSuggestionActionDependencies {
  readonly repository: Pick<AiSuggestionRepositoryPort, "findByIdAndUserId" | "updateStatus">;
  readonly recurringTodoCreator: Pick<RecurringTodoCreatorPort, "createRecurring">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "hasPremiumAccessInTx">;
  readonly logger: Pick<ApplicationLogger, "log" | "warn">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly userMutationLock: Pick<UserMutationLockPort, "lockById">;
}

export class HandleSuggestionAction {
  readonly #dependencies: HandleSuggestionActionDependencies;

  constructor(dependencies: HandleSuggestionActionDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: HandleSuggestionActionInput): Promise<SuggestionActionResult> {
    const result = await this.#dependencies.unitOfWork.run(async () => {
      if (!(await this.#dependencies.userMutationLock.lockById(input.userId))) {
        throw new ApplicationException(ErrorCode.AI_1309);
      }
      await this.#enforcePremium(input.userId);
      const suggestion = await this.#dependencies.repository.findByIdAndUserId(
        input.suggestionId,
        input.userId,
      );
      if (suggestion === null) {
        throw new ApplicationException(ErrorCode.AI_1305, { suggestionId: input.suggestionId });
      }
      const at = now();
      if (input.action === "dismiss") {
        suggestion.dismiss(at);
        const updated = await this.#dependencies.repository.updateStatus(
          input.suggestionId,
          suggestion.status,
        );
        return { message: "제안이 거절되었습니다.", suggestion: updated };
      }

      // 상태·만료 오류가 요청의 수락 데이터 오류보다 먼저 반환되는 계약을 유지한다.
      suggestion.accept(at);
      if (input.categoryId === undefined || input.categoryId === 0) {
        throw new ApplicationException(ErrorCode.SYS_0002, {
          field: "categoryId",
          reason: "수락 시 categoryId는 필수입니다",
        });
      }
      const days = z.array(dayOfWeekSchema).safeParse(suggestion.daysOfWeek);
      if (!days.success) {
        throw new ApplicationException(ErrorCode.SYS_0002, {
          field: "daysOfWeek",
          reason: "제안의 요일 데이터가 유효하지 않습니다",
        });
      }
      const currentDate = dayjs.utc(at);
      const startDate = input.startDate ?? toDateString(currentDate.toDate());
      const endDate =
        input.endDate ??
        toDateString(
          currentDate.add(AI_SUGGESTION_LIMITS.DEFAULT_RECURRING_WEEKS, "week").toDate(),
        );
      const updated = await this.#dependencies.repository.updateStatus(
        input.suggestionId,
        suggestion.status,
      );
      // 반복 생성은 같은 Required UoW에 참여하며 실패 시 상태 갱신도 함께 rollback된다.
      const created = await this.#dependencies.recurringTodoCreator.createRecurring(
        {
          userId: input.userId,
          title: suggestion.title,
          categoryId: input.categoryId,
          startDate,
          endDate,
          daysOfWeek: days.data,
          scheduledTime: suggestion.scheduledTime,
        },
        input.timezone,
      );
      return {
        message: "제안이 수락되어 반복 할 일이 생성되었습니다.",
        suggestion: updated,
        createdTodosCount: created.count,
      };
    });
    if (result.createdTodosCount !== undefined) {
      this.#dependencies.logger.log({
        event: AiSuggestionLogEvent.ACCEPTED,
        suggestionId: input.suggestionId,
        userId: input.userId,
        createdTodosCount: result.createdTodosCount,
      });
    }
    return result;
  }

  async #enforcePremium(userId: string): Promise<void> {
    if (!(await this.#dependencies.entitlementReader.hasPremiumAccessInTx(userId))) {
      this.#dependencies.logger.warn({ event: AiSuggestionLogEvent.PREMIUM_DENIED, userId });
      throw new ApplicationException(ErrorCode.AI_1309);
    }
  }
}
