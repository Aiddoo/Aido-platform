import type { TodoCachePort } from "../ports/todo-cache.port";
import type { TodoReadRepositoryPort } from "../ports/todo-read.repository.port";

/**
 * 다른 모듈이 쓰는 최소 capability — "이 할 일의 목록 캐시를 버려라".
 *
 * 친구 목록만 캐시가 있고(첫 페이지 60초), 그 키는 **소유자 기준**이다.
 * 소유자가 누구인지는 todo 모듈의 지식이므로, 부르는 쪽은 todoId만 알면 된다.
 *
 * 캐시 포트 자체를 공개하지 않는 이유: 인프라 구현을 밖으로 내보내지 않는다는
 * 모듈 경계 규칙(todo/index.ts) 때문이다.
 */
export class TodoViewCacheInvalidator {
	constructor(
		private readonly todoReadRepository: TodoReadRepositoryPort,
		private readonly cache: TodoCachePort,
	) {}

	/** 할 일이 사라졌으면 지울 캐시도 없다 — 조용히 넘어간다. */
	async invalidateForTodo(todoId: number): Promise<void> {
		const ownerUserId = await this.todoReadRepository.findOwnerId(todoId);

		if (ownerUserId === null) {
			return;
		}

		await this.cache.invalidateFriendTodos(ownerUserId);
	}
}
