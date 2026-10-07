import { createHash } from "node:crypto";

import { ErrorCode } from "@aido/api/errors";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";
import sql, { join } from "sql-template-tag";

import type { DatabaseRecord } from "#api/platform/database/database-records";
import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { sqlStatement } from "#api/platform/database/database-sql";
import { databaseTimestamp } from "#api/platform/database/database-values";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import {
  isUniqueConstraintViolation,
  uniqueConstraintTargets,
} from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { ApplicationException } from "#api/shared/domain/index";

import type {
  CreateTodoCommentChainInput,
  TodoCommentChainCommand,
  TodoCommentChainCreationResult,
  TodoCommentLikeTransition,
} from "../../../application/models/comments/todo-comment.types.js";
import {
  TodoCommentIdempotencyConflict,
  TodoCommentIdempotencyRace,
  type TodoCommentRepositoryPort,
} from "../../../application/ports/comments/todo-comment.repository.port.js";
import { TodoComment } from "../../../domain/aggregates/comments/todo-comment.aggregate.js";
import { TodoCommentId } from "../../../domain/value-objects/comments/todo-comment-id.vo.js";

type CommentRow = DatabaseRecord<"TodoComment">;

interface ReplayRow {
  id: string;
  todoId: number;
  authorId: string;
  parentId: string | null;
  clientRequestId: string;
  requestFingerprint: string | null;
  content: string | null;
}

function commentCommandFingerprint(input: TodoCommentChainCommand): string {
  const command = JSON.stringify({
    version: 1,
    todoId: input.todoId,
    authorId: input.authorId,
    parentId: input.parentId,
    items: input.items,
  });

  return createHash("sha256").update(command).digest("hex");
}

