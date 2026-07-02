import { TodoCreatedHandler } from "./todo-created.handler";
import { TodoToggledHandler } from "./todo-toggled.handler";

export * from "./todo-created.handler";
export * from "./todo-toggled.handler";

/** 모듈 등록용 도메인 이벤트 핸들러 목록 */
export const EventHandlers = [TodoCreatedHandler, TodoToggledHandler];
