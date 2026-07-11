/**
 * Todo 모듈 공개 API
 *
 * 공개 계약 = Facade + 도메인 이벤트(구독용) + DTO.
 * 외부 모듈은 TodoFacade를 주입해 사용하고, 크로스 모듈 부수효과는
 * 도메인 이벤트(@OnEvent) 구독으로 연결합니다. use-case·리포지토리·포트는
 * 내부 구현으로 공개하지 않습니다.
 */
export { TodoFacade } from "./application/facades/todo.facade";
export type { CreateRecurringTodosResult } from "./application/use-cases/create-recurring-todos/create-recurring-todos.use-case";
export * from "./domain/events/todo-created.event";
export * from "./domain/events/todo-deleted.event";
export * from "./domain/events/todo-event-names";
export * from "./domain/events/todo-rescheduled.event";
export * from "./domain/events/todo-toggled.event";
export * from "./domain/events/todo-updated.event";
export * from "./presentation/dtos";
export * from "./todo.module";
