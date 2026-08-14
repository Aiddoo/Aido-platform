import { Cheer } from "./cheer.aggregate";

const make = (over: Partial<{ readAt: Date | null; receiverId: string }> = {}) =>
	Cheer.reconstitute({
		id: 1,
		senderId: "sender",
		receiverId: over.receiverId ?? "receiver",
		message: "hi",
		readAt: over.readAt ?? null,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
	});

describe("Cheer 엔티티", () => {
	it("reconstitute와 getter", () => {
		const c = make();
		expect(c.id).toBe(1);
		expect(c.senderId).toBe("sender");
		expect(c.receiverId).toBe("receiver");
		expect(c.message).toBe("hi");
	});

	it("isRead: readAt 유무로 판별", () => {
		expect(make({ readAt: null }).isRead()).toBe(false);
		expect(make({ readAt: new Date() }).isRead()).toBe(true);
	});

	it("isReceivedBy: 수신자 소유 판별", () => {
		expect(make({ receiverId: "u1" }).isReceivedBy("u1")).toBe(true);
		expect(make({ receiverId: "u1" }).isReceivedBy("u2")).toBe(false);
	});
});
