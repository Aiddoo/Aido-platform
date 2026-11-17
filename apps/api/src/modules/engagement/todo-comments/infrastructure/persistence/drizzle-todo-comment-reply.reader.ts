import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, desc, eq, isNull } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { tupleGreaterThan, tupleLessThan } from "#api/platform/database/keyset";

import type {
  ListTodoCommentRepliesParams,
  TodoCommentReplyReaderPort,
} from "../../application/ports/todo-comment-reply.reader.port.js";
import type {
  TodoCommentReadModel,
  TodoCommentWindowReadModel,
} from "../../application/read-models/todo-comment.read-model.js";
import {
  anchorComment,
  authorProfile,
  authorUser,
  candidateComment,
  columnsOf,
  commentTodo,
  projectionOf,
  replyTarget,
  replyTargetProfile,
  replyTargetUser,
  requireTodoCommentReadModel,
  type TodoCommentDatabase,
} from "./todo-comment-read-model.mapper.js";
import { toTodoCommentKeysetWindow } from "./todo-comment-window.mapper.js";

function replyAnchorOf(database: TodoCommentDatabase, params: ListTodoCommentRepliesParams) {
  return database.$with("anchor").as(
    database
      .select(columnsOf(anchorComment))
      .from(anchorComment)
      .where(
        and(
          eq(anchorComment.todoId, params.todoId.value),
          eq(anchorComment.parentId, params.threadCommentId.value),
          eq(anchorComment.id, params.anchorReplyId?.value ?? ""),
          params.mode === "AROUND" ? isNull(anchorComment.deletedAt) : undefined,
        ),
      ),
  );
}

/** 기준 답글 앞뒤의 답글을 작성 순으로 한 행 더 읽는다 */
function selectedRepliesOf(
  database: TodoCommentDatabase,
  params: ListTodoCommentRepliesParams,
  anchor: ReturnType<typeof replyAnchorOf>,
) {
  const visibleReply = and(
    eq(candidateComment.todoId, params.todoId.value),
    eq(candidateComment.parentId, params.threadCommentId.value),
    isNull(candidateComment.deletedAt),
  );
  const candidateKey = [candidateComment.createdAt, candidateComment.id];
  const boundary = [anchor.createdAt, anchor.id];
  const writtenOrder = candidateKey.map((column) => asc(column));
  const after = () =>
    database
      .select(columnsOf(candidateComment))
      .from(candidateComment)
      .innerJoin(anchor, tupleGreaterThan(candidateKey, boundary))
      .where(visibleReply)
      .orderBy(...writtenOrder)
      .limit(params.size + 1);
  const before = () =>
    database
      .select(columnsOf(candidateComment))
      .from(candidateComment)
      .innerJoin(anchor, tupleLessThan(candidateKey, boundary))
      .where(visibleReply)
      .orderBy(...candidateKey.map((column) => desc(column)))
      .limit(params.size + 1);
  const anchorRow = () => database.select(columnsOf(anchor)).from(anchor);
  return database.$with("selected").as(() => {
    switch (params.mode) {
      case "INITIAL":
        return database
          .select(columnsOf(candidateComment))
          .from(candidateComment)
          .where(visibleReply)
          .orderBy(...writtenOrder)
          .limit(params.size + 1);
      case "AFTER":
        return after().unionAll(anchorRow());
      case "BEFORE":
        return before().unionAll(anchorRow());
      case "AROUND":
        return before().unionAll(anchorRow()).unionAll(after());
    }
  });
}

@Injectable()
export class DrizzleTodoCommentReplyReader implements TodoCommentReplyReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  /** 묶음 하나의 답글을 작성 순으로 읽는다. 지운 답글은 목록에서 빠지지만 cursor 위치로는 남는다 */
  async listReplies(
    params: ListTodoCommentRepliesParams,
  ): Promise<TodoCommentWindowReadModel<TodoCommentReadModel> | null> {
    if (params.mode !== "INITIAL" && params.anchorReplyId == null) {
      return null;
    }
    const database = this.#db;
    const anchor = replyAnchorOf(database, params);
    const selected = selectedRepliesOf(database, params, anchor);
    const source = columnsOf(selected);
    const rows = await (
      params.mode === "INITIAL" ? database.with(selected) : database.with(anchor, selected)
    )
      .select(projectionOf(source))
      .from(selected)
      .leftJoin(commentTodo, eq(commentTodo.id, source.todoId))
      .leftJoin(authorProfile, eq(authorProfile.userId, source.authorId))
      .leftJoin(authorUser, eq(authorUser.id, source.authorId))
      .leftJoin(replyTarget, eq(replyTarget.id, source.replyToCommentId))
      .leftJoin(replyTargetProfile, eq(replyTargetProfile.userId, replyTarget.authorId))
      .leftJoin(replyTargetUser, eq(replyTargetUser.id, replyTarget.authorId))
      .orderBy(asc(selected.createdAt), asc(selected.id));
    if (params.mode !== "INITIAL" && rows.length === 0) {
      return null;
    }
    const window = toTodoCommentKeysetWindow({
      items: rows.map(requireTodoCommentReadModel),
      mode: params.mode === "AROUND" ? "FOCUS" : params.mode,
      anchorId: params.anchorReplyId?.value,
      size: params.size,
    });
    return { items: window.items, hasPrevious: window.hasPrevious, hasNext: window.hasNext };
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
