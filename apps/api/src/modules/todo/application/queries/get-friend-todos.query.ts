import type { GetFriendTodosParams } from "../../types/todo.types";

/**
 * 친구의 PUBLIC Todo 목록 조회 쿼리
 */
export class GetFriendTodosQuery {
	constructor(public readonly params: GetFriendTodosParams) {}
}
