import { Nudge } from "./nudge.aggregate";

const base = {
	id: 1,
	senderId: "s",
	receiverId: "r",
	todoId: 10,
	message: null,
	readAt: null,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("Nudge", () => {
	it("reconstitute + getters", () => {
		const nudge = Nudge.reconstitute({ ...base, message: "hi" });
		expect(nudge.id).toBe(1);
		expect(nudge.senderId).toBe("s");
		expect(nudge.receiverId).toBe("r");
		expect(nudge.todoId).toBe(10);
		expect(nudge.message).toBe("hi");
	});

	it("isRead: readAt 유무로 판별", () => {
		expect(Nudge.reconstitute(base).isRead()).toBe(false);
		expect(Nudge.reconstitute({ ...base, readAt: new Date() }).isRead()).toBe(
			true,
		);
	});

	it("isReceivedBy: 수신자 소유 판별", () => {
		const nudge = Nudge.reconstitute(base);
		expect(nudge.isReceivedBy("r")).toBe(true);
		expect(nudge.isReceivedBy("s")).toBe(false);
	});
});
