import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/auth/presentation/decorators";

import type {
	NudgeWithRelations,
	ReminderNudgeWithRelations,
} from "../application/ports/nudge.repository.port";
import { NudgeReader } from "../application/services/nudge.reader";
import { MarkNudgeReadUseCase } from "../application/use-cases/mark-nudge-read/mark-nudge-read.use-case";
import { SendNudgeUseCase } from "../application/use-cases/send-nudge/send-nudge.use-case";
import { SendRemindNudgeUseCase } from "../application/use-cases/send-remind-nudge/send-remind-nudge.use-case";
import type { GetNudgesQueryDto, SendNudgeDto, SendRemindNudgeDto } from "./dtos";
import { NudgeController } from "./nudge.controller";

const user: CurrentUserPayload = {
	userId: "sender",
	email: "t@e.com",
	sessionId: "sid",
	role: "USER",
};

const nudge: NudgeWithRelations = {
	id: 1,
	senderId: "sender",
	receiverId: "receiver",
	todoId: 10,
	message: "hi",
	readAt: null,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	sender: { id: "sender", userTag: "SENDER12", profile: null },
	receiver: { id: "receiver", userTag: "RECEIVER", profile: null },
	todo: { id: 10, title: "할 일", completed: false },
};

const remindNudge: ReminderNudgeWithRelations = {
	id: 2,
	senderId: "sender",
	receiverId: "receiver",
	message: null,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	sender: { id: "sender", userTag: "SENDER12", profile: null },
};

describe("NudgeController", () => {
	let controller: NudgeController;
	let nudgeReader: Mocked<NudgeReader>;
	let sendNudgeUseCase: Mocked<SendNudgeUseCase>;
	let sendRemindNudgeUseCase: Mocked<SendRemindNudgeUseCase>;
	let markNudgeReadUseCase: Mocked<MarkNudgeReadUseCase>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(NudgeController).compile();
		controller = unit;
		nudgeReader = unitRef.get(NudgeReader);
		sendNudgeUseCase = unitRef.get(SendNudgeUseCase);
		sendRemindNudgeUseCase = unitRef.get(SendRemindNudgeUseCase);
		markNudgeReadUseCase = unitRef.get(MarkNudgeReadUseCase);
	});

	it("sendNudge는 파사드에 위임하고 응답을 구성한다", async () => {
		sendNudgeUseCase.execute.mockResolvedValue(nudge);
		const dto = {
			receiverId: "receiver",
			todoId: 10,
			message: "hi",
		} as SendNudgeDto;

		const result = await controller.sendNudge(user, dto, "Asia/Seoul");

		expect(sendNudgeUseCase.execute).toHaveBeenCalledWith(
			{ senderId: "sender", receiverId: "receiver", todoId: 10, message: "hi" },
			"Asia/Seoul",
		);
		expect(result.message).toBe("콕! 찔렀습니다 👆");
		expect(result.nudge.id).toBe(1);
	});

	it("getReceivedNudges는 목록/총계/미읽음을 병렬 조회한다", async () => {
		nudgeReader.getReceivedNudges.mockResolvedValue({
			items: [nudge],
			pagination: { hasNext: true, nextCursor: 1, size: 20 },
		});
		nudgeReader.countReceivedNudges.mockResolvedValue(5);
		nudgeReader.countUnreadReceivedNudges.mockResolvedValue(2);
		const query = {
			cursor: undefined,
			limit: 20,
		} as unknown as GetNudgesQueryDto;

		const result = await controller.getReceivedNudges(user, query);

		expect(result.totalCount).toBe(5);
		expect(result.unreadCount).toBe(2);
		expect(result.hasMore).toBe(true);
		expect(result.nudges).toHaveLength(1);
	});

	it("getLimitInfo는 한도 정보를 매핑한다", async () => {
		nudgeReader.getLimitInfo.mockResolvedValue({
			dailyLimit: 3,
			used: 1,
			remaining: 2,
		});

		const result = await controller.getLimitInfo(user, "UTC");

		expect(result).toEqual({
			dailyLimit: 3,
			usedToday: 1,
			remainingToday: 2,
			isUnlimited: false,
		});
	});

	it("getCooldownInfo는 canNudge를 반전한다", async () => {
		nudgeReader.getCooldownInfoForUser.mockResolvedValue({
			isActive: true,
			remainingSeconds: 100,
			cooldownEndsAt: new Date("2026-01-01T01:00:00.000Z"),
		});

		const result = await controller.getCooldownInfo(user, "receiver");

		expect(result.canNudge).toBe(false);
		expect(result.remainingSeconds).toBe(100);
	});

	it("sendRemindNudge는 파사드에 위임한다", async () => {
		sendRemindNudgeUseCase.execute.mockResolvedValue(remindNudge);
		const dto = { receiverId: "receiver" } as SendRemindNudgeDto;

		const result = await controller.sendRemindNudge(user, dto, "UTC");

		expect(sendRemindNudgeUseCase.execute).toHaveBeenCalledWith(
			{ senderId: "sender", receiverId: "receiver", message: undefined },
			"UTC",
		);
		expect(result.message).toBe("할일 좀 만들어! 콕 찔렀습니다 👆");
		expect(result.remindNudge.id).toBe(2);
	});

	it("getRemindCooldownInfo는 canNudge를 반전한다", async () => {
		nudgeReader.getRemindCooldownInfo.mockResolvedValue({
			isActive: false,
			remainingSeconds: 0,
			cooldownEndsAt: null,
		});

		const result = await controller.getRemindCooldownInfo(user, "receiver");

		expect(result.canNudge).toBe(true);
		expect(result.remainingSeconds).toBeNull();
	});

	it("markAsRead는 파사드에 위임한다", async () => {
		markNudgeReadUseCase.execute.mockResolvedValue(undefined);

		const result = await controller.markAsRead(user, { id: 9 });

		expect(markNudgeReadUseCase.execute).toHaveBeenCalledWith({
			userId: "sender",
			nudgeId: 9,
		});
		expect(result.readCount).toBe(1);
	});
});
