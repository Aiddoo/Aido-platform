import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
	TODO_EVENTS,
	type TodoCategoryChangedEvent,
	type TodoCreatedEvent,
	type TodoDeletedEvent,
	type TodoRescheduledEvent,
	type TodoToggledEvent,
	type TodoUpdatedEvent,
	type TodoVisibilityChangedEvent,
} from "@/todo";
import {
	DAILY_COMPLETION_CACHE,
	type DailyCompletionCachePort,
} from "../ports/daily-completion-cache.port";

/** 일별 완료 캐시를 무효화해야 하는 투두 쓰기 이벤트의 합집합 */
type TodoWriteEvent =
	| TodoCreatedEvent
	| TodoDeletedEvent
	| TodoToggledEvent
	| TodoRescheduledEvent
	| TodoUpdatedEvent
	| TodoCategoryChangedEvent
	| TodoVisibilityChangedEvent;

/**
 * 투두 쓰기 이벤트 구독 → 일별 완료 캐시 무효화 핸들러
 *
 * 크로스모듈 결합은 도메인 이벤트 구독으로만 (todo 내부 호출 금지).
 * 무효화 실패는 로깅만 하고 삼킨다(fire-and-forget) — TTL이 staleness 백스톱.
 */
@Injectable()
export class DailyCompletionCacheInvalidator {
	readonly #logger = new Logger(DailyCompletionCacheInvalidator.name);

	constructor(
		@Inject(DAILY_COMPLETION_CACHE)
		private readonly cache: DailyCompletionCachePort,
	) {}

	// 주의: @OnEvent에 배열을 넘기면 EventEmitter2가 "다중 구독"이 아니라
	// 델리미터로 결합된 단일 이벤트명으로 해석한다. 이벤트별로 데코레이터를 쌓는다.
	@OnEvent(TODO_EVENTS.CREATED)
	@OnEvent(TODO_EVENTS.DELETED)
	@OnEvent(TODO_EVENTS.TOGGLED)
	@OnEvent(TODO_EVENTS.RESCHEDULED)
	@OnEvent(TODO_EVENTS.UPDATED)
	@OnEvent(TODO_EVENTS.CATEGORY_CHANGED)
	@OnEvent(TODO_EVENTS.VISIBILITY_CHANGED)
	async handle(event: TodoWriteEvent): Promise<void> {
		try {
			await this.cache.invalidate(event.userId);
		} catch (error) {
			this.#logger.error(
				`Failed to invalidate daily-completion cache for user ${event.userId}: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}
