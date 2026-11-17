import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import {
  type TodoId,
  TodoDetailsReaderPort,
} from "#api/modules/planning/todos/planning-todos-queries.public";
import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCommentAccessReaderPort } from "../../application/ports/todo-comment-access.reader.port.js";
import type { TodoDetailsReadModel } from "../../application/read-models/todo-comment.read-model.js";

@Injectable()
export class DrizzleTodoCommentAccessReader implements TodoCommentAccessReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #todoDetails: Pick<TodoDetailsReaderPort, "findAccess" | "findDetails">;

  constructor(
    transactionHost: TransactionHost<DrizzleTransactionalAdapter>,
    todoDetails: TodoDetailsReaderPort,
  ) {
    this.#transactionHost = transactionHost;
    this.#todoDetails = todoDetails;
  }

  async findAccessibleTodoOwnerId(todoId: TodoId, viewerId: UserId): Promise<UserId | null> {
    const access = await this.#todoDetails.findAccess(todoId);
    if (access == null) {
      return null;
    }
    const ownerId = UserId.reconstitute(access.ownerId);
    if (ownerId.equals(viewerId)) {
      return ownerId;
    }
    if (access.visibility !== "PUBLIC") {
      return null;
    }
    return (await this.#isAcceptedFriend(access.ownerId, viewerId.value)) ? ownerId : null;
  }

  async findAccessibleTodoDetails(
    todoId: TodoId,
    viewerId: UserId,
  ): Promise<TodoDetailsReadModel | null> {
    const details = await this.#todoDetails.findDetails(todoId);
    if (details == null) {
      return null;
    }
    const { todo } = details;
    const isOwner = todo.userId === viewerId.value;
    const canAccess =
      isOwner ||
      (todo.visibility === "PUBLIC" && (await this.#isAcceptedFriend(todo.userId, viewerId.value)));
    if (!canAccess) {
      return null;
    }
    const owner = requireRecord(
      await this.#db.query.user.findFirst({
        columns: { id: true },
        where: { id: todo.userId },
        with: { profile: { columns: { name: true, profileImage: true } } },
      }),
    );
    return {
      todo,
      owner: {
        id: owner.id,
        name: owner.profile?.name ?? null,
        profileImage: owner.profile?.profileImage ?? null,
      },
      viewCount: details.viewCount,
      commentCount: todo.commentCount,
      isOwner,
    };
  }

  async #isAcceptedFriend(firstUserId: string, secondUserId: string): Promise<boolean> {
    const friendship = await this.#db.query.friendship.findFirst({
      columns: { id: true },
      where: {
        status: "ACCEPTED",
        OR: [
          { followerId: firstUserId, followingId: secondUserId },
          { followerId: secondUserId, followingId: firstUserId },
        ],
      },
    });
    return friendship != null;
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