function toAggregate(row: CommentRow): TodoComment | null {
  return TodoComment.reconstitute({
    id: row.id,
    todoId: row.todoId,
    authorId: row.authorId,
    parentId: row.parentId,
    rootId: row.rootId,
    path: row.path,
    content: row.content,
    deletedAt: row.deletedAt,
    editedAt: row.editedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function orderReplayRows(
  rows: readonly ReplayRow[],
  command: TodoCommentChainCommand,
): ReplayRow[] {
  const rowsByRequestId = new Map(rows.map((row) => [row.clientRequestId, row]));
  const ordered = command.items.flatMap((item) => {
    const row = rowsByRequestId.get(item.clientRequestId);
    return row ? [row] : [];
  });

  if (
    ordered.length !== command.items.length ||
    rows.length !== command.items.length ||
    new Set(command.items.map((item) => item.clientRequestId)).size !== command.items.length
  ) {
    throw new TodoCommentIdempotencyConflict();
  }

  return ordered;
}

function isLegacyReplay(ordered: readonly ReplayRow[], command: TodoCommentChainCommand): boolean {
  return ordered.every((row, index) => {
    const previous = ordered[index - 1];
    const expectedParentId = index === 0 ? command.parentId : previous?.id;
    const item = command.items[index];

    return (
      item !== undefined &&
      expectedParentId !== undefined &&
      row.todoId === command.todoId &&
      row.authorId === command.authorId &&
      row.parentId === expectedParentId &&
      row.content === item.content
    );
  });
}

function isIdempotencyRace(error: unknown): boolean {
  if (!isUniqueConstraintViolation(error)) {
    return false;
  }

  const targets = uniqueConstraintTargets(error);
  if (targets === undefined) {
    // PostgreSQL unique 오류의 constraint 이름으로 멱등성 충돌을 식별한다.
    // 이 insert의 id는 DB가 만들고, 유일한 업무 유니크는 authorId/clientRequestId다.
    return true;
  }

  return targets.includes("authorId") && targets.includes("clientRequestId");
}

@Injectable()
export class PrismaTodoCommentRepository implements TodoCommentRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  async findComment(todoId: number, commentId: string): Promise<TodoComment | null> {
    const row = decodeRecord(
      "TodoComment",
      await this.client.orm.public.TodoComment.where((row) =>
        and(row.id.eq(commentId), row.todoId.eq(todoId)),
      ).first(),
    );

    return row ? toAggregate(row) : null;
  }

  async findCommentChainReplay(input: TodoCommentChainCommand): Promise<string[] | null> {
    const clientRequestIds = input.items.map((item) => item.clientRequestId);
    const requestFingerprint = commentCommandFingerprint(input);
    const existing = decodeRecord(
      "TodoComment",
      await this.client.orm.public.TodoComment.where((row) =>
        and(row.authorId.eq(input.authorId), row.clientRequestId.in(clientRequestIds)),
      )
        .select(
          "id",
          "todoId",
          "authorId",
          "parentId",
          "clientRequestId",
          "requestFingerprint",
          "content",
        )
        .all(),
    );

    if (existing.length === 0) {
      return null;
    }

    const ordered = orderReplayRows(existing, input);
    const allCurrent = ordered.every((row) => row.requestFingerprint === requestFingerprint);
    if (allCurrent) {
      return ordered.map((row) => row.id);
    }

    const allLegacy = ordered.every((row) => row.requestFingerprint === null);
    if (allLegacy && isLegacyReplay(ordered, input)) {
      return ordered.map((row) => row.id);
    }

    throw new TodoCommentIdempotencyConflict();
  }

  /** 글마다 부모가 바로 앞 글이라 insert는 순차지만, 응답 projection은 reader가 한 번에 hydrate한다. */
  async createCommentChain(
    input: CreateTodoCommentChainInput,
  ): Promise<TodoCommentChainCreationResult> {
    const requestFingerprint = commentCommandFingerprint({
      todoId: input.todoId,
      authorId: input.authorId,
      parentId: input.placement.parentId?.getValue() ?? null,
      items: input.items,
    });
    let placement = input.placement;
    const commentIds: string[] = [];
    const lastIndex = input.items.length - 1;

    try {
      for (const [index, item] of input.items.entries()) {
        const row = decodeRecord(
          "TodoComment",
          await this.client.orm.public.TodoComment.select("id").create(
            encodeCreate("TodoComment", {
              todoId: input.todoId,
              authorId: input.authorId,
              clientRequestId: item.clientRequestId,
              requestFingerprint,
              content: item.content,
              parentId: placement.parentId?.getValue() ?? null,
              rootId: placement.rootId?.getValue() ?? null,
              path: [...placement.path],
              depth: placement.depth,
              replyCount: index < lastIndex ? 1 : 0,
            }),
          ),
        );

        commentIds.push(row.id);
        placement = placement.under(TodoCommentId.create(row.id));
      }
    } catch (error) {
      if (isIdempotencyRace(error)) {
        throw new TodoCommentIdempotencyRace();
      }

      throw error;
    }

    return { commentIds, createdCount: commentIds.length };
  }

  async updateComment(comment: TodoComment): Promise<boolean> {
    const updated = {
      count: await this.client.orm.public.TodoComment.where((row) =>
        and(
          row.id.eq(comment.id.getValue()),
          row.todoId.eq(comment.todoId),
          row.authorId.eq(comment.authorId),
          row.deletedAt.isNull(),
        ),
      ).updateAndCount(
        encodePatch("TodoComment", { content: comment.content, editedAt: comment.editedAt }),
      ),
    };

    return updated.count === 1;
  }

  async deleteComment(comment: TodoComment): Promise<boolean> {
    const deleted = {
      count: await this.client.orm.public.TodoComment.where((row) =>
        and(
          row.id.eq(comment.id.getValue()),
          row.todoId.eq(comment.todoId),
          row.authorId.eq(comment.authorId),
          row.deletedAt.isNull(),
        ),
      ).updateAndCount(
        encodePatch("TodoComment", { content: null, deletedAt: comment.deletedAt, likeCount: 0 }),
      ),
    };

    if (deleted.count !== 1) {
      return false;
    }

    await this.client.orm.public.TodoCommentLike.where((row) =>
      and(row.commentId.eq(comment.id.getValue()), row.isActive.eq(true)),
    ).updateAndCount(encodePatch("TodoCommentLike", { isActive: false }));

    return true;
  }

  async increaseTodoCommentCount(todoId: number, amount: number): Promise<void> {
    decodeRecord(
      "Todo",
      requireRecord(
        await this.client
          .query(
            this.client.sql.public.Todo.update((fields) => ({
              commentCount: this.client.raw.sql`${fields.commentCount} + ${amount}`.returns(
                "pg/int4@1",
              ),
              updatedAt: this.client.raw.sql`${databaseTimestamp(new Date())}`.returns(
                "pg/timestamp-string@1",
              ),
            }))
              .where((fields, functions) => functions.eq(fields.id, todoId))
              .returning("id")
              .build(),
          )
          .then((rows) => rows[0] ?? null),
      ),
    );
  }

  async decrementTodoCommentCount(todoId: number): Promise<boolean> {
    const changed = {
      count: await this.client
        .execute(
          this.client.sql.public.Todo.update((fields) => ({
            commentCount: this.client.raw.sql`${fields.commentCount} - ${1}`.returns("pg/int4@1"),
            updatedAt: this.client.raw.sql`${databaseTimestamp(new Date())}`.returns(
              "pg/timestamp-string@1",
            ),
          }))
            .where((fields, functions) =>
              functions.and(functions.eq(fields.id, todoId), functions.gt(fields.commentCount, 0)),
            )
            .build(),
        )
        .then((result) => result.affectedRows),
    };

    return changed.count === 1;
  }

  async incrementReplyCount(parentId: string): Promise<boolean> {
    const updated = {
      count: await this.client
        .execute(
          this.client.sql.public.TodoComment.update((fields) => ({
            replyCount: this.client.raw.sql`${fields.replyCount} + ${1}`.returns("pg/int4@1"),
            updatedAt: this.client.raw.sql`${databaseTimestamp(new Date())}`.returns(
              "pg/timestamp-string@1",
            ),
          }))
            .where((fields, functions) =>
              functions.and(
                functions.eq(fields.id, parentId),
                this.client.raw.sql`${fields.deletedAt} IS NULL`.returns("pg/bool@1"),
              ),
            )
            .build(),
        )
        .then((result) => result.affectedRows),
    };

    return updated.count === 1;
  }

  async dropDeletedFromAncestors(commentId: string, path: readonly string[]): Promise<void> {
    const chain = [commentId, ...[...path].reverse()];
    const commentIds = join(chain);

    // 방금 삭제한 행이 화면에서 사라질 때만 부모의 표시 가능한 직계 답글 수를 내린다.
    // 삭제된 부모가 마지막 자식을 잃으면 같은 규칙을 조상까지 이어 가되, 깊이마다 왕복하지 않는다.
    await this.client
      .execute(
        sqlStatement(
          this.client,
          sql`
			WITH RECURSIVE chain AS (
				SELECT item."commentId", item."ordinal"::INTEGER
				FROM unnest(ARRAY[${commentIds}]::TEXT[])
					WITH ORDINALITY AS item("commentId", "ordinal")
			),
			invisible AS (
				SELECT chain."commentId", chain."ordinal"
				FROM chain
				INNER JOIN "TodoComment" AS comment ON comment."id" = chain."commentId"
				WHERE chain."ordinal" = 1
					AND comment."deletedAt" IS NOT NULL
					AND comment."replyCount" = 0

				UNION ALL

				SELECT chain."commentId", chain."ordinal"
				FROM invisible AS child
				INNER JOIN chain ON chain."ordinal" = child."ordinal" + 1
				INNER JOIN "TodoComment" AS comment ON comment."id" = chain."commentId"
				WHERE comment."deletedAt" IS NOT NULL
					AND comment."replyCount" = 1
			),
			parents_to_decrement AS (
				SELECT parent."commentId"
				FROM invisible AS child
				INNER JOIN chain AS parent ON parent."ordinal" = child."ordinal" + 1
			)
			UPDATE "TodoComment" AS comment
			SET "replyCount" = comment."replyCount" - 1,
				"updatedAt" = CURRENT_TIMESTAMP
			FROM parents_to_decrement AS target
			WHERE comment."id" = target."commentId"
				AND comment."replyCount" > 0
		`,
        )
          .affectedCount()
          .build(),
      )
      .then((result) => result.affectedRows);
  }

  async setLike(
    todoId: number,
    commentId: string,
    userId: string,
  ): Promise<TodoCommentLikeTransition> {
    const comment = decodeRecord(
      "TodoComment",
      requireRecord(
        await this.client.orm.public.TodoComment.where((row) =>
          and(row.id.eq(commentId), row.todoId.eq(todoId)),
        )
          .select("authorId", "likeCount")
          .first(),
      ),
    );
    const existingLike = decodeRecord(
      "TodoCommentLike",
      await this.client.orm.public.TodoCommentLike.where((row) =>
        and(row.commentId.eq(commentId), row.userId.eq(userId)),
      ).first(),
    );

    if (existingLike?.isActive) {
      return {
        commentId,
        commentAuthorId: comment.authorId,
        changed: false,
        isLiked: true,
        likeCount: comment.likeCount,
        wasEverNotified: existingLike.notifiedAt !== null,
      };
    }

    const changed = existingLike
      ? {
          count: await this.client.orm.public.TodoCommentLike.where((row) =>
            and(row.commentId.eq(commentId), row.userId.eq(userId), row.isActive.eq(false)),
          ).updateAndCount(encodePatch("TodoCommentLike", { isActive: true })),
        }
      : {
          count: await this.client.orm.public.TodoCommentLike.createAndCount(
            [{ commentId, userId, isActive: true }].map((value) =>
              encodeCreate("TodoCommentLike", value),
            ),
            { onConflict: "skip" },
          ),
        };

    if (changed.count !== 1) {
      throw new ApplicationException(ErrorCode.SYS_0003, { commentId });
    }

    const updated = {
      count: await this.client
        .execute(
          this.client.sql.public.TodoComment.update((fields) => ({
            likeCount: this.client.raw.sql`${fields.likeCount} + ${1}`.returns("pg/int4@1"),
            updatedAt: this.client.raw.sql`${databaseTimestamp(new Date())}`.returns(
              "pg/timestamp-string@1",
            ),
          }))
            .where((fields, functions) =>
              functions.and(
                functions.eq(fields.id, commentId),
                functions.eq(fields.todoId, todoId),
                this.client.raw.sql`${fields.deletedAt} IS NULL`.returns("pg/bool@1"),
              ),
            )
            .build(),
        )
        .then((result) => result.affectedRows),
    };
    if (updated.count !== 1) {
      throw new ApplicationException(ErrorCode.SYS_0003, { commentId });
    }

    const current = decodeRecord(
      "TodoComment",
      requireRecord(
        await this.client.orm.public.TodoComment.where((row) => row.id.eq(commentId))
          .select("likeCount")
          .first(),
      ),
    );

    return {
      commentId,
      commentAuthorId: comment.authorId,
      changed: true,
      isLiked: true,
      likeCount: current.likeCount,
      wasEverNotified: existingLike?.notifiedAt !== null && existingLike !== null,
    };
  }

  async markLikeNotified(commentId: string, userId: string): Promise<void> {
    await this.client.orm.public.TodoCommentLike.where((row) =>
      and(row.commentId.eq(commentId), row.userId.eq(userId), row.notifiedAt.isNull()),
    ).updateAndCount(encodePatch("TodoCommentLike", { notifiedAt: new Date() }));
  }

  async removeLike(
    todoId: number,
    commentId: string,
    userId: string,
  ): Promise<TodoCommentLikeTransition> {
    const comment = decodeRecord(
      "TodoComment",
      requireRecord(
        await this.client.orm.public.TodoComment.where((row) =>
          and(row.id.eq(commentId), row.todoId.eq(todoId)),
        )
          .select("authorId", "likeCount")
          .first(),
      ),
    );
    const existingLike = decodeRecord(
      "TodoCommentLike",
      await this.client.orm.public.TodoCommentLike.where((row) =>
        and(row.commentId.eq(commentId), row.userId.eq(userId)),
      ).first(),
    );

    if (!existingLike?.isActive) {
      return {
        commentId,
        commentAuthorId: comment.authorId,
        changed: false,
        isLiked: false,
        likeCount: comment.likeCount,
        wasEverNotified: existingLike?.notifiedAt !== null && existingLike !== null,
      };
    }

    const changed = {
      count: await this.client.orm.public.TodoCommentLike.where((row) =>
        and(row.commentId.eq(commentId), row.userId.eq(userId), row.isActive.eq(true)),
      ).updateAndCount(encodePatch("TodoCommentLike", { isActive: false })),
    };
    if (changed.count !== 1) {
      throw new ApplicationException(ErrorCode.SYS_0003, { commentId });
    }

    const updated = {
      count: await this.client
        .execute(
          this.client.sql.public.TodoComment.update((fields) => ({
            likeCount: this.client.raw.sql`${fields.likeCount} - ${1}`.returns("pg/int4@1"),
            updatedAt: this.client.raw.sql`${databaseTimestamp(new Date())}`.returns(
              "pg/timestamp-string@1",
            ),
          }))
            .where((fields, functions) =>
              functions.and(
                functions.eq(fields.id, commentId),
                functions.eq(fields.todoId, todoId),
                this.client.raw.sql`${fields.deletedAt} IS NULL`.returns("pg/bool@1"),
                functions.gt(fields.likeCount, 0),
              ),
            )
            .build(),
        )
        .then((result) => result.affectedRows),
    };
    if (updated.count !== 1) {
      throw new ApplicationException(ErrorCode.SYS_0003, { commentId });
    }

    const current = decodeRecord(
      "TodoComment",
      requireRecord(
        await this.client.orm.public.TodoComment.where((row) => row.id.eq(commentId))
          .select("likeCount")
          .first(),
      ),
    );
    const like = decodeRecord(
      "TodoCommentLike",
      await this.client.orm.public.TodoCommentLike.where((row) =>
        and(row.commentId.eq(commentId), row.userId.eq(userId)),
      )
        .select("notifiedAt")
        .first(),
    );

    return {
      commentId,
      commentAuthorId: comment.authorId,
      changed: true,
      isLiked: false,
      likeCount: current.likeCount,
      wasEverNotified: like?.notifiedAt !== null && like !== null,
    };
  }

  async recordView(
    todoId: number,
    viewerId: string,
  ): Promise<{ recorded: boolean; viewCount: number }> {
    const inserted = {
      count: await this.client.orm.public.TodoView.createAndCount(
        [{ todoId, viewerId }].map((value) => encodeCreate("TodoView", value)),
        { onConflict: "skip" },
      ),
    };

    if (inserted.count === 1) {
      const updated = decodeRecord(
        "Todo",
        requireRecord(
          await this.client
            .query(
              this.client.sql.public.Todo.update((fields) => ({
                viewCount: this.client.raw.sql`${fields.viewCount} + ${1}`.returns("pg/int4@1"),
                updatedAt: this.client.raw.sql`${databaseTimestamp(new Date())}`.returns(
                  "pg/timestamp-string@1",
                ),
              }))
                .where((fields, functions) => functions.eq(fields.id, todoId))
                .returning("viewCount")
                .build(),
            )
            .then((rows) => rows[0] ?? null),
        ),
      );
      return { recorded: true, viewCount: updated.viewCount };
    }

    const todo = decodeRecord(
      "Todo",
      requireRecord(
        await this.client.orm.public.Todo.where((row) => row.id.eq(todoId))
          .select("viewCount")
          .first(),
      ),
    );
    return { recorded: false, viewCount: todo.viewCount };
  }
}
