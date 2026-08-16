export const TODO_VIEW_CACHE = Symbol("TODO_VIEW_CACHE");

/**
 * 댓글 수가 바뀌면 할 일 목록 캐시도 낡는다.
 *
 * 댓글 작성·삭제는 `Todo.commentCount`를 바꾸는데, 친구 목록은 그 값을 담은 채로
 * 60초간 캐싱된다. 그 캐시를 지우는 건 todo 모듈의 몫이므로 이쪽은 "낡았다"만 알린다 —
 * 어느 키인지, 소유자가 누구인지는 알 필요도 없고 알아서도 안 된다.
 */
export interface TodoViewCachePort {
	invalidateForTodo(todoId: number): Promise<void>;
}
