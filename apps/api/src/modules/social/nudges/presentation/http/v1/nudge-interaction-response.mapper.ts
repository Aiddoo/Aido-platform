import type {
  NudgeInteractionResponse,
  NudgeInteractionsResponse,
  NudgeThanksPreviewResponse,
} from "@aido/api";

import type { CursorPage } from "#api/shared/application/cursor-page";

import type {
  NudgeInteractionReadModel,
  NudgeThanksPreviewReadModel,
} from "../../../application/read-models/nudge-interaction.read-model.js";
import {
  toNudgeResponse,
  toNudgeUserResponse,
  toNullableIsoString,
} from "./nudge-response.mapper.js";

// 할 일 정보는 지금 답장·감사할 수 있거나 내가 받은 콕일 때만 보여 준다(비공개 전환·관계 해제 뒤 노출 방지)
export function toNudgeInteractionResponse(
  nudge: NudgeInteractionReadModel,
  viewerId: string,
  appVersion?: string,
): NudgeInteractionResponse {
  return {
    ...toNudgeResponse(nudge),
    sender: toNudgeUserResponse(nudge.sender, appVersion),
    receiver: toNudgeUserResponse(nudge.receiver, appVersion),
    todo:
      nudge.isAvailable || nudge.receiverId === viewerId
        ? { id: nudge.todo.id, title: nudge.todo.title, completed: nudge.todo.completed }
        : null,
    replyKind: nudge.replyKind,
    repliedAt: toNullableIsoString(nudge.repliedAt),
    replyUpdatedAt: toNullableIsoString(nudge.replyUpdatedAt),
    thankedAt: toNullableIsoString(nudge.thankedAt),
    isAvailable: nudge.isAvailable,
  };
}

export function toNudgeInteractionsResponse(
  page: CursorPage<NudgeInteractionReadModel, number>,
  viewerId: string,
  appVersion?: string,
): NudgeInteractionsResponse {
  return {
    items: page.items.map((nudge) => toNudgeInteractionResponse(nudge, viewerId, appVersion)),
    pagination: page.pagination,
  };
}

export function toNudgeThanksPreviewResponse(
  preview: NudgeThanksPreviewReadModel,
  appVersion?: string,
): NudgeThanksPreviewResponse {
  return {
    todoId: preview.todoId,
    throughNudgeId: preview.throughNudgeId,
    recipients: preview.recipients.map((user) => toNudgeUserResponse(user, appVersion)),
    ...preview.pagination,
    thankedRecipientCount: preview.thankedRecipientCount,
    lastThankedAt: toNullableIsoString(preview.lastThankedAt),
  };
}
