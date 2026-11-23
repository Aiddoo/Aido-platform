import { TODO_COMMENT_SORT } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, ne, or, type SQL } from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";
import { match } from "ts-pattern";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { type KeysetOperand, tupleGreaterThan, tupleLessThan } from "#api/platform/database/keyset";
import { todoComment } from "#api/platform/database/schema/index";

import type {
  ListTodoConversationParams,
  TodoConversationReaderPort,
} from "../../application/ports/todo-conversation.reader.port.js";
import type {
  TodoCommentRootPositionReadModel,
  TodoConversationReadModel,
  TodoConversationWindowReadModel,
} from "../../application/read-models/todo-comment.read-model.js";
import {
  commentAuthor,
  columnsOf,
  commentTodo,
  projectionOf,
  replyTarget,
  replyTargetAuthor,
  requireTodoCommentReadModel,
  type TodoCommentDatabase,
  toRootPosition,
} from "./todo-comment-read-model.mapper.js";
import { toTodoCommentKeysetWindow } from "./todo-comment-window.mapper.js";

const headComment = alias(todoComment, "head");
const replyComment = alias(todoComment, "reply");
const focusComment = alias(todoComment, "focus");

/** 대화 tree 행. 묶음 머리 칸을 함께 싣는다 */
type TreeSource = Record<
  | "id"
  | "parentId"
  | "createdAt"
  | "threadId"
  | "rootLikeCount"
  | "rootReplyCount"
  | "rootCreatedAt",
  AnyPgColumn
>;

/** 다음·이전 페이지가 cursor에서 받은 경계 묶음과 그 묶음의 점수 */
interface CursorRoot {
  readonly threadId: string;
  readonly position: TodoCommentRootPositionReadModel;
}

/** focus면 그 글이 속한 묶음, 묶음 범위 cursor면 그 묶음만 읽는다 */
function conversationThreadCondition(
  database: TodoCommentDatabase,
  params: ListTodoConversationParams,
): SQL | undefined {
  if (params.mode === "FOCUS") {
    // 댓글을 열면 그 댓글이, 답글을 열면 그 답글의 묶음 머리가 대상이다
    return or(
      eq(headComment.id, params.anchorCommentId?.value ?? ""),
      inArray(
        headComment.id,
        database
          .select({ id: focusComment.parentId })
          .from(focusComment)
          .where(
            and(
              eq(focusComment.todoId, params.todoId.value),
              eq(focusComment.id, params.anchorCommentId?.value ?? ""),
            ),
          ),
      ),
    );
  }
  return params.scope === "THREAD"
    ? eq(headComment.id, params.anchorThreadId?.value ?? "")
    : undefined;
}

function conversationThreadsOf(database: TodoCommentDatabase, params: ListTodoConversationParams) {
  return database.$with("threads").as(
    database
      .select(columnsOf(headComment))
      .from(headComment)
      .where(
        and(
          eq(headComment.todoId, params.todoId.value),
          isNull(headComment.parentId),
          conversationThreadCondition(database, params),
        ),
      ),
  );
}

/** 묶음 머리와 그 답글을 묶음 머리 칸과 함께 한 줄로 편다 */
function conversationTreeOf(
  database: TodoCommentDatabase,
  threads: ReturnType<typeof conversationThreadsOf>,
) {
  return database.$with("tree").as(
    database
      .select({
        ...columnsOf(threads),
        threadId: threads.id.as("threadId"),
        rootLikeCount: threads.likeCount.as("rootLikeCount"),
        rootReplyCount: threads.replyCount.as("rootReplyCount"),
        rootCreatedAt: threads.createdAt.as("rootCreatedAt"),
      })
      .from(threads)
      .unionAll(
        database
          .select({
            ...columnsOf(replyComment),
            threadId: threads.id.as("threadId"),
            rootLikeCount: threads.likeCount.as("rootLikeCount"),
            rootReplyCount: threads.replyCount.as("rootReplyCount"),
            rootCreatedAt: threads.createdAt.as("rootCreatedAt"),
          })
          .from(threads)
          .innerJoin(replyComment, eq(replyComment.parentId, threads.id)),
      ),
  );
}

type ConversationTree = ReturnType<typeof conversationTreeOf>;

