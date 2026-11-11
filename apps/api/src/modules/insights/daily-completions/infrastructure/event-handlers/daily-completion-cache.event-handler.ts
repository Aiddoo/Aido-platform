import type { OnModuleInit } from "@nestjs/common";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import type { z } from "zod";

import {
  CATEGORY_CHANGE_EVENT_NAMES,
  categoryChangedPayloadSchema,
} from "#api/modules/planning/categories/planning-categories.public";
import {
  TODO_CHANGE_EVENT_NAMES,
  TODO_SERIES_CHANGE_EVENT_NAMES,
  todoChangedPayloadSchema,
  todoSeriesChangedPayloadSchema,
} from "#api/modules/planning/todos/planning-todos.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { defineEventSubscription } from "#api/shared/application/ports/domain-event-publisher.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { DailyCompletionLogEvent } from "../../application/daily-completions.log-events.js";
import type { DailyCompletionCachePort } from "../../application/ports/daily-completion-cache.port.js";

interface CacheOwnerPayload {
  readonly userId: string;
}

function cacheSubscription<TPayload extends CacheOwnerPayload>(
  eventName: string,
  payloadSchema: z.ZodType<TPayload>,
) {
  return defineEventSubscription({
    name: `insights.daily-completion-cache:${eventName}`,
    eventName,
    delivery: "after-commit",
    payloadSchema,
  });
}

// 할 일·회차·카테고리 사실이면 무엇이든 그날 집계(개수·색)를 바꿀 수 있어 planning이 내는 이름을 모두 받는다
export const DAILY_COMPLETION_CACHE_SUBSCRIPTIONS = [
  ...TODO_CHANGE_EVENT_NAMES.map((eventName) =>
    cacheSubscription(eventName, todoChangedPayloadSchema),
  ),
  ...TODO_SERIES_CHANGE_EVENT_NAMES.map((eventName) =>
    cacheSubscription(eventName, todoSeriesChangedPayloadSchema),
  ),
  ...CATEGORY_CHANGE_EVENT_NAMES.map((eventName) =>
    cacheSubscription(eventName, categoryChangedPayloadSchema),
  ),
];

export interface DailyCompletionCacheEventHandlerDependencies {
  readonly dailyCompletionCache: Pick<DailyCompletionCachePort, "invalidate">;
  readonly eventEmitter: Pick<EventEmitter2, "on">;
  readonly logger: Pick<ApplicationLoggerPort, "warn">;
}

/**
 * planning이 커밋한 변경을 받아 그 사용자의 일간 완료 캐시를 버린다. 캐시만 지우고 상태는 쓰지 않는다.
 * 실패하면 기록만 하고 다시 보내지 않는다(TTL이 지나면 맞아진다).
 */
export class DailyCompletionCacheEventHandler implements OnModuleInit {
  readonly #dependencies: DailyCompletionCacheEventHandlerDependencies;

  constructor(dependencies: DailyCompletionCacheEventHandlerDependencies) {
    this.#dependencies = dependencies;
  }

  onModuleInit(): void {
    for (const { name } of DAILY_COMPLETION_CACHE_SUBSCRIPTIONS) {
      this.#dependencies.eventEmitter.on(name, (payload: CacheOwnerPayload) =>
        this.handle(payload),
      );
    }
  }

  async handle(payload: CacheOwnerPayload): Promise<void> {
    try {
      await this.#dependencies.dailyCompletionCache.invalidate(UserId.reconstitute(payload.userId));
    } catch (error) {
      this.#dependencies.logger.warn({
        event: DailyCompletionLogEvent.CACHE_INVALIDATION_FAILED,
        userId: payload.userId,
        errorType: toErrorType(error),
      });
    }
  }
}
