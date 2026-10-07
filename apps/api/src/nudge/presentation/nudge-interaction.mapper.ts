import type { NudgeInteractionResponse, NudgeThanksPreviewResponse, NudgeSender } from "@aido/api";

import { toISOStringOrNull } from "#api/shared/domain/date/utils/format";
import { resolveProfileImage } from "#api/shared/presentation/profile/profile-image.resolver";

import type {
  NudgeInteractionResult,
  NudgeThanksPreviewResult,
} from "../application/nudge-interaction.types.js";
import type { NudgeUserBrief } from "../application/ports/nudge.repository.port.js";
import { NudgeMapper } from "./nudge.mapper.js";

export abstract class NudgeInteractionMapper {
  static toUserDto(user: NudgeUserBrief, appVersion?: string): NudgeSender {
    return {
      id: user.id,
      userTag: user.userTag,
      name: user.profile?.name ?? null,
      profileImage: resolveProfileImage(user.profile?.profileImage ?? null, appVersion),
    };
  }

  static toDto(
    nudge: NudgeInteractionResult,
    userId: string,
    appVersion?: string,
  ): NudgeInteractionResponse {
    return {
      ...NudgeMapper.toDto(nudge),
      sender: NudgeInteractionMapper.toUserDto(nudge.sender, appVersion),
      receiver: NudgeInteractionMapper.toUserDto(nudge.receiver, appVersion),
      todo:
        nudge.isAvailable || nudge.receiverId === userId
          ? { id: nudge.todo.id, title: nudge.todo.title, completed: nudge.todo.completed }
          : null,
      replyKind: nudge.replyKind,
      repliedAt: toISOStringOrNull(nudge.repliedAt),
      replyUpdatedAt: toISOStringOrNull(nudge.replyUpdatedAt),
      thankedAt: toISOStringOrNull(nudge.thankedAt),
      isAvailable: nudge.isAvailable,
    };
  }

  static toThanksPreviewDto(
    preview: NudgeThanksPreviewResult,
    appVersion?: string,
  ): NudgeThanksPreviewResponse {
    return {
      ...preview,
      recipients: preview.recipients.map((user) =>
        NudgeInteractionMapper.toUserDto(user, appVersion),
      ),
    };
  }
}
