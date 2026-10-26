import { ErrorCode } from "@aido/api/errors";

import { AggregateRoot, DomainException } from "#api/shared/domain/index";

export interface UserBlockProps {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: Date;
}

export interface UserBlockCreationInput {
  readonly blockerId: string;
  readonly blockedId: string;
  readonly createdAt: Date;
}

export type UserBlockCreationPlan = UserBlockCreationInput;

/**
 * 한 사용자가 다른 사용자를 차단한 관계.
 *
 * 차단은 방향이 있지만 효과는 양쪽에 같다. 두 사람의 친구 관계·요청이 끊기고 서로의 콘텐츠와
 * 상호작용이 막힌다. 차단당한 사람에게는 알리지 않는다.
 */
export class UserBlock extends AggregateRoot<UserBlockProps> {
  private constructor(props: UserBlockProps) {
    super(props);
  }

  static planCreation(input: UserBlockCreationInput): UserBlockCreationPlan {
    if (input.blockerId === input.blockedId) {
      throw new DomainException(ErrorCode.BLOCK_2201);
    }
    return { ...input, createdAt: new Date(input.createdAt) };
  }

  static reconstitute(props: UserBlockProps): UserBlock {
    return new UserBlock({
      id: props.id,
      blockerId: props.blockerId,
      blockedId: props.blockedId,
      createdAt: new Date(props.createdAt),
    });
  }

  get id(): string {
    return this.props.id;
  }

  get blockerId(): string {
    return this.props.blockerId;
  }

  get blockedId(): string {
    return this.props.blockedId;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }
}
