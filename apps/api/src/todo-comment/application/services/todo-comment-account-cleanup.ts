import { Inject, Injectable, Logger } from "@nestjs/common";

import { MUTATION_LOCK, MutationLockKeys, type MutationLockPort } from "@/shared/application/ports";

import {
	TODO_COMMENT_ACCOUNT_CLEANUP_STORE,
	type TodoCommentAccountCleanupStorePort,
} from "../ports/todo-comment-account-cleanup.store.port";
import { TODO_VIEW_CACHE, type TodoViewCachePort } from "../ports/todo-view-cache.port";
import { settleAfterCommit } from "../settle-after-commit";

export interface TodoCommentAccountCleanupResult {
	readonly affectedTodoIds: readonly number[];
}

/**
 * auth 계정 purge가 소비하는 댓글 모듈의 공개 capability.
 *
 * cleanupInTransaction은 호출자가 연 UoW에 참여합니다. 계정 삭제보다 먼저 댓글 데이터와
 * counter를 정리해야 User FK의 RESTRICT가 마지막 안전망으로 동작합니다.
 */
@Injectable()
export class TodoCommentAccountCleanup {
	readonly #logger = new Logger(TodoCommentAccountCleanup.name);

	constructor(
		@Inject(TODO_COMMENT_ACCOUNT_CLEANUP_STORE)
		private readonly store: TodoCommentAccountCleanupStorePort,
		@Inject(TODO_VIEW_CACHE)
		private readonly todoViewCache: TodoViewCachePort,
		@Inject(MUTATION_LOCK)
		private readonly mutationLock: MutationLockPort,
	) {}

	async cleanupInTransaction(userId: string): Promise<TodoCommentAccountCleanupResult> {
		const plan = await this.store.plan(userId);

		if (plan.commentIdsToLock.length > 0) {
			await this.mutationLock.acquire(plan.commentIdsToLock.map(MutationLockKeys.todoComment));
		}

		await this.store.cleanup(userId, plan);
		return { affectedTodoIds: [...plan.affectedTodoIds] };
	}

	/** 이미 끝난 계정 삭제를 cache 장애 때문에 실패로 보고하지 않도록 전부 best-effort로 정리한다. */
	async settleAfterCommit(result: TodoCommentAccountCleanupResult): Promise<void> {
		await settleAfterCommit(
			this.#logger,
			result.affectedTodoIds.map((todoId) => ({
				label: `계정 정리 후 할 일 화면 캐시 무효화: todoId=${todoId}`,
				run: () => this.todoViewCache.invalidateForTodo(todoId),
			})),
		);
	}
}
