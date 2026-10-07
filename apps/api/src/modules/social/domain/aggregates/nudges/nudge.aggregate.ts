import { ErrorCode } from "@aido/api/errors";
import type { NudgeReplyKind } from "@aido/api/vocabulary";

import { AggregateRoot, DomainException } from "#api/shared/domain/index";

import { NudgeMessage } from "../../value-objects/nudges/nudge-message.vo.js";

export interface NudgeProps {
  id: number;
  senderId: string;
  receiverId: string;
  todoId: number;
  message: string | null;
  readAt: Date | null;
  createdAt: Date;
  replyKind: NudgeReplyKind | null;
  repliedAt: Date | null;
  replyUpdatedAt: Date | null;
  thankedAt: Date | null;
}

export interface NudgeCreationInput {
  readonly senderId: string;
  readonly receiverId: string;
  readonly todoId: number;
  readonly message?: string;
  readonly createdAt: Date;
}

export type NudgeCreationPlan = NudgeCreationInput;

export class Nudge extends AggregateRoot<NudgeProps> {
  private constructor(props: NudgeProps) {
    super(props);
  }

  static planCreation(input: NudgeCreationInput): NudgeCreationPlan {
    if (input.senderId === input.receiverId) {
      throw new DomainException(ErrorCode.NUDGE_1104);
    }
    return {
      ...input,
      message: NudgeMessage.of(input.message).raw,
      createdAt: new Date(input.createdAt),
    };
  }

  static reconstitute(props: NudgeProps): Nudge {
    return new Nudge({
      id: props.id,
      senderId: props.senderId,
      receiverId: props.receiverId,
      todoId: props.todoId,
      message: props.message,
      replyKind: props.replyKind,
      readAt: props.readAt ? new Date(props.readAt) : null,
      createdAt: new Date(props.createdAt),
      repliedAt: props.repliedAt ? new Date(props.repliedAt) : null,
      replyUpdatedAt: props.replyUpdatedAt ? new Date(props.replyUpdatedAt) : null,
      thankedAt: props.thankedAt ? new Date(props.thankedAt) : null,
    });
  }

  get id(): number {
    return this.props.id;
  }

  get senderId(): string {
    return this.props.senderId;
  }

  get receiverId(): string {
    return this.props.receiverId;
  }

  get todoId(): number {
    return this.props.todoId;
  }

  get message(): string | null {
    return this.props.message;
  }

  get readAt(): Date | null {
    return this.props.readAt ? new Date(this.props.readAt) : null;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get replyKind(): NudgeReplyKind | null {
    return this.props.replyKind;
  }

  get repliedAt(): Date | null {
    return this.props.repliedAt ? new Date(this.props.repliedAt) : null;
  }

  get replyUpdatedAt(): Date | null {
    return this.props.replyUpdatedAt ? new Date(this.props.replyUpdatedAt) : null;
  }

  get thankedAt(): Date | null {
    return this.props.thankedAt ? new Date(this.props.thankedAt) : null;
  }

  isRead(): boolean {
    return this.props.readAt !== null;
  }

  isReceivedBy(userId: string): boolean {
    return this.props.receiverId === userId;
  }

  hasReplied(): boolean {
    return this.props.repliedAt !== null;
  }

  hasThanked(): boolean {
    return this.props.thankedAt !== null;
  }

  markRead(readAt: Date): boolean {
    if (this.isRead()) {
      return false;
    }
    this.props.readAt = new Date(readAt);
    return true;
  }

  reply(replyKind: NudgeReplyKind, repliedAt: Date): boolean {
    if (this.props.replyKind === replyKind) {
      return false;
    }
    this.props.replyKind = replyKind;
    this.props.repliedAt ??= new Date(repliedAt);
    this.props.replyUpdatedAt = new Date(repliedAt);
    this.markRead(repliedAt);
    return true;
  }

  markThanked(thankedAt: Date): boolean {
    if (this.hasThanked()) {
      return false;
    }
    this.props.thankedAt = new Date(thankedAt);
    return true;
  }

  toPersistence(): Pick<
    NudgeProps,
    "readAt" | "replyKind" | "repliedAt" | "replyUpdatedAt" | "thankedAt"
  > {
    return {
      readAt: this.readAt,
      replyKind: this.replyKind,
      repliedAt: this.repliedAt,
      replyUpdatedAt: this.replyUpdatedAt,
      thankedAt: this.thankedAt,
    };
  }
}
