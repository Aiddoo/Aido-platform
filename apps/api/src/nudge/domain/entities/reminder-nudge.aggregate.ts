import { ErrorCode } from "@aido/api/errors";

import { AggregateRoot, DomainException } from "#api/shared/domain/index";

import { NudgeMessage } from "../value-objects/nudge-message.vo.js";

export interface ReminderNudgeProps {
  id: number;
  senderId: string;
  receiverId: string;
  message: string | null;
  createdAt: Date;
}

/**
 * ReminderNudge — 리마인드 콕 찌르기 애그리게잇.
 *
 * 친구가 오늘 할 일을 만들지 않았을 때 보내는 독촉 콕 찌르기 한 건을 나타낸다.
 * 특정 할 일에 묶이지 않으며(todoId 없음), 쿨다운 판정을 위한 생성 시각을 소유한다. 세터는 없다.
 */
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
    return new ReminderNudge({ ...props, createdAt: new Date(props.createdAt) });
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