function conversationAnchorOf(
  database: TodoCommentDatabase,
  tree: ConversationTree,
  params: ListTodoConversationParams,
) {
  return database.$with("anchor").as(
    database
      .select({
        id: tree.id,
        createdAt: tree.createdAt,
        parentId: tree.parentId,
        threadId: tree.threadId,
        rootLikeCount: tree.rootLikeCount,
        rootReplyCount: tree.rootReplyCount,
        rootCreatedAt: tree.rootCreatedAt,
      })
      .from(tree)
      .where(
        and(
          eq(tree.id, params.anchorCommentId?.value ?? ""),
          params.anchorThreadId == null
            ? undefined
            : eq(tree.threadId, params.anchorThreadId.value),
        ),
      ),
  );
}

/** 묶음은 최신·인기순으로, 묶음 안은 머리 댓글 다음 답글을 작성 순으로 세운다 */
function conversationOrderOf(isLatest: boolean, cursorRoot: CursorRoot | null) {
  const rootKey = (source: TreeSource): KeysetOperand[] =>
    isLatest
      ? [source.rootCreatedAt, source.threadId]
      : [source.rootLikeCount, source.rootReplyCount, source.rootCreatedAt, source.threadId];
  const threadKey = (source: TreeSource): KeysetOperand[] => [
    isNotNull(source.parentId),
    source.createdAt,
    source.id,
  ];
  // 경계 묶음의 행은 cursor의 점수로 경계에 놓이므로, 인기순 다음 페이지는 그 행이 먼저, 이전 페이지는 나중에 온다
  const boundaryThreadFirst = (source: TreeSource, isBoundaryFirst: boolean) =>
    cursorRoot == null || isLatest
      ? []
      : [
          isBoundaryFirst
            ? desc(eq(source.threadId, cursorRoot.threadId))
            : asc(eq(source.threadId, cursorRoot.threadId)),
        ];
  const displayOrder = (source: TreeSource, isBoundaryFirst: boolean) => [
    ...boundaryThreadFirst(source, isBoundaryFirst),
    ...rootKey(source).map((column) => desc(column)),
    ...threadKey(source).map((column) => asc(column)),
  ];
  const reverseOrder = (source: TreeSource) => [
    ...boundaryThreadFirst(source, true),
    ...rootKey(source).map((column) => asc(column)),
    ...threadKey(source).map((column) => desc(column)),
  ];
  return { rootKey, threadKey, displayOrder, reverseOrder };
}

function treeColumnsOf(source: ConversationTree) {
  return {
    ...columnsOf(source),
    threadId: source.threadId,
    rootLikeCount: source.rootLikeCount,
    rootReplyCount: source.rootReplyCount,
    rootCreatedAt: source.rootCreatedAt,
  };
}

interface ConversationParts {
  readonly tree: ConversationTree;
  readonly anchor: ReturnType<typeof conversationAnchorOf>;
  readonly order: ReturnType<typeof conversationOrderOf>;
  readonly cursorRoot: CursorRoot | null;
}

/** 묶음 위치와 (답글 여부, createdAt, id)를 keyset으로 비교하고, 경계 뒤 한 행을 더 읽어 연결선 연속성을 확정한다 */
function selectedConversationOf(
  database: TodoCommentDatabase,
  params: ListTodoConversationParams,
  parts: ConversationParts,
) {
  const { tree, anchor, order, cursorRoot } = parts;
  // 다음·이전 페이지는 cursor에 담긴 묶음 머리 점수를 경계로 쓴다. 그 묶음의 행은 점수가 바뀌어도 경계 자리에 둔다
  const rootBoundary =
    params.sort === TODO_COMMENT_SORT.LATEST
      ? [anchor.rootCreatedAt, anchor.threadId]
      : [
          cursorRoot?.position.rootLikeCount ?? anchor.rootLikeCount,
          cursorRoot?.position.rootReplyCount ?? anchor.rootReplyCount,
          anchor.rootCreatedAt,
          anchor.threadId,
        ];
  const threadBoundary = [isNotNull(anchor.parentId), anchor.createdAt, anchor.id];
  const afterAnchor = or(
    and(ne(tree.threadId, anchor.threadId), tupleLessThan(order.rootKey(tree), rootBoundary)),
    and(
      eq(tree.threadId, anchor.threadId),
      tupleGreaterThan(order.threadKey(tree), threadBoundary),
    ),
  );
  const beforeAnchor = or(
    and(ne(tree.threadId, anchor.threadId), tupleGreaterThan(order.rootKey(tree), rootBoundary)),
    and(eq(tree.threadId, anchor.threadId), tupleLessThan(order.threadKey(tree), threadBoundary)),
  );
  const visible = or(isNull(tree.deletedAt), gt(tree.replyCount, 0));
  const page = (
    condition: SQL | undefined,
    orderBy: ReturnType<ConversationParts["order"]["displayOrder"]>,
  ) =>
    database
      .select(treeColumnsOf(tree))
      .from(tree)
      .innerJoin(anchor, condition)
      .where(visible)
      .orderBy(...orderBy)
      .limit(params.size + 1);
  const sameThread = eq(tree.threadId, anchor.threadId);
  const scopeCondition = params.scope === "THREAD" ? sameThread : undefined;
  const anchorRow = () =>
    database.select(treeColumnsOf(tree)).from(tree).innerJoin(anchor, eq(tree.id, anchor.id));
  return database.$with("selected").as(() =>
    match(params.mode)
      .with("INITIAL", () =>
        database
          .select(treeColumnsOf(tree))
          .from(tree)
          .where(visible)
          .orderBy(...order.displayOrder(tree, true))
          .limit(params.size + 1),
      )
      .with("AFTER", () =>
        page(and(scopeCondition, afterAnchor), order.displayOrder(tree, true)).unionAll(
          anchorRow(),
        ),
      )
      .with("BEFORE", () =>
        page(and(scopeCondition, beforeAnchor), order.reverseOrder(tree)).unionAll(anchorRow()),
      )
      .with("FOCUS", () =>
        page(and(sameThread, beforeAnchor), order.reverseOrder(tree))
          .unionAll(anchorRow())
          .unionAll(page(and(sameThread, afterAnchor), order.displayOrder(tree, true))),
      )
      .exhaustive(),
  );
}

