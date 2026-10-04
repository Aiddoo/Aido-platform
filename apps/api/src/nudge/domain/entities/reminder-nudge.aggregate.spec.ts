import { ErrorCode } from "@aido/errors";
import { NUDGE_LIMITS } from "@aido/validators";
import { describe, expect, it } from "vitest";

import { ReminderNudge } from "./reminder-nudge.aggregate.js";

describe("ReminderNudge", () => {
	it("자신에게 보내는 리마인드 콕 생성은 거부한다", () => {
		// Given
		const input = { senderId: "same", receiverId: "same" };

		// When
		const create = () => ReminderNudge.planCreation(input);

		// Then
		expect(create).toThrow(expect.objectContaining({ errorCode: ErrorCode.NUDGE_1104 }));
	});

	it("메시지 길이를 도메인 규칙으로 검증한다", () => {
		// Given
		const input = {
			senderId: "sender",
			receiverId: "receiver",
			message: "가".repeat(NUDGE_LIMITS.MAX_MESSAGE_LENGTH + 1),
		};

		// When
		const create = () => ReminderNudge.planCreation(input);

		// Then
		expect(create).toThrow(expect.objectContaining({ errorCode: ErrorCode.SYS_0002 }));
	});

	it("영속 상태를 복원하고 입력·반환 날짜의 변경으로부터 상태를 보호한다", () => {
		// Given
		const createdAt = new Date("2026-10-04T01:00:00.000Z");
		const persisted = {
			id: 1,
			senderId: "sender",
			receiverId: "receiver",
			message: null,
			createdAt: new Date(createdAt),
		};
		const reminder = ReminderNudge.reconstitute(persisted);

		// When
		persisted.createdAt.setFullYear(2000);
		reminder.createdAt.setFullYear(2000);

		// Then
		expect(reminder.senderId).toBe("sender");
		expect(reminder.receiverId).toBe("receiver");
		expect(reminder.createdAt).toEqual(createdAt);
	});
});
