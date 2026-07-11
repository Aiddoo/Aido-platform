import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/auth/presentation/decorators";
import { CheerFacade } from "../application/facades/cheer.facade";
import type { CheerWithRelations } from "../application/ports/cheer.repository.port";
import { CheerController } from "./cheer.controller";
import type {
	GetCheersQueryDto,
	MarkCheersReadDto,
	SendCheerDto,
} from "./dtos";

const user: CurrentUserPayload = {
	userId: "sender",
	email: "t@e.com",
	sessionId: "sid",
	role: "USER",
};

const cheer: CheerWithRelations = {
	id: 1,
	senderId: "sender",
	receiverId: "receiver",
	message: "hi",
	readAt: null,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	sender: { id: "sender", userTag: "SENDER12", profile: null },
	receiver: { id: "receiver", userTag: "RECEIVER", profile: null },
};

describe("CheerController", () => {
	let controller: CheerController;
	let facade: Mocked<CheerFacade>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(CheerController).compile();
		controller = unit;
		facade = unitRef.get(CheerFacade);
	});

	it("sendCheer는 파사드에 위임하고 응답을 구성한다", async () => {
		facade.sendCheer.mockResolvedValue(cheer);
		const dto = { receiverId: "receiver", message: "hi" } as SendCheerDto;

		const result = await controller.sendCheer(user, dto, "Asia/Seoul");

		expect(facade.sendCheer).toHaveBeenCalledWith(
			{ senderId: "sender", receiverId: "receiver", message: "hi" },
			"Asia/Seoul",
		);
		expect(result.message).toBe("응원을 보냈어요! 🎉");
		expect(result.cheer.id).toBe(1);
	});

	it("getReceivedCheers는 목록/총계/미읽음을 병렬 조회한다", async () => {
		facade.getReceivedCheers.mockResolvedValue({
			items: [cheer],
			pagination: { hasNext: true, nextCursor: 1, size: 20 },
		});
		facade.countReceivedCheers.mockResolvedValue(5);
		facade.countUnreadReceivedCheers.mockResolvedValue(2);
		const query = {
			cursor: undefined,
			limit: 20,
		} as unknown as GetCheersQueryDto;

		const result = await controller.getReceivedCheers(user, query);

		expect(result.totalCount).toBe(5);
		expect(result.unreadCount).toBe(2);
		expect(result.hasMore).toBe(true);
		expect(result.cheers).toHaveLength(1);
	});

	it("getLimitInfo는 한도 정보를 매핑한다", async () => {
		facade.getLimitInfo.mockResolvedValue({
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

	it("getCooldownInfo는 canCheer를 반전한다", async () => {
		facade.getCooldownInfoForUser.mockResolvedValue({
			isActive: true,
			remainingSeconds: 100,
			canCheerAt: new Date("2026-01-01T01:00:00.000Z"),
		});

		const result = await controller.getCooldownInfo(user, "receiver");

		expect(result.canCheer).toBe(false);
		expect(result.remainingSeconds).toBe(100);
		expect(result.userId).toBe("receiver");
	});

	it("markAsRead는 파사드에 위임한다", async () => {
		facade.markAsRead.mockResolvedValue(undefined);

		const result = await controller.markAsRead(user, { id: 9 });

		expect(facade.markAsRead).toHaveBeenCalledWith("sender", 9);
		expect(result.readCount).toBe(1);
	});

	it("markManyAsRead는 처리 개수를 반환한다", async () => {
		facade.markManyAsRead.mockResolvedValue(3);
		const dto = { cheerIds: [1, 2, 3] } as MarkCheersReadDto;

		const result = await controller.markManyAsRead(user, dto);

		expect(facade.markManyAsRead).toHaveBeenCalledWith("sender", [1, 2, 3]);
		expect(result.readCount).toBe(3);
	});
});
