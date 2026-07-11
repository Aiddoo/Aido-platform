import { Injectable } from "@nestjs/common";

import { TodoFacade } from "@/todo";

import type {
	CreateRecurringTodoInput,
	RecurringTodoCreatorPort,
} from "../../application/ports/recurring-todo-creator.port";

/**
 * RecurringTodoCreatorPort의 어댑터.
 *
 * todo 모듈의 공개 계약(TodoFacade)에 위임하여 반복 할 일 생성을 수행한다.
 */
@Injectable()
export class RecurringTodoCreatorAdapter implements RecurringTodoCreatorPort {
	constructor(private readonly todoFacade: TodoFacade) {}

	async createRecurring(
		input: CreateRecurringTodoInput,
		timezone: string,
	): Promise<{ count: number }> {
		const result = await this.todoFacade.createRecurring(input, timezone);
		return { count: result.count };
	}
}
