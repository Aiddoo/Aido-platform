import { sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { todoComment } from "#api/platform/database/schema/index";

import type {
  ConversationPageMode,
  TodoConversationScope,
} from "../../../application/models/comments/todo-comment.types.js";

const targetComment = alias(todoComment, "target");
const visibleComment = alias(todoComment, "comment");

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
export function buildTodoConversationTreeCtes(input: TodoConversationTreeInput): SQL {
  const targetThreadCte =
    input.mode === "FOCUS"
      ? sql`
				target_thread AS (
					SELECT COALESCE(${targetComment.rootId}, ${targetComment.id}) AS "threadId"
					FROM ${todoComment} AS ${targetComment}
					WHERE ${targetComment.todoId} = ${input.todoId}
						AND ${targetComment.id} = ${input.anchorCommentId ?? null}::TEXT
				)
			`
      : input.scope === "THREAD"
        ? sql`
					target_thread AS (
						SELECT ${input.anchorThreadId ?? null}::TEXT AS "threadId"
					)
				`
        : sql`
					target_thread AS (
						SELECT NULL::TEXT AS "threadId"
					)
				`;
  const rootThreadCondition =
    input.mode === "FOCUS" || input.scope === "THREAD"
      ? sql`comment."id" = (SELECT "threadId" FROM target_thread)`
      : sql`TRUE`;

  return sql`
		visible_sibling_order AS (
			SELECT
				${visibleComment.id},
				LEAD(${visibleComment.id}) OVER (
					PARTITION BY ${visibleComment.parentId}
					ORDER BY ${visibleComment.createdAt} ASC, ${visibleComment.id} ASC
				) AS "nextVisibleSiblingId"
			FROM ${todoComment} AS ${visibleComment}
			WHERE ${visibleComment.todoId} = ${input.todoId}
				AND (${visibleComment.deletedAt} IS NULL OR ${visibleComment.replyCount} > 0)
		),
		conversation_comments AS (
			SELECT
				comment.*,
				visible_order."nextVisibleSiblingId" IS NOT NULL AS "hasNextVisibleSibling"
			FROM ${todoComment} AS ${visibleComment}
			LEFT JOIN visible_sibling_order AS visible_order ON visible_order."id" = ${visibleComment.id}
			WHERE ${visibleComment.todoId} = ${input.todoId}
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
