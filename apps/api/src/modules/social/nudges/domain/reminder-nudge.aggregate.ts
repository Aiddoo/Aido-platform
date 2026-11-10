import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { NudgeMessage } from "./nudge-message.vo.js";
import { ReminderNudgeId } from "./reminder-nudge-id.vo.js";

export interface ReminderNudgePrimitives {
  readonly id: number;
  readonly senderId: string;
  readonly receiverId: string;
  readonly message: string | null;
  readonly createdAt: Temporal.Instant;
}

interface ReminderNudgeProps {
  readonly senderId: UserId;
  readonly receiverId: UserId;
  readonly message: NudgeMessage | null;
  readonly createdAt: Temporal.Instant;
}

interface CreateReminderNudgeParams {
  readonly id: ReminderNudgeId;
  readonly senderId: UserId;
  readonly receiverId: UserId;
  readonly message: NudgeMessage | null;
  readonly now: Temporal.Instant;
}

// 오늘 할 일을 만들지 않은 친구에게 보내는 독촉 콕
export class ReminderNudge extends AggregateRoot<ReminderNudgeId, ReminderNudgeProps> {
  static create(params: CreateReminderNudgeParams): ReminderNudge {
    if (params.senderId.equals(params.receiverId)) {
      throw new DomainException(ErrorCode.NUDGE_1104);
    }
    return new ReminderNudge(params.id, {
      senderId: params.senderId,
      receiverId: params.receiverId,
      message: params.message,
      createdAt: params.now,
    });
  }

  static reconstitute(primitives: ReminderNudgePrimitives): ReminderNudge {
    return new ReminderNudge(ReminderNudgeId.reconstitute(primitives.id), {
      senderId: UserId.reconstitute(primitives.senderId),
      receiverId: UserId.reconstitute(primitives.receiverId),
      message: primitives.message == null ? null : NudgeMessage.reconstitute(primitives.message),
      createdAt: primitives.createdAt,
    });
  }

  get senderId(): UserId {
    return this.props.senderId;
  }

  get receiverId(): UserId {
    return this.props.receiverId;
  }

  get message(): NudgeMessage | null {
    return this.props.message;
  }

  get createdAt(): Temporal.Instant {
    return this.props.createdAt;
  }

  toPrimitives(): ReminderNudgePrimitives {
    return {
      id: this.id.value,
      senderId: this.props.senderId.value,
      receiverId: this.props.receiverId.value,
      message: this.props.message?.value ?? null,
      createdAt: this.props.createdAt,
    };
  }
}
