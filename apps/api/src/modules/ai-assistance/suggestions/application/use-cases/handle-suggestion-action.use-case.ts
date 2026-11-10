import { ErrorCode } from "@aido/api/errors";
import { AI_SUGGESTION_LIMITS } from "@aido/api/vocabulary";

import {
  type EntitlementReaderPort,
  premiumFeatureDenied,
} from "#api/modules/access/entitlements/access-entitlements.public";
import type { UserMutationLockPort } from "#api/modules/identity/identity-user-access.public";
import { TodoCategoryLockKeys } from "#api/modules/planning/categories/planning-categories.public";
import {
  type StagedTodoCreatorPort,
  TodoLockKeys,
} from "#api/modules/planning/todos/planning-todos.public";
import { ApplicationException } from "#api/shared/application/application.exception";
import type { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserLocalePreferenceReaderPort } from "../../../generation/application/ports/user-locale-preference.reader.port.js";
import { dateColumnOf, localDateAt } from "../../../shared/domain/user-calendar.domain-service.js";
import { SuggestionId } from "../../domain/suggestion-id.vo.js";
import type { Suggestion } from "../../domain/suggestion.aggregate.js";
import type { SuggestionAction } from "../../domain/suggestion.constants.js";
import { AiSuggestionLogEvent } from "../ai-suggestion.log-events.js";
import type { SuggestionRepositoryPort } from "../ports/suggestion.repository.port.js";
import { suggestionNotFound } from "../suggestions.errors.js";

export interface HandleSuggestionActionCommand {
  readonly userId: string;
  readonly suggestionId: number;
  readonly action: SuggestionAction;
  readonly categoryId?: number;
  readonly startDate?: string;
  readonly endDate?: string;
  /** X-Timezone 헤더. 없으면 저장된 사용자 시간대를 쓴다. */
  readonly timezone: string | undefined;
}

/** 처리한 제안. 수락이면 만든 반복 할 일 수가 함께 온다 */
export interface SuggestionActionResult {
  readonly suggestion: Suggestion;
  readonly createdTodosCount: number | null;
}

interface HandleSuggestionActionDependencies {
  readonly repository: Pick<SuggestionRepositoryPort, "findByIdAndUserId" | "save">;
  readonly todoCreator: Pick<StagedTodoCreatorPort, "stage">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "canInTx">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly userMutationLock: Pick<UserMutationLockPort, "lockById">;
  readonly mutationLock: Pick<MutationLockPort, "acquire">;
  readonly afterCommit: Pick<AfterCommitTaskRegistryPort, "register">;
  readonly localePreferenceReader: Pick<UserLocalePreferenceReaderPort, "read">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

/**
 * 제안 수락/거절. 사용자 잠금과 최신 권한 확인 뒤 상태를 전이한다.
 * 상태 저장과 반복 할 일 생성은 한 transaction에서 성공하거나 함께 rollback되고,
 * 할 일 알림·캐시 효과는 커밋 뒤에만 실행된다.
 */
export class HandleSuggestionActionUseCase {
  readonly #dependencies: HandleSuggestionActionDependencies;

  constructor(dependencies: HandleSuggestionActionDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: HandleSuggestionActionCommand): Promise<SuggestionActionResult> {
    const owner = UserId.reconstitute(command.userId);
    const timezone =
      command.timezone ?? (await this.#dependencies.localePreferenceReader.read(owner)).timezone;
    const result = await this.#dependencies.unitOfWork.run(async () => {
      if (!(await this.#dependencies.userMutationLock.lockById(command.userId))) {
        throw new ApplicationException(ErrorCode.AI_1309);
      }
      await this.#enforcePremium(command.userId);
      const suggestionId = SuggestionId.reconstitute(command.suggestionId);
      const suggestion = await this.#dependencies.repository.findByIdAndUserId(suggestionId, owner);
      if (suggestion == null) {
        throw suggestionNotFound(suggestionId);
      }
      const now = this.#dependencies.clock.now();
      if (command.action === "dismiss") {
        suggestion.dismiss(now);
        await this.#dependencies.repository.save(suggestion);
        return { suggestion, createdTodosCount: null };
      }
      return this.#accept(command, suggestion, { now, timezone });
    });
    if (result.createdTodosCount != null) {
      this.#dependencies.logger.log({
        event: AiSuggestionLogEvent.ACCEPTED,
        suggestionId: command.suggestionId,
        userId: command.userId,
        createdTodosCount: result.createdTodosCount,
      });
    }
    return result;
  }

  async #accept(
    command: HandleSuggestionActionCommand,
    suggestion: Suggestion,
    at: { readonly now: Temporal.Instant; readonly timezone: string },
  ): Promise<SuggestionActionResult> {
    // 상태·만료 오류가 요청의 수락 데이터 오류보다 먼저 반환되는 계약을 유지한다.
    suggestion.accept(at.now);
    if (command.categoryId == null || command.categoryId === 0) {
      throw new ApplicationException(ErrorCode.SYS_0002, {
        field: "categoryId",
        reason: "수락 시 categoryId는 필수입니다",
      });
    }
    const weekdays = suggestion.daysOfWeek;
    if (weekdays == null) {
      throw new ApplicationException(ErrorCode.SYS_0002, {
        field: "daysOfWeek",
        reason: "제안의 요일 데이터가 유효하지 않습니다",
      });
    }
    // 반복은 사용자 로컬 "오늘"부터 시작해야 KST 새벽·미주 저녁 수락이 하루 밀리지 않는다.
    const localToday = localDateAt(at.now, at.timezone);
    const startDate = command.startDate ?? localToday.toString();
    const endDate =
      command.endDate ??
      localToday.add({ weeks: AI_SUGGESTION_LIMITS.DEFAULT_RECURRING_WEEKS }).toString();
    await this.#dependencies.repository.save(suggestion);
    await this.#dependencies.mutationLock.acquire([
      TodoCategoryLockKeys.userCategories(command.userId),
      TodoLockKeys.sortOrder(command.userId),
    ]);
    // 같은 UoW에 참여하므로 생성이 실패하면 상태 갱신도 함께 rollback된다.
    const staged = await this.#dependencies.todoCreator.stage({
      userId: command.userId,
      title: suggestion.title,
      categoryId: command.categoryId,
      startDate: dateColumnOf(Temporal.PlainDate.from(startDate)),
      scheduledTime: suggestion.scheduledTime,
      timezone: at.timezone,
      repeat: {
        frequency: "WEEKLY",
        interval: 1,
        weekdays: [...weekdays],
        end: { type: "UNTIL", date: endDate },
      },
      // 제안은 기간이 정해진 반복이고 출시 앱도 쓰는 경로라 옛 서버에 없던 상한으로 거절하지 않는다
      usesLegacySeriesLimit: true,
    });
    this.#dependencies.afterCommit.register(staged.afterCommit);
    return { suggestion, createdTodosCount: staged.todos.length };
  }

  async #enforcePremium(userId: string): Promise<void> {
    if (!(await this.#dependencies.entitlementReader.canInTx(userId, "AI_SUGGESTION"))) {
      this.#dependencies.logger.warn({ event: AiSuggestionLogEvent.PREMIUM_DENIED, userId });
      throw premiumFeatureDenied("AI_SUGGESTION");
    }
  }
}
