import { AggregateRoot } from "#api/shared/domain/index";

import {
  planReorderRelativeTo,
  planReorderToEdge,
  type ReorderPlan,
  type ReorderPosition,
} from "../../policies/friends/friend-reorder.policy.js";
import {
  FriendshipStatus,
  type FriendshipStatusValue,
} from "../../value-objects/friends/friendship-status.vo.js";

export interface FriendshipProps {
  id: string;
  followerId: string;
  followingId: string;
  status: FriendshipStatusValue;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Friendship extends AggregateRoot<
  Omit<FriendshipProps, "status"> & { status: FriendshipStatus }
> {
  static reconstitute(props: FriendshipProps): Friendship {
    return new Friendship({
      id: props.id,
      followerId: props.followerId,
      followingId: props.followingId,
      sortOrder: props.sortOrder,
      status: FriendshipStatus.of(props.status),
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
    });
  }

  get id(): string {
    return this.props.id;
  }

  get followerId(): string {
    return this.props.followerId;
  }

  get followingId(): string {
    return this.props.followingId;
  }

  get status(): FriendshipStatusValue {
    return this.props.status.raw;
  }

  get sortOrder(): number {
    return this.props.sortOrder;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }

  isPending(): boolean {
    return this.props.status.isPending();
  }

  isAccepted(): boolean {
    return this.props.status.isAccepted();
  }

  accept(sortOrder: number): void {
    this.props.status = this.props.status.accept();
    this.props.sortOrder = sortOrder;
  }

  toUpdate(): { status: FriendshipStatusValue; sortOrder: number } {
    return {
      status: this.props.status.raw,
      sortOrder: this.props.sortOrder,
    };
  }

  planReorderRelativeTo(targetSortOrder: number, position: ReorderPosition): ReorderPlan {
    return planReorderRelativeTo(this.props.sortOrder, targetSortOrder, position);
  }

  planReorderToEdge(position: ReorderPosition, maxSortOrder: number): ReorderPlan {
    return planReorderToEdge(this.props.sortOrder, position, maxSortOrder);
  }
}
