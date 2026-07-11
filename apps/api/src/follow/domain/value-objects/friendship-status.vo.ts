import { ErrorCode } from "@aido/errors";

import { DomainException } from "@/shared/domain/exceptions/domain.exception";

export type FriendshipStatusValue = "PENDING" | "ACCEPTED";

/**
 * FriendshipStatus — 친구 관계 상태 값 객체.
 *
 * 관계 상태(PENDING/ACCEPTED)와 그 전이 규칙을 캡슐화한다. 유효하지 않은 상태 문자열은
 * DomainException으로 거부하며(불변식), 전이는 명시적 메서드로만 수행한다.
 */
export class FriendshipStatus {
	private constructor(private readonly value: FriendshipStatusValue) {}

	static pending(): FriendshipStatus {
		return new FriendshipStatus("PENDING");
	}

	static accepted(): FriendshipStatus {
		return new FriendshipStatus("ACCEPTED");
	}

	static of(value: string): FriendshipStatus {
		if (value !== "PENDING" && value !== "ACCEPTED") {
			throw new DomainException(ErrorCode.SYS_0001, {
				detail: "Unknown friendship status",
				value,
			});
		}
		return new FriendshipStatus(value);
	}

	get raw(): FriendshipStatusValue {
		return this.value;
	}

	isPending(): boolean {
		return this.value === "PENDING";
	}

	isAccepted(): boolean {
		return this.value === "ACCEPTED";
	}

	/** PENDING → ACCEPTED 전이. 이미 ACCEPTED면 멱등(그대로 ACCEPTED). */
	accept(): FriendshipStatus {
		return FriendshipStatus.accepted();
	}

	equals(other: FriendshipStatus): boolean {
		return this.value === other.value;
	}
}
