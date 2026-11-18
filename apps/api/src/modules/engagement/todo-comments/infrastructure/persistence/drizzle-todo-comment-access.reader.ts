import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, or } from "drizzle-orm";

import { userDisplayProfiles } from "#api/modules/identity/users/identity-users-queries.public";
import {
  type TodoId,
  TodoDetailsReaderPort,
} from "#api/modules/planning/todos/planning-todos-queries.public";
import { acceptedFriendshipsOf } from "#api/modules/social/friendships/social-friendships.public";
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
    const display = userDisplayProfiles("todo_owner");
    const [owner] = await this.#db
      .select({ id: display.userId, name: display.name, profileImage: display.profileImage })
      .from(display)
      .where(eq(display.userId, todo.userId))
      .limit(1);
    return {
      todo,
      owner: requireRecord(owner),
      viewCount: details.viewCount,
      commentCount: todo.commentCount,
      isOwner,
    };
  }

  async #isAcceptedFriend(firstUserId: string, secondUserId: string): Promise<boolean> {
    const friendships = acceptedFriendshipsOf([firstUserId]);
    const [friendship] = await this.#db
      .select({ followerId: friendships.followerId })
      .from(friendships)
      .where(
        or(
          and(eq(friendships.followerId, firstUserId), eq(friendships.followingId, secondUserId)),
          and(eq(friendships.followerId, secondUserId), eq(friendships.followingId, firstUserId)),
        ),
      )
      .limit(1);
    return friendship != null;
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
