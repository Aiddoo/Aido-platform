import { ErrorCode } from "@aido/api/errors";

import { AggregateRoot, DomainException } from "#api/shared/domain/index";

import { NudgeMessage } from "../../value-objects/nudges/nudge-message.vo.js";

export interface ReminderNudgeProps {
  id: number;
  senderId: string;
  receiverId: string;
  message: string | null;
  createdAt: Date;
}

export class ReminderNudge extends AggregateRoot<ReminderNudgeProps> {
  private constructor(props: ReminderNudgeProps) {
    super(props);
  }

  static planCreation(input: {
    readonly senderId: string;
    readonly receiverId: string;
    readonly message?: string;
  }): { senderId: string; receiverId: string; message?: string } {
    if (input.senderId === input.receiverId) {
      throw new DomainException(ErrorCode.NUDGE_1104);
    }
    return { ...input, message: NudgeMessage.of(input.message).raw };
  }

  static reconstitute(props: ReminderNudgeProps): ReminderNudge {
    return new ReminderNudge({
      id: props.id,
      senderId: props.senderId,
      receiverId: props.receiverId,
      message: props.message,
      createdAt: new Date(props.createdAt),
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

  get message(): string | null {
    return this.props.message;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }
}
