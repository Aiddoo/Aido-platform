/**
 * Todo 도메인 이벤트 라우팅 키
 *
 * EventEmitter2 채널명이자 각 이벤트 클래스의 `eventName` 값입니다.
 * 구독 측(@OnEvent)과 발행 측이 이 상수만 공유합니다.
 */
export const TODO_EVENTS = {
	CREATED: "todo.created",
	UPDATED: "todo.updated",
	DELETED: "todo.deleted",
	TOGGLED: "todo.toggled",
	RESCHEDULED: "todo.rescheduled",
} as const;
