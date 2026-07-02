import type { GetTodosParams } from "../../types/todo.types";

/**
 * Todo 목록 조회 쿼리 (커서 기반 페이지네이션)
 */
export class GetTodosQuery {
	constructor(public readonly params: GetTodosParams) {}
}
