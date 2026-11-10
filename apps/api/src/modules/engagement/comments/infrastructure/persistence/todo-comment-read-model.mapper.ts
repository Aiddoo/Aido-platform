import { sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

import { nullableRawTimestampSchema } from "#api/platform/database/raw-timestamp.schema";
import { todo, todoComment, user, userProfile } from "#api/platform/database/schema/index";
import { toISOString, toISOStringOrNull } from "#api/shared/domain/date/utils/format";

import type {
  TodoCommentRecord,
  TodoCommentRootPosition,
} from "../../application/read-models/todo-comment.read-model.js";

const authorProfile = alias(userProfile, "author_profile");
const authorUser = alias(user, "author_user");
const replyTarget = alias(todoComment, "reply_target");
const replyTargetProfile = alias(userProfile, "reply_target_profile");

const nullableText = z.string().nullable();
const nullableInt = z.number().int().nullable();

/** LEFT JOIN LATERAL로 비어 있을 수 있는 행도 같은 스키마로 읽는다. 값이 없으면 commentId가 null이다. */
export const commentRowSchema = z.object({
  commentId: nullableText,
  todoId: nullableInt,
  threadCommentId: nullableText,
  replyToCommentId: nullableText,
  authorId: nullableText,
  authorName: nullableText,
  authorUserTag: nullableText,
  authorProfileImage: nullableText,
  replyToAuthorId: nullableText,
  replyToAuthorName: nullableText,
  todoOwnerId: nullableText,
  content: nullableText,
  likeCount: nullableInt,
  replyCount: nullableInt,
  deletedAt: nullableRawTimestampSchema,
  editedAt: nullableRawTimestampSchema,
  createdAt: nullableRawTimestampSchema,
});
type CommentRow = z.infer<typeof commentRowSchema>;

export const rootPositionRowSchema = z.object({
  rootLikeCount: z.number().int(),
  rootReplyCount: z.number().int(),
});

/** `source`는 TodoComment 열을 그대로 가진 FROM 항목(테이블 별칭이나 CTE)이다. */
export function commentColumns(source: SQL): SQL {
  return sql`
		${source}."id" AS "commentId",
		${source}."todoId",
		${source}."parentId" AS "threadCommentId",
		${source}."replyToCommentId",
		${source}."authorId",
		${authorProfile.name} AS "authorName",
		${authorUser.userTag} AS "authorUserTag",
		${authorProfile.profileImage} AS "authorProfileImage",
		${replyTarget.authorId} AS "replyToAuthorId",
		${replyTargetProfile.name} AS "replyToAuthorName",
		${todo.userId} AS "todoOwnerId",
		${source}."content",
		${source}."likeCount",
		${source}."replyCount",
		${source}."deletedAt",
		${source}."editedAt",
		${source}."createdAt"
	`;
}

export function commentJoins(source: SQL): SQL {
  return sql`
		LEFT JOIN ${todo} ON ${todo.id} = ${source}."todoId"
		LEFT JOIN ${userProfile} AS ${authorProfile} ON ${authorProfile.userId} = ${source}."authorId"
		LEFT JOIN ${user} AS ${authorUser} ON ${authorUser.id} = ${source}."authorId"
		LEFT JOIN ${todoComment} AS ${replyTarget} ON ${replyTarget.id} = ${source}."replyToCommentId"
		LEFT JOIN ${userProfile} AS ${replyTargetProfile}
			ON ${replyTargetProfile.userId} = ${replyTarget.authorId}
	`;
}

function requireValue<T>(value: T | null, field: string): T {
  if (value == null) {
    throw new Error(`댓글 조회 결과에 ${field} 값이 없습니다.`);
  }

  return value;
}

export function toCommentRecord(row: CommentRow): TodoCommentRecord | null {
  if (row.commentId == null) {
    return null;
  }

  return {
    id: row.commentId,
    todoId: requireValue(row.todoId, "todoId"),
    threadCommentId: row.threadCommentId,
    replyToCommentId: row.replyToCommentId,
    replyToAuthorId: row.replyToAuthorId,
    replyToAuthorName: row.replyToAuthorName,
    authorId: requireValue(row.authorId, "authorId"),
    authorName: row.authorName,
    authorUserTag: row.authorUserTag,
    authorProfileImage: row.authorProfileImage,
    todoOwnerId: requireValue(row.todoOwnerId, "todoOwnerId"),
    content: row.content,
    likeCount: requireValue(row.likeCount, "likeCount"),
    replyCount: requireValue(row.replyCount, "replyCount"),
    deletedAt: toISOStringOrNull(row.deletedAt),
    editedAt: toISOStringOrNull(row.editedAt),
    createdAt: toISOString(requireValue(row.createdAt, "createdAt")),
  };
}

export function toRootPosition(
  row: z.infer<typeof rootPositionRowSchema>,
): TodoCommentRootPosition {
  return { rootLikeCount: row.rootLikeCount, rootReplyCount: row.rootReplyCount };
}
