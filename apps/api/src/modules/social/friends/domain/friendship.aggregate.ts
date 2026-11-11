import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { FriendshipId } from "./friendship-id.vo.js";
import { FriendshipStatus, type FriendshipStatusValue } from "./friendship-status.vo.js";

export interface FriendshipPrimitives {
  readonly id: string;
  readonly followerId: string;
  readonly followingId: string;
  readonly status: FriendshipStatusValue;
  readonly sortOrder: number;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
}

interface FriendshipProps {
  readonly followerId: UserId;
  readonly followingId: UserId;
  status: FriendshipStatus;
  sortOrder: number;
  readonly createdAt: Temporal.Instant;
  updatedAt: Temporal.Instant;
}

interface CreateFriendshipParams {
  readonly id: FriendshipId;
  readonly followerId: UserId;
  readonly followingId: UserId;
  readonly now: Temporal.Instant;
}

// 한 방향 관계다. 두 방향이 모두 ACCEPTED여야 친구이고, 친구 목록 순서는 follower 쪽 sortOrder다
export class Friendship extends AggregateRoot<FriendshipId, FriendshipProps> {
  // 새 친구 요청이다. 아직 친구 목록에 없어 순서는 0이다
  static create(params: CreateFriendshipParams): Friendship {
    return new Friendship(params.id, {
      followerId: params.followerId,
      followingId: params.followingId,
      status: FriendshipStatus.reconstitute("PENDING"),
      sortOrder: 0,
      createdAt: params.now,
      updatedAt: params.now,
    });
  }

  static reconstitute(primitives: FriendshipPrimitives): Friendship {
    return new Friendship(FriendshipId.reconstitute(primitives.id), {
      followerId: UserId.reconstitute(primitives.followerId),
      followingId: UserId.reconstitute(primitives.followingId),
      status: FriendshipStatus.reconstitute(primitives.status),
      sortOrder: primitives.sortOrder,
      createdAt: primitives.createdAt,
      updatedAt: primitives.updatedAt,
    });
  }

  get followerId(): UserId {
    return this.props.followerId;
  }

  get followingId(): UserId {
    return this.props.followingId;
  }

  get status(): FriendshipStatus {
    return this.props.status;
  }

  get sortOrder(): number {
    return this.props.sortOrder;
  }

  get createdAt(): Temporal.Instant {
    return this.props.createdAt;
  }

  get updatedAt(): Temporal.Instant {
    return this.props.updatedAt;
  }

  isPending(): boolean {
    return this.props.status.isPending();
  }

  isAccepted(): boolean {
    return this.props.status.isAccepted();
  }

  // 수락한 관계는 follower 친구 목록의 sortOrder 자리에 들어간다. updatedAt이 친구가 된 시각(friendsSince)이다
  accept(sortOrder: number, now: Temporal.Instant): boolean {
    if (this.props.status.isAccepted() && this.props.sortOrder === sortOrder) {
      return false;
    }
    this.props.status = FriendshipStatus.reconstitute("ACCEPTED");
    this.props.sortOrder = sortOrder;
    this.props.updatedAt = now;
    return true;
  }

  moveTo(sortOrder: number, now: Temporal.Instant): boolean {
    if (this.props.sortOrder === sortOrder) {
      return false;
    }
    this.props.sortOrder = sortOrder;
    this.props.updatedAt = now;
    return true;
  }

  toPrimitives(): FriendshipPrimitives {
    return {
      id: this.id.value,
      followerId: this.props.followerId.value,
      followingId: this.props.followingId.value,
      status: this.props.status.value,
      sortOrder: this.props.sortOrder,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
