import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { UserBlockId } from "./user-block-id.vo.js";

export interface UserBlockPrimitives {
  readonly id: string;
  readonly blockerId: string;
  readonly blockedId: string;
  readonly createdAt: Temporal.Instant;
}

interface UserBlockProps {
  readonly blockerId: UserId;
  readonly blockedId: UserId;
  readonly createdAt: Temporal.Instant;
}

interface CreateUserBlockParams {
  readonly id: UserBlockId;
  readonly blockerId: UserId;
  readonly blockedId: UserId;
  readonly now: Temporal.Instant;
}

// 방향은 있지만 효과는 양쪽에 같다. 친구 관계가 끊기고 서로의 콘텐츠·상호작용이 막히며 차단당한 사람에게는 알리지 않는다
export class UserBlock extends AggregateRoot<UserBlockId, UserBlockProps> {
  static create(params: CreateUserBlockParams): UserBlock {
    if (params.blockerId.equals(params.blockedId)) {
      throw new DomainException(ErrorCode.BLOCK_2201);
    }
    return new UserBlock(params.id, {
      blockerId: params.blockerId,
      blockedId: params.blockedId,
      createdAt: params.now,
    });
  }

  static reconstitute(primitives: UserBlockPrimitives): UserBlock {
    return new UserBlock(UserBlockId.reconstitute(primitives.id), {
      blockerId: UserId.reconstitute(primitives.blockerId),
      blockedId: UserId.reconstitute(primitives.blockedId),
      createdAt: primitives.createdAt,
    });
  }

  get blockerId(): UserId {
    return this.props.blockerId;
  }

  get blockedId(): UserId {
    return this.props.blockedId;
  }

  get createdAt(): Temporal.Instant {
    return this.props.createdAt;
  }

  toPrimitives(): UserBlockPrimitives {
    return {
      id: this.id.value,
      blockerId: this.props.blockerId.value,
      blockedId: this.props.blockedId.value,
      createdAt: this.props.createdAt,
    };
  }
}
