import { Injectable } from "@nestjs/common";

import { CreateRecurringTodosUseCase } from "@/todo";

import type {
	CreateRecurringTodoInput,
	RecurringTodoCreatorPort,
} from "../../application/ports/recurring-todo-creator.port";

/**
 * RecurringTodoCreatorPort의 어댑터.
 *
 * AI Suggestion의 계약을 Todo 반복 생성 UseCase에 연결한다.
 */
@Injectable()
export class RecurringTodoCreatorAdapter implements RecurringTodoCreatorPort {
	constructor(
		private readonly createRecurringTodosUseCase: CreateRecurringTodosUseCase,
	) {}

	async createRecurring(
		input: CreateRecurringTodoInput,
		timezone: string,
	): Promise<{ count: number }> {
		const result = await this.createRecurringTodosUseCase.execute({
			data: input,
			timezone,
		});
		return { count: result.count };
	}
}
