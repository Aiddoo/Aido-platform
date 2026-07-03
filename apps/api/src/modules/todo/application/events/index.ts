import { TodoCreatedHandler } from "./todo-created.handler";
import { TodoDeletedHandler } from "./todo-deleted.handler";
import { TodoRescheduledHandler } from "./todo-rescheduled.handler";
import { TodoToggledHandler } from "./todo-toggled.handler";
import { TodoUpdatedHandler } from "./todo-updated.handler";

export * from "./todo-created.handler";
export * from "./todo-deleted.handler";
export * from "./todo-rescheduled.handler";
export * from "./todo-toggled.handler";
export * from "./todo-updated.handler";

/** 모듈 등록용 도메인 이벤트 핸들러 목록 */
export const EventHandlers = [
	TodoCreatedHandler,
	TodoDeletedHandler,
	TodoRescheduledHandler,
	TodoToggledHandler,
	TodoUpdatedHandler,
];
