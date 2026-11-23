import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCommentId } from "../../../todo-comments/domain/todo-comment-id.vo.js";
import { TodoCommentLikeReaderPort } from "../../application/ports/todo-comment-like.reader.port.js";

@Injectable()
export class DrizzleTodoCommentLikeReader implements TodoCommentLikeReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async listLikedCommentIds(
    commentIds: readonly TodoCommentId[],
    viewerId: UserId,
  ): Promise<ReadonlySet<string>> {
    if (commentIds.length === 0) {
      return new Set();
    }
    const likes = await this.#db.query.todoCommentLike.findMany({
      columns: { commentId: true },
      where: {
        commentId: { in: commentIds.map((commentId) => commentId.value) },
        userId: viewerId.value,
        isActive: true,
      },
    });
    return new Set(likes.map((like) => like.commentId));
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
