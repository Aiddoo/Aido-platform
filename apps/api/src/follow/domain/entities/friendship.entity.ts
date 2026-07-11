import {
	planReorderRelativeTo,
	planReorderToEdge,
	type ReorderPlan,
	type ReorderPosition,
} from "../services/friend-reorder";
import {
	FriendshipStatus,
	type FriendshipStatusValue,
} from "../value-objects/friendship-status.vo";

export interface FriendshipProps {
	id: string;
	followerId: string;
	followingId: string;
	status: FriendshipStatusValue;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Friendship — 팔로우(친구) 관계 애그리게잇.
 *
 * 한 방향의 팔로우 관계를 나타내며, 상태(FriendshipStatus VO)와 정렬 순서를 소유한다.
 * 상태 판별과 재정렬 계획 계산 등 관계에 관한 규칙을 캡슐화한다. 세터는 없다(불변 조회 모델).
 */
export class Friendship {
	private constructor(
		private readonly _id: string,
		private readonly _followerId: string,
		private readonly _followingId: string,
		private readonly _status: FriendshipStatus,
		private readonly _sortOrder: number,
		private readonly _createdAt: Date,
		private readonly _updatedAt: Date,
	) {}

	static reconstitute(props: FriendshipProps): Friendship {
		return new Friendship(
			props.id,
			props.followerId,
			props.followingId,
			FriendshipStatus.of(props.status),
			props.sortOrder,
			props.createdAt,
			props.updatedAt,
		);
	}

	get id(): string {
		return this._id;
	}

	get followerId(): string {
		return this._followerId;
	}

	get followingId(): string {
		return this._followingId;
	}

	get status(): FriendshipStatusValue {
		return this._status.raw;
	}

	get sortOrder(): number {
		return this._sortOrder;
	}

	get createdAt(): Date {
		return this._createdAt;
	}

	get updatedAt(): Date {
		return this._updatedAt;
	}

	isPending(): boolean {
		return this._status.isPending();
	}

	isAccepted(): boolean {
		return this._status.isAccepted();
	}

	/** 기준 대상(targetSortOrder)의 앞/뒤로 이동하는 재정렬 계획 */
	planReorderRelativeTo(
		targetSortOrder: number,
		position: ReorderPosition,
	): ReorderPlan {
		return planReorderRelativeTo(this._sortOrder, targetSortOrder, position);
	}

	/** 목록의 맨 앞/뒤로 이동하는 재정렬 계획 */
	planReorderToEdge(
		position: ReorderPosition,
		maxSortOrder: number,
	): ReorderPlan {
		return planReorderToEdge(this._sortOrder, position, maxSortOrder);
	}
}
