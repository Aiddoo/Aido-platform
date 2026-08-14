import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { FollowReader } from "@/follow";
import { MUTATION_LOCK, type MutationLockPort, UNIT_OF_WORK } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { CHEER_LIMIT_READER, type CheerLimitReaderPort } from "../../ports/cheer-limit-reader.port";
import { CHEER_NOTIFIER, type CheerNotifierPort } from "../../ports/cheer-notifier.port";
import {
	CHEER_REPOSITORY,
	type CheerRepositoryPort,
	type CheerWithRelations,
} from "../../ports/cheer.repository.port";
import { SendCheerUseCase } from "./send-cheer.use-case";

const createdCheer: CheerWithRelations = {
	id: 1,
	senderId: "s",
	receiverId: "r",
	message: "hi",
	readAt: null,
	createdAt: new Date(),
	sender: {
		id: "s",
		userTag: "SENDER12",
		profile: { name: "S", profileImage: null },
	},
	receiver: { id: "r", userTag: "RECEIVER", profile: null },
};

describe("SendCheerUseCase", () => {
	let useCase: SendCheerUseCase;
	let repo: Mocked<CheerRepositoryPort>;
	let notifier: Mocked<CheerNotifierPort>;
	let limitReader: Mocked<CheerLimitReaderPort>;
	let follow: Mocked<FollowReader>;
	let mutationLock: Mocked<MutationLockPort>;
	let uow: Mocked<{ run: (fn: () => unknown) => unknown }>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(SendCheerUseCase)
			.mock<MutationLockPort>(MUTATION_LOCK)
			.impl(() => ({ acquire: jest.fn() }))
			.compile();
		useCase = unit;
		repo = unitRef.get(CHEER_REPOSITORY);
		notifier = unitRef.get(CHEER_NOTIFIER);
		limitReader = unitRef.get(CHEER_LIMIT_READER);
		follow = unitRef.get(FollowReader);
		mutationLock = unitRef.get(MUTATION_LOCK);
		uow = unitRef.get(UNIT_OF_WORK);

		uow.run.mockImplementation((fn: () => unknown) => fn());
		follow.isMutualFriend.mockResolvedValue(true);
		limitReader.getDailyLimitInTx.mockResolvedValue(3);
		repo.countSentSince.mockResolvedValue(0);
		repo.findLastCheerToUser.mockResolvedValue(null);
		repo.createWithRelations.mockResolvedValue(createdCheer);
	});

	it("자기 자신이면 CHEER_1204", async () => {
		await expect(useCase.execute({ senderId: "s", receiverId: "s" })).rejects.toBeInstanceOf(
			ApplicationException,
		);
	});

	it("친구가 아니면 CHEER_1203", async () => {
		follow.isMutualFriend.mockResolvedValue(false);
		await expect(useCase.execute({ senderId: "s", receiverId: "r" })).rejects.toBeInstanceOf(
			ApplicationException,
		);
	});

	it("일일 한도 초과면 CHEER_1201", async () => {
		repo.countSentSince.mockResolvedValue(3);
		await expect(useCase.execute({ senderId: "s", receiverId: "r" })).rejects.toBeInstanceOf(
			ApplicationException,
		);
	});

	it("성공 시 응원 생성 + 알림 enqueue", async () => {
		const result = await useCase.execute({
			senderId: "s",
			receiverId: "r",
			message: "hi",
		});
		expect(result.id).toBe(1);
		expect(notifier.notifyCheerSent).toHaveBeenCalledWith(
			expect.objectContaining({ cheerId: 1, senderId: "s", receiverId: "r" }),
		);
	});

	it("무제한(null)이면 한도 체크를 통과한다", async () => {
		limitReader.getDailyLimitInTx.mockResolvedValue(null);
		repo.countSentSince.mockResolvedValue(999);
		const result = await useCase.execute({ senderId: "s", receiverId: "r" });
		expect(result.id).toBe(1);
	});

	it("같은 시각 기준의 일일·쿨다운 키를 guarded read 전에 UoW 안에서 잠근다", async () => {
		// Given - KST 자정 직전 시작하고 lock 대기 중 다음 날로 넘어가는 상황
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-07-26T14:59:59.900Z"));
		const events: string[] = [];
		mutationLock.acquire.mockImplementation(async () => {
			events.push("lock");
			jest.setSystemTime(new Date("2026-07-26T15:00:00.100Z"));
		});
		limitReader.getDailyLimitInTx.mockImplementation(async () => {
			events.push("limit");
			return 3;
		});
		repo.countSentSince.mockImplementation(async () => {
			events.push("daily-count");
			return 0;
		});
		repo.findLastCheerToUser.mockImplementation(async () => {
			events.push("cooldown-read");
			return null;
		});

		// When
		await useCase.execute({ senderId: "s", receiverId: "r" }, "Asia/Seoul");

		// Then - lock key와 quota 시작점 모두 7/26 KST 기준이고 lock이 먼저임
		expect(mutationLock.acquire).toHaveBeenCalledWith([
			"mutation:v1:cheer:daily:s:2026-07-26",
			"mutation:v1:cheer:cooldown:s:r",
		]);
		expect(repo.countSentSince).toHaveBeenCalledWith(
			"s",
			new Date("2026-07-25T15:00:00.000Z"),
			new Date("2026-07-26T15:00:00.000Z"),
		);
		expect(repo.createWithRelations).toHaveBeenCalledWith(
			expect.objectContaining({
				createdAt: new Date("2026-07-26T14:59:59.900Z"),
			}),
		);
		expect(events).toEqual(["lock", "limit", "daily-count", "cooldown-read"]);
		jest.useRealTimers();
	});
});
