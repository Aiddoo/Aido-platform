import type { Todo as TodoResponse } from "@aido/validators";
import type { CursorPaginatedResponse } from "@/shared/application/pagination";

export const TODO_CACHE = Symbol("TODO_CACHE");

/**
 * Todo 관련 캐시 포트 (cache 인프라 경계)
 *
 * 친구 공개 투두 캐시: 값은 소유자의 PUBLIC 첫 페이지이며 뷰어와 무관하게 공유됩니다
 * (권한 확인은 매 요청 수행). 날짜 세그먼트는 YYYY-MM-DD 또는 "-"(미지정)입니다.
 * reorder/title/item 쓰기는 도메인 이벤트를 발생시키지 않으므로
 * 이벤트 기반이 아닌 명시적 무효화(invalidateFriendTodos)가 필요합니다 —
 * 모든 쓰기 use-case가 TX 커밋 후 직접 호출합니다.
 */
export interface TodoCachePort {
	invalidateTodoCategories(userId: string): Promise<void>;

	/**
	 * 친구 공개 투두 첫 페이지 조회.
	 * 날짜 세그먼트는 YYYY-MM-DD 또는 "-"(미지정).
	 */
	getFriendTodosFirstPage(
		ownerUserId: string,
		startDate: string,
		endDate: string,
		size: number,
	): Promise<CursorPaginatedResponse<TodoResponse, number> | undefined>;

	/**
	 * 친구 공개 투두 첫 페이지 저장.
	 * 캐시 값은 소유자의 PUBLIC 첫 페이지(뷰어 무관 공유).
	 */
	setFriendTodosFirstPage(
		ownerUserId: string,
		startDate: string,
		endDate: string,
		size: number,
		page: CursorPaginatedResponse<TodoResponse, number>,
	): Promise<void>;

	/** 소유자의 친구 공개 투두 캐시 전체 무효화 (모든 날짜 범위·size 변형 포함). */
	invalidateFriendTodos(ownerUserId: string): Promise<void>;
}
