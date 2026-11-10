import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { FollowReaderPort } from "#api/modules/social/friends/social-friends.public";
import { toCursorPage } from "#api/shared/application/cursor-page";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NudgeId } from "../../domain/nudge-id.vo.js";
import {
  nudgeInteractionNotFound,
  thanksTodoNotCompleted,
  thanksTodoNotFound,
} from "../nudges.errors.js";
import type { NudgeInteractionConfigPort } from "../ports/nudge-interaction-config.port.js";
import type { NudgeReaderPort } from "../ports/nudge.reader.port.js";
import type { NudgeThanksPreview } from "../read-models/nudge-interaction.read-model.js";

export interface GetNudgeThanksPreviewQuery {
  readonly userId: string;
  readonly todoId: number;
  readonly limit?: number;
  readonly cursor?: number;
  readonly throughNudgeId?: number;
}

export interface GetNudgeThanksPreviewDependencies {
  readonly nudgeReader: Pick<
    NudgeReaderPort,
    | "findInteraction"
    | "findInteractionTodo"
    | "findLastReceivedNudgeId"
    | "countThankedRecipients"
    | "findLastThankedAt"
    | "listThanksRecipients"
    | "countThanksRecipients"
  >;
  readonly interactionConfig: NudgeInteractionConfigPort;
  readonly followReader: Pick<FollowReaderPort, "getCurrentMutualFriendIds">;
}

export class GetNudgeThanksPreviewUseCase {
  readonly #dependencies: GetNudgeThanksPreviewDependencies;

  constructor(dependencies: GetNudgeThanksPreviewDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetNudgeThanksPreviewQuery): Promise<NudgeThanksPreview> {
    const { nudgeReader, interactionConfig, followReader } = this.#dependencies;
    if (!interactionConfig.isEnabled) {
      throw nudgeInteractionNotFound();
    }
    const ownerId = UserId.reconstitute(query.userId);
    const todoId = TodoId.reconstitute(query.todoId);
    const todo = await nudgeReader.findInteractionTodo(todoId, ownerId);
    if (todo == null) {
      throw thanksTodoNotFound();
    }
    if (!todo.completed) {
      throw thanksTodoNotCompleted();
    }

    // 다음 페이지는 첫 미리보기 시점의 마지막 콕까지만 보여 그 사이 새 콕이 끼어들지 않게 한다
    if (query.throughNudgeId != null) {
      const cutoff = await nudgeReader.findInteraction(
        NudgeId.reconstitute(query.throughNudgeId),
        ownerId,
      );
      if (cutoff == null || cutoff.todoId !== query.todoId || cutoff.receiverId !== query.userId) {
        throw nudgeInteractionNotFound();
      }
    }
    const [throughNudgeId, thankedRecipientCount, lastThankedAt] = await Promise.all([
      query.throughNudgeId == null
        ? nudgeReader.findLastReceivedNudgeId(todoId, ownerId)
        : NudgeId.reconstitute(query.throughNudgeId),
      nudgeReader.countThankedRecipients(todoId, ownerId),
      nudgeReader.findLastThankedAt(todoId, ownerId),
    ]);
    const preview = { todoId: query.todoId, thankedRecipientCount, lastThankedAt };
    if (throughNudgeId == null || todo.visibility !== "PUBLIC") {
      return {
        ...preview,
        throughNudgeId: throughNudgeId?.value ?? null,
        recipients: [],
        pagination: { totalRecipients: 0, nextCursor: null, hasNext: false },
      };
    }

    const friendIds = await followReader.getCurrentMutualFriendIds(ownerId);
    const candidateQuery = {
      ownerId,
      todoId,
      throughNudgeId,
      friendIds: friendIds.map((friendId) => UserId.reconstitute(friendId)),
    };
    if (query.limit == null) {
      const recipients = await nudgeReader.listThanksRecipients({
        ...candidateQuery,
        afterNudgeId: null,
        limit: null,
      });
      return {
        ...preview,
        throughNudgeId: throughNudgeId.value,
        recipients: recipients.map((recipient) => recipient.sender),
        pagination: null,
      };
    }

    const [rows, totalRecipients] = await Promise.all([
      nudgeReader.listThanksRecipients({
        ...candidateQuery,
        afterNudgeId: query.cursor == null ? null : NudgeId.reconstitute(query.cursor),
        limit: query.limit + 1,
      }),
      nudgeReader.countThanksRecipients(candidateQuery),
    ]);
    const page = toCursorPage({ rows, size: query.limit, toCursor: (row) => row.nudgeId });
    return {
      ...preview,
      throughNudgeId: throughNudgeId.value,
      recipients: page.items.map((recipient) => recipient.sender),
      pagination: {
        totalRecipients,
        nextCursor: page.pagination.nextCursor,
        hasNext: page.pagination.hasNext,
      },
    };
  }
}
