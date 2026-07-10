import type { Todo as TodoResponse } from "@aido/validators";
import { Query } from "@nestjs/cqrs";
import type { CursorPaginatedResponse } from "@/shared/application/pagination";
import type { GetTodosParams } from "../../types";

/**
 * Todo 목록 조회 쿼리 (커서 기반 페이지네이션)
 */
export class GetTodosQuery extends Query<
	CursorPaginatedResponse<TodoResponse, number>
> {
	constructor(public readonly params: GetTodosParams) {
		super();
	}
}
