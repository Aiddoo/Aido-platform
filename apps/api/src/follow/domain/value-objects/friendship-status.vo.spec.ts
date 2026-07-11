import { DomainException } from "@/shared/domain/exceptions/domain.exception";
import { FriendshipStatus } from "./friendship-status.vo";

describe("FriendshipStatus VO", () => {
	it("pending/accepted 팩토리와 판별", () => {
		expect(FriendshipStatus.pending().isPending()).toBe(true);
		expect(FriendshipStatus.pending().isAccepted()).toBe(false);
		expect(FriendshipStatus.accepted().isAccepted()).toBe(true);
	});

	it("of는 유효한 값만 허용", () => {
		expect(FriendshipStatus.of("PENDING").raw).toBe("PENDING");
		expect(FriendshipStatus.of("ACCEPTED").raw).toBe("ACCEPTED");
	});

	it("of는 알 수 없는 상태를 거부한다", () => {
		expect(() => FriendshipStatus.of("BLOCKED")).toThrow(DomainException);
	});

	it("accept는 ACCEPTED로 전이", () => {
		expect(FriendshipStatus.pending().accept().isAccepted()).toBe(true);
	});

	it("equals", () => {
		expect(FriendshipStatus.pending().equals(FriendshipStatus.pending())).toBe(
			true,
		);
		expect(FriendshipStatus.pending().equals(FriendshipStatus.accepted())).toBe(
			false,
		);
	});
});
