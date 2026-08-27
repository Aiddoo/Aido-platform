import { Prisma } from "@/generated/prisma/client";

import type { ConversationPageMode, TodoConversationScope } from "../../application/types";

interface TodoConversationTreeInput {
	todoId: number;
	mode: ConversationPageMode;
	scope: TodoConversationScope;
	anchorCommentId?: string;
	anchorThreadId?: string;
}

/**
 * Focus와 thread cursor는 먼저 대상 root를 확정해 재귀 seed를 하나로 제한한다.
 * TODO 범위 페이지에서만 모든 root를 seed한다.
 */
export function buildTodoConversationTreeCtes(input: TodoConversationTreeInput): Prisma.Sql {
	const targetThreadCte =
		input.mode === "FOCUS"
			? Prisma.sql`
				target_thread AS (
					SELECT COALESCE(target."rootId", target."id") AS "threadId"
					FROM "TodoComment" AS target
					WHERE target."todoId" = ${input.todoId}
						AND target."id" = ${input.anchorCommentId ?? null}::TEXT
				)
			`
			: input.scope === "THREAD"
				? Prisma.sql`
					target_thread AS (
						SELECT ${input.anchorThreadId ?? null}::TEXT AS "threadId"
					)
				`
				: Prisma.sql`
					target_thread AS (
						SELECT NULL::TEXT AS "threadId"
					)
				`;
	const rootThreadCondition =
		input.mode === "FOCUS" || input.scope === "THREAD"
			? Prisma.sql`comment."id" = (SELECT "threadId" FROM target_thread)`
			: Prisma.sql`TRUE`;

	return Prisma.sql`
		visible_sibling_order AS (
			SELECT
				comment."id",
				LEAD(comment."id") OVER (
					PARTITION BY comment."parentId"
					ORDER BY comment."createdAt" ASC, comment."id" ASC
				) AS "nextVisibleSiblingId"
			FROM "TodoComment" AS comment
			WHERE comment."todoId" = ${input.todoId}
				AND (comment."deletedAt" IS NULL OR comment."replyCount" > 0)
		),
		conversation_comments AS (
			SELECT
				comment.*,
				visible_order."nextVisibleSiblingId" IS NOT NULL AS "hasNextVisibleSibling"
			FROM "TodoComment" AS comment
			LEFT JOIN visible_sibling_order AS visible_order ON visible_order."id" = comment."id"
			WHERE comment."todoId" = ${input.todoId}
		),
		${targetThreadCte},
		tree AS (
			SELECT
				comment.*,
				comment."id" AS "threadId",
				comment."likeCount" AS "rootLikeCount",
				comment."replyCount" AS "rootReplyCount",
				comment."createdAt" AS "rootCreatedAt",
				ARRAY[
					lpad(((extract(epoch FROM comment."createdAt") * 1000000)::BIGINT)::TEXT, 20, '0') || ':' || comment."id"
				]::TEXT[] AS "dfsPath",
				ARRAY[]::INTEGER[] AS "continuingAncestorDepths"
			FROM conversation_comments AS comment
			WHERE comment."parentId" IS NULL
				AND (${rootThreadCondition})

			UNION ALL

			SELECT
				child.*,
				parent."threadId",
				parent."rootLikeCount",
				parent."rootReplyCount",
				parent."rootCreatedAt",
				parent."dfsPath" || ARRAY[
					lpad(((extract(epoch FROM child."createdAt") * 1000000)::BIGINT)::TEXT, 20, '0') || ':' || child."id"
				]::TEXT[],
				parent."continuingAncestorDepths" ||
					CASE
						WHEN child."hasNextVisibleSibling" THEN ARRAY[parent."depth"]::INTEGER[]
						ELSE ARRAY[]::INTEGER[]
					END
			FROM conversation_comments AS child
			INNER JOIN tree AS parent ON parent."id" = child."parentId"
		)
	`;
}
