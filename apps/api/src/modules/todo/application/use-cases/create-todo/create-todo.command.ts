import type { CreateTodoData } from "../../../types/todo.types";

/**
 * Todo 생성 커맨드
 */
export class CreateTodoCommand {
	constructor(public readonly data: CreateTodoData) {}
}
