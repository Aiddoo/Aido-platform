import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/auth/presentation/decorators";

import type { CheerWithRelations } from "../application/ports/cheer.repository.port";
import { CheerReader } from "../application/services/cheer.reader";
import { MarkCheerReadUseCase } from "../application/use-cases/mark-cheer-read/mark-cheer-read.use-case";
import { MarkManyCheersReadUseCase } from "../application/use-cases/mark-many-cheers-read/mark-many-cheers-read.use-case";
import { SendCheerUseCase } from "../application/use-cases/send-cheer/send-cheer.use-case";
import { CheerController } from "./cheer.controller";
import type { GetCheersQueryDto, MarkCheersReadDto, SendCheerDto } from "./dtos";

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
	let cheerReader: Mocked<CheerReader>;
	let sendCheerUseCase: Mocked<SendCheerUseCase>;
	let markCheerReadUseCase: Mocked<MarkCheerReadUseCase>;
	let markManyCheersReadUseCase: Mocked<MarkManyCheersReadUseCase>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(CheerController).compile();
		controller = unit;
		cheerReader = unitRef.get(CheerReader);
		sendCheerUseCase = unitRef.get(SendCheerUseCase);
		markCheerReadUseCase = unitRef.get(MarkCheerReadUseCase);
		markManyCheersReadUseCase = unitRef.get(MarkManyCheersReadUseCase);
	});

	it("sendCheer는 파사드에 위임하고 응답을 구성한다", async () => {
		sendCheerUseCase.execute.mockResolvedValue(cheer);
		const dto = { receiverId: "receiver", message: "hi" } as SendCheerDto;

		const result = await controller.sendCheer(user, dto, "Asia/Seoul");

		expect(sendCheerUseCase.execute).toHaveBeenCalledWith(
			{ senderId: "sender", receiverId: "receiver", message: "hi" },
			"Asia/Seoul",
		);
		expect(result.message).toBe("응원을 보냈어요! 🎉");
		expect(result.cheer.id).toBe(1);
	});

	it("getReceivedCheers는 목록/총계/미읽음을 병렬 조회한다", async () => {
		cheerReader.getReceivedCheers.mockResolvedValue({
			items: [cheer],
			pagination: { hasNext: true, nextCursor: 1, size: 20 },
		});
		cheerReader.countReceivedCheers.mockResolvedValue(5);
		cheerReader.countUnreadReceivedCheers.mockResolvedValue(2);
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
		cheerReader.getLimitInfo.mockResolvedValue({
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
		cheerReader.getCooldownInfoForUser.mockResolvedValue({
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
		markCheerReadUseCase.execute.mockResolvedValue(undefined);

		const result = await controller.markAsRead(user, { id: 9 });

		expect(markCheerReadUseCase.execute).toHaveBeenCalledWith({
			userId: "sender",
			cheerId: 9,
		});
		expect(result.readCount).toBe(1);
	});

	it("markManyAsRead는 처리 개수를 반환한다", async () => {
		markManyCheersReadUseCase.execute.mockResolvedValue(3);
		const dto = { cheerIds: [1, 2, 3] } as MarkCheersReadDto;

		const result = await controller.markManyAsRead(user, dto);

		expect(markManyCheersReadUseCase.execute).toHaveBeenCalledWith({
			userId: "sender",
			cheerIds: [1, 2, 3],
		});
		expect(result.readCount).toBe(3);
	});
});
