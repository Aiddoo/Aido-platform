import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";

import { Prisma } from "@/generated/prisma/client";
import { DELETED_COMMENT_AUTHOR_ID } from "@/shared/domain/system-user";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type {
	TodoCommentAccountCleanupPlan,
	TodoCommentAccountCleanupStorePort,
} from "../../application/ports/todo-comment-account-cleanup.store.port";

interface TodoIdRow {
	todoId: number;
}

interface CommentIdRow {
	id: string;
}

@Injectable()
export class PrismaTodoCommentAccountCleanupStore implements TodoCommentAccountCleanupStorePort {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
	) {}

	private get client() {
		return this.txHost.tx;
	}

	async plan(userId: string): Promise<TodoCommentAccountCleanupPlan> {
		const affectedTodoRows = await this.client.$queryRaw<TodoIdRow[]>`
			SELECT DISTINCT affected."todoId"
			FROM (
				SELECT comment."todoId"
				FROM "TodoComment" AS comment
				WHERE comment."authorId" = ${userId}

				UNION

				SELECT comment."todoId"
				FROM "TodoCommentLike" AS comment_like
				INNER JOIN "TodoComment" AS comment
					ON comment."id" = comment_like."commentId"
				WHERE comment_like."userId" = ${userId}
			) AS affected
			ORDER BY affected."todoId"
		`;
		const affectedTodoIds = affectedTodoRows.map((row) => row.todoId);

		if (affectedTodoIds.length === 0) {
			return { affectedTodoIds: [], commentIdsToLock: [] };
		}

		const todoIds = Prisma.join(affectedTodoIds);
		const commentRows = await this.client.$queryRaw<CommentIdRow[]>(Prisma.sql`
			SELECT comment."id"
			FROM "TodoComment" AS comment
			WHERE comment."todoId" IN (${todoIds})
			ORDER BY comment."id"
		`);

		return {
			affectedTodoIds,
			commentIdsToLock: commentRows.map((row) => row.id),
		};
	}

	async cleanup(userId: string, plan: TodoCommentAccountCleanupPlan): Promise<void> {
		if (plan.affectedTodoIds.length === 0) {
			return;
		}

		const todoIds = Prisma.join(plan.affectedTodoIds);

		// 최상위 댓글 작성은 Todo.commentCount 행 잠금에서 합류합니다. 먼저 Todo를 잠그면
		// 절대값 재계산과 concurrent increment가 서로 덮어쓰지 않습니다.
		await this.client.$queryRaw(Prisma.sql`
			SELECT todo."id"
			FROM "Todo" AS todo
			WHERE todo."id" IN (${todoIds})
			ORDER BY todo."id"
			FOR UPDATE
		`);
		await this.client.$queryRaw(Prisma.sql`
			SELECT comment."id"
			FROM "TodoComment" AS comment
			WHERE comment."todoId" IN (${todoIds})
			ORDER BY comment."id"
			FOR UPDATE
		`);

		// purged user의 inactive like도 FK를 잡고 있으므로 모두 제거합니다. active likeCount는
		// 아래의 set-based reconciliation이 실제 남은 행을 기준으로 다시 확정합니다.
		await this.client.$executeRaw`
			DELETE FROM "TodoCommentLike"
			WHERE "userId" = ${userId}
		`;
		await this.client.$executeRaw`
			UPDATE "TodoCommentLike" AS comment_like
			SET "isActive" = FALSE,
				"updatedAt" = CURRENT_TIMESTAMP
			FROM "TodoComment" AS comment
			WHERE comment."id" = comment_like."commentId"
				AND comment."authorId" = ${userId}
				AND comment_like."isActive" = TRUE
		`;

		// 물리 삭제 대신 묘비를 남겨 다른 작성자의 자손과 대화 rail을 보존합니다.
		await this.client.$executeRaw`
			UPDATE "TodoComment"
			SET "content" = NULL,
				"deletedAt" = COALESCE("deletedAt", CURRENT_TIMESTAMP),
				"likeCount" = 0,
				"updatedAt" = CURRENT_TIMESTAMP
			WHERE "authorId" = ${userId}
		`;

		await this.client.$executeRaw(Prisma.sql`
			WITH desired AS (
				SELECT comment."id",
					COUNT(comment_like."commentId") FILTER (
						WHERE comment_like."isActive" = TRUE
					)::integer AS "likeCount"
				FROM "TodoComment" AS comment
				LEFT JOIN "TodoCommentLike" AS comment_like
					ON comment_like."commentId" = comment."id"
				WHERE comment."todoId" IN (${todoIds})
				GROUP BY comment."id"
			)
			UPDATE "TodoComment" AS comment
			SET "likeCount" = desired."likeCount",
				"updatedAt" = CURRENT_TIMESTAMP
			FROM desired
			WHERE comment."id" = desired."id"
				AND comment."likeCount" IS DISTINCT FROM desired."likeCount"
		`);

		// 삭제된 중간 댓글도 active descendant의 path에 있으면 보입니다. 그 집합을 먼저 만든 뒤
		// 각 부모가 실제로 보여 주는 직계 자식 수를 다시 계산합니다.
		await this.client.$executeRaw(Prisma.sql`
			WITH active_comments AS (
				SELECT comment."id", comment."path"
				FROM "TodoComment" AS comment
				WHERE comment."todoId" IN (${todoIds})
					AND comment."deletedAt" IS NULL
			),
			visible_comment_ids AS (
				SELECT active_comment."id"
				FROM active_comments AS active_comment

				UNION

				SELECT UNNEST(active_comment."path")
				FROM active_comments AS active_comment
			),
			desired AS (
				SELECT parent."id",
					COUNT(visible_child."id")::integer AS "replyCount"
				FROM "TodoComment" AS parent
				LEFT JOIN "TodoComment" AS child
					ON child."todoId" = parent."todoId"
					AND child."parentId" = parent."id"
				LEFT JOIN visible_comment_ids AS visible_child
					ON visible_child."id" = child."id"
				WHERE parent."todoId" IN (${todoIds})
				GROUP BY parent."id"
			)
			UPDATE "TodoComment" AS comment
			SET "replyCount" = desired."replyCount",
				"updatedAt" = CURRENT_TIMESTAMP
			FROM desired
			WHERE comment."id" = desired."id"
				AND comment."replyCount" IS DISTINCT FROM desired."replyCount"
		`);

		await this.client.$executeRaw(Prisma.sql`
			WITH desired AS (
				SELECT todo."id",
					COUNT(comment."id") FILTER (
						WHERE comment."deletedAt" IS NULL
					)::integer AS "commentCount"
				FROM "Todo" AS todo
				LEFT JOIN "TodoComment" AS comment
					ON comment."todoId" = todo."id"
				WHERE todo."id" IN (${todoIds})
				GROUP BY todo."id"
			)
			UPDATE "Todo" AS todo
			SET "commentCount" = desired."commentCount",
				"updatedAt" = CURRENT_TIMESTAMP
			FROM desired
			WHERE todo."id" = desired."id"
				AND todo."commentCount" IS DISTINCT FROM desired."commentCount"
		`);

		// 마지막에 개인정보가 없는 시스템 작성자로 옮깁니다. nullable author를 모르는 직전 API로
		// 롤백해도 relation 역참조가 깨지지 않고, 새 API는 deletedAt으로 묘비를 판정합니다.
		// 이 단계까지 가지 못하면 RESTRICT가 hard delete를 막아 반쪽 정리를 허용하지 않습니다.
		await this.client.$executeRaw`
			UPDATE "TodoComment"
			SET "authorId" = ${DELETED_COMMENT_AUTHOR_ID},
				"clientRequestId" = gen_random_uuid(),
				"requestFingerprint" = NULL,
				"updatedAt" = CURRENT_TIMESTAMP
			WHERE "authorId" = ${userId}
		`;
	}
}
