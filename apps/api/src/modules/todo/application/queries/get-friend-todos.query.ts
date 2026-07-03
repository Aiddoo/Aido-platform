import type { Todo as TodoResponse } from "@aido/validators";
import { Query } from "@nestjs/cqrs";
import type { CursorPaginatedResponse } from "@/common/pagination";
import type { GetFriendTodosParams } from "../../types/todo.types";

/**
 * 친구의 PUBLIC Todo 목록 조회 쿼리
 */
export class GetFriendTodosQuery extends Query<
	CursorPaginatedResponse<TodoResponse, number>
> {
	constructor(public readonly params: GetFriendTodosParams) {
		super();
	}
}
