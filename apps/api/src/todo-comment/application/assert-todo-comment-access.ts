import { ErrorCode } from "@aido/errors";

import { ApplicationException } from "@/shared/domain";

import type { TodoCommentRepositoryPort } from "./ports/todo-comment.repository.port";

export async function assertTodoCommentAccess(
	repository: TodoCommentRepositoryPort,
	todoId: number,
	viewerId: string,
): Promise<void> {
	const canAccess = await repository.canAccessTodo(todoId, viewerId);

	if (!canAccess) {
		throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
	}
}
