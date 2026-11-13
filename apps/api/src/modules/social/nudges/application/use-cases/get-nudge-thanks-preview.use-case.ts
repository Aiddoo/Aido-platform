import { match } from "ts-pattern";

import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { MutualFriendReaderPort } from "#api/modules/social/friends/social-friends.public";
import { toCursorPage } from "#api/shared/application/cursor-page";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NudgeId } from "../../domain/nudge-id.vo.js";
import { decideNudgeThanksPreviewScope } from "../../domain/nudge-interaction.domain-service.js";
import {
  nudgeInteractionDisabled,
  nudgeInteractionNotFound,
  thanksTodoNotFound,
} from "../nudges.errors.js";
import type { NudgeInteractionConfigPort } from "../ports/nudge-interaction-config.port.js";
import type { NudgeReaderPort } from "../ports/nudge.reader.port.js";
import type { NudgeThanksPreview } from "../read-models/nudge-interaction.read-model.js";

const EMPTY_PAGINATION = { totalRecipients: 0, nextCursor: null, hasNext: false } as const;

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
  readonly mutualFriendReader: Pick<MutualFriendReaderPort, "getCurrentMutualFriendIds">;
}

interface ThanksPreviewTarget {
  readonly ownerId: UserId;
  readonly todoId: TodoId;
  readonly canListRecipients: boolean;
}

export class GetNudgeThanksPreviewUseCase {
  readonly #dependencies: GetNudgeThanksPreviewDependencies;

  constructor(dependencies: GetNudgeThanksPreviewDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetNudgeThanksPreviewQuery): Promise<NudgeThanksPreview> {
    const { nudgeReader, interactionConfig } = this.#dependencies;
    if (!interactionConfig.isEnabled) {
      throw nudgeInteractionDisabled();
    }
    const ownerId = UserId.reconstitute(query.userId);
    const todoId = TodoId.reconstitute(query.todoId);
    const todo = await nudgeReader.findInteractionTodo(todoId, ownerId);
    if (todo == null) {
      throw thanksTodoNotFound();
    }

    const scope = decideNudgeThanksPreviewScope({
      isTodoCompleted: todo.completed,
      todoVisibility: todo.visibility,
    });
    return match(scope)
      .with("none", () => emptyThanksPreview(query.todoId))
      .with("summary", () => this.#preview(query, { ownerId, todoId, canListRecipients: false }))
      .with("recipients", () => this.#preview(query, { ownerId, todoId, canListRecipients: true }))
      .exhaustive();
  }

  async #preview(
    query: GetNudgeThanksPreviewQuery,
    { ownerId, todoId, canListRecipients }: ThanksPreviewTarget,
  ): Promise<NudgeThanksPreview> {
    const { nudgeReader, mutualFriendReader } = this.#dependencies;
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
    if (throughNudgeId == null || !canListRecipients) {
      return {
        ...preview,
        throughNudgeId: throughNudgeId?.value ?? null,
        recipients: [],
        pagination: EMPTY_PAGINATION,
      };
    }

    const friendIds = await mutualFriendReader.getCurrentMutualFriendIds(ownerId);
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

// 응답 모양은 콕을 받지 않은 할 일의 미리보기와 같아 출시 앱이 아무것도 그리지 않는다
function emptyThanksPreview(todoId: number): NudgeThanksPreview {
  return {
    todoId,
    throughNudgeId: null,
    recipients: [],
    pagination: EMPTY_PAGINATION,
    thankedRecipientCount: 0,
    lastThankedAt: null,
  };
}