function rootPositionAt(
  row: {
    readonly threadId: string;
    readonly rootLikeCount: number;
    readonly rootReplyCount: number;
  },
  cursorRoot: CursorRoot | null,
): TodoCommentRootPositionReadModel {
  return cursorRoot != null && row.threadId === cursorRoot.threadId
    ? cursorRoot.position
    : toRootPosition(row);
}

@Injectable()
export class DrizzleTodoConversationReader implements TodoConversationReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async findConversationWindow(
    params: ListTodoConversationParams,
  ): Promise<TodoConversationWindowReadModel | null> {
    const isCursorPage = params.mode === "AFTER" || params.mode === "BEFORE";
    if (
      isCursorPage &&
      (params.anchorCommentId == null ||
        params.anchorThreadId == null ||
        params.anchorPosition == null)
    ) {
      return null;
    }
    const database = this.#db;
    const cursorRoot =
      params.anchorPosition == null || params.anchorThreadId == null
        ? null
        : { threadId: params.anchorThreadId.value, position: params.anchorPosition };
    const order = conversationOrderOf(params.sort === TODO_COMMENT_SORT.LATEST, cursorRoot);
    const threads = conversationThreadsOf(database, params);
    const tree = conversationTreeOf(database, threads);
    const anchor = conversationAnchorOf(database, tree, params);
    const selected = selectedConversationOf(database, params, { tree, anchor, order, cursorRoot });
    const source = columnsOf(selected);
    const rows = await (
      params.mode === "INITIAL"
        ? database.with(threads, tree, selected)
        : database.with(threads, tree, anchor, selected)
    )
      .select({
        ...projectionOf(source),
        threadId: selected.threadId,
        rootLikeCount: selected.rootLikeCount,
        rootReplyCount: selected.rootReplyCount,
      })
      .from(selected)
      .leftJoin(commentTodo, eq(commentTodo.todoId, source.todoId))
      .leftJoin(commentAuthor, eq(commentAuthor.userId, source.authorId))
      .leftJoin(replyTarget, eq(replyTarget.id, source.replyToCommentId))
      .leftJoin(replyTargetAuthor, eq(replyTargetAuthor.userId, replyTarget.authorId))
      .orderBy(...order.displayOrder(selected, params.mode !== "BEFORE"));
    if (params.mode !== "INITIAL" && rows.length === 0) {
      return null;
    }
    const items = rows.map((row): TodoConversationReadModel => ({
      ...requireTodoCommentReadModel(row),
      conversationPosition: rootPositionAt(row, cursorRoot),
    }));
    const window = toTodoCommentKeysetWindow({
      items,
      mode: params.mode,
      anchorId: params.anchorCommentId?.value,
      size: params.size,
    });
    return {
      items: window.items,
      anchorIndex: window.anchorIndex,
      previousItem: window.previousItem,
      nextItem: window.nextItem,
      hasPrevious: window.hasPrevious,
      hasNext: window.hasNext,
    };
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
