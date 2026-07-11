import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
	TODO_EVENTS,
	type TodoCreatedEvent,
	type TodoDeletedEvent,
	type TodoRescheduledEvent,
	type TodoToggledEvent,
	type TodoUpdatedEvent,
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
	| TodoUpdatedEvent;

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

	@OnEvent([
		TODO_EVENTS.CREATED,
		TODO_EVENTS.DELETED,
		TODO_EVENTS.TOGGLED,
		TODO_EVENTS.RESCHEDULED,
		TODO_EVENTS.UPDATED,
	])
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
