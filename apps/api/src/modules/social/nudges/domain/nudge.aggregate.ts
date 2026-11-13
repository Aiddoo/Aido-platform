import type { NudgeReplyKind } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { NudgeId } from "./nudge-id.vo.js";
import { NudgeMessage } from "./nudge-message.vo.js";
import { cannotNudgeSelf } from "./nudges.errors.js";

export interface NudgePrimitives {
  readonly id: number;
  readonly senderId: string;
  readonly receiverId: string;
  readonly todoId: number;
  readonly message: string | null;
  readonly readAt: Temporal.Instant | null;
  readonly createdAt: Temporal.Instant;
  readonly replyKind: NudgeReplyKind | null;
  readonly repliedAt: Temporal.Instant | null;
  readonly replyUpdatedAt: Temporal.Instant | null;
  readonly thankedAt: Temporal.Instant | null;
}

interface NudgeProps {
  readonly senderId: UserId;
  readonly receiverId: UserId;
  readonly todoId: number;
  readonly message: NudgeMessage | null;
  readAt: Temporal.Instant | null;
  readonly createdAt: Temporal.Instant;
  replyKind: NudgeReplyKind | null;
  repliedAt: Temporal.Instant | null;
  replyUpdatedAt: Temporal.Instant | null;
  thankedAt: Temporal.Instant | null;
}

interface CreateNudgeParams {
  readonly id: NudgeId;
  readonly senderId: UserId;
  readonly receiverId: UserId;
  readonly todoId: number;
  readonly message: NudgeMessage | null;
  readonly now: Temporal.Instant;
}

export class Nudge extends AggregateRoot<NudgeId, NudgeProps> {
  static create(params: CreateNudgeParams): Nudge {
    if (params.senderId.equals(params.receiverId)) {
      throw cannotNudgeSelf();
    }
    return new Nudge(params.id, {
      senderId: params.senderId,
      receiverId: params.receiverId,
      todoId: params.todoId,
      message: params.message,
      readAt: null,
      createdAt: params.now,
      replyKind: null,
      repliedAt: null,
      replyUpdatedAt: null,
      thankedAt: null,
    });
  }

  static reconstitute(primitives: NudgePrimitives): Nudge {
    return new Nudge(NudgeId.reconstitute(primitives.id), {
      senderId: UserId.reconstitute(primitives.senderId),
      receiverId: UserId.reconstitute(primitives.receiverId),
      todoId: primitives.todoId,
      message: primitives.message == null ? null : NudgeMessage.reconstitute(primitives.message),
      readAt: primitives.readAt,
      createdAt: primitives.createdAt,
      replyKind: primitives.replyKind,
      repliedAt: primitives.repliedAt,
      replyUpdatedAt: primitives.replyUpdatedAt,
      thankedAt: primitives.thankedAt,
    });
  }

  get senderId(): UserId {
    return this.props.senderId;
  }

  get receiverId(): UserId {
    return this.props.receiverId;
  }

  get todoId(): number {
    return this.props.todoId;
  }

  get message(): NudgeMessage | null {
    return this.props.message;
  }

  get readAt(): Temporal.Instant | null {
    return this.props.readAt;
  }

  get createdAt(): Temporal.Instant {
    return this.props.createdAt;
  }

  get replyKind(): NudgeReplyKind | null {
    return this.props.replyKind;
  }

  get repliedAt(): Temporal.Instant | null {
    return this.props.repliedAt;
  }

  get replyUpdatedAt(): Temporal.Instant | null {
    return this.props.replyUpdatedAt;
  }

  get thankedAt(): Temporal.Instant | null {
    return this.props.thankedAt;
  }

  isReceivedBy(userId: UserId): boolean {
    return this.props.receiverId.equals(userId);
  }

  hasReplied(): boolean {
    return this.props.repliedAt != null;
  }

  markRead(now: Temporal.Instant): boolean {
    if (this.props.readAt != null) {
      return false;
    }
    this.props.readAt = now;
    return true;
  }

  // 첫 답장 시각은 남기고 변경 시각만 바꾼다. 답장은 읽음도 겸한다
  reply(replyKind: NudgeReplyKind, now: Temporal.Instant): boolean {
    if (this.props.replyKind === replyKind) {
      return false;
    }
    this.props.replyKind = replyKind;
    this.props.repliedAt ??= now;
    this.props.replyUpdatedAt = now;
    this.markRead(now);
    return true;
  }

  markThanked(now: Temporal.Instant): boolean {
    if (this.props.thankedAt != null) {
      return false;
    }
    this.props.thankedAt = now;
    return true;
  }

  toPrimitives(): NudgePrimitives {
    return {
      id: this.id.value,
      senderId: this.props.senderId.value,
      receiverId: this.props.receiverId.value,
      todoId: this.props.todoId,
      message: this.props.message?.value ?? null,
      readAt: this.props.readAt,
      createdAt: this.props.createdAt,
      replyKind: this.props.replyKind,
      repliedAt: this.props.repliedAt,
      replyUpdatedAt: this.props.replyUpdatedAt,
      thankedAt: this.props.thankedAt,
    };
  }
}
