import type { Todo as TodoResponse } from "@aido/validators";
import { Command } from "@nestjs/cqrs";
import type { CreateTodoData } from "../../types";

/**
 * Todo 생성 커맨드
 */
export class CreateTodoCommand extends Command<TodoResponse> {
	constructor(public readonly data: CreateTodoData) {
		super();
	}
}
