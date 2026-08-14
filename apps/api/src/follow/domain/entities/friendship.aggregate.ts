import { AggregateRoot } from "@/shared/domain";

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
export class Friendship extends AggregateRoot<
	Omit<FriendshipProps, "status"> & { status: FriendshipStatus }
> {
	static reconstitute(props: FriendshipProps): Friendship {
		return new Friendship({
			...props,
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

	/** 기준 대상(targetSortOrder)의 앞/뒤로 이동하는 재정렬 계획 */
	planReorderRelativeTo(targetSortOrder: number, position: ReorderPosition): ReorderPlan {
		return planReorderRelativeTo(this.props.sortOrder, targetSortOrder, position);
	}

	/** 목록의 맨 앞/뒤로 이동하는 재정렬 계획 */
	planReorderToEdge(position: ReorderPosition, maxSortOrder: number): ReorderPlan {
		return planReorderToEdge(this.props.sortOrder, position, maxSortOrder);
	}
}
