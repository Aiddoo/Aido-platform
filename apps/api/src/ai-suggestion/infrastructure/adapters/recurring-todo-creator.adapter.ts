import { Injectable } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";

import { CreateRecurringTodosCommand } from "@/todo";

import type {
	CreateRecurringTodoInput,
	RecurringTodoCreatorPort,
} from "../../application/ports/recurring-todo-creator.port";

/**
 * RecurringTodoCreatorPort의 어댑터.
 *
 * todo 모듈의 공개 계약(CreateRecurringTodosCommand)을 CommandBus로 디스패치하여
 * 반복 할 일 생성을 위임한다.
 */
@Injectable()
export class RecurringTodoCreatorAdapter implements RecurringTodoCreatorPort {
	constructor(private readonly commandBus: CommandBus) {}

	async createRecurring(
		input: CreateRecurringTodoInput,
		timezone: string,
	): Promise<{ count: number }> {
		const result = await this.commandBus.execute(
			new CreateRecurringTodosCommand(input, timezone),
		);
		return { count: result.count };
	}
}
