import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { FollowFacade } from "@/follow";
import {
	MUTATION_LOCK,
	type MutationLockPort,
	UNIT_OF_WORK,
} from "@/shared/application/ports";
import { todayInTimezone } from "@/shared/domain/date/utils/timezone";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { Nudge } from "../../../domain/entities/nudge.entity";
import {
	NUDGE_REPOSITORY,
	type NudgeRepositoryPort,
	type NudgeWithRelations,
	type TargetTodoRecord,
} from "../../ports/nudge.repository.port";
import {
	NUDGE_LIMIT_READER,
	type NudgeLimitReaderPort,
} from "../../ports/nudge-limit-reader.port";
import {
	NUDGE_NOTIFIER,
	type NudgeNotifierPort,
} from "../../ports/nudge-notifier.port";
import { SendNudgeUseCase } from "./send-nudge.use-case";

const today = todayInTimezone("UTC");

const targetTodo: TargetTodoRecord = {
	ownerId: "r",
	visibility: "PUBLIC",
	startDate: today,
	endDate: null,
};

const createdNudge: NudgeWithRelations = {
	id: 1,
	senderId: "s",
	receiverId: "r",
	todoId: 10,
	message: "hi",
	readAt: null,
	createdAt: new Date(),
	sender: {
		id: "s",
		userTag: "SENDER12",
		profile: { name: "S", profileImage: null },
	},
	receiver: { id: "r", userTag: "RECEIVER", profile: null },
	todo: { id: 10, title: "할 일", completed: false },
};

describe("SendNudgeUseCase", () => {
	let useCase: SendNudgeUseCase;
	let repo: Mocked<NudgeRepositoryPort>;
	let notifier: Mocked<NudgeNotifierPort>;
	let limitReader: Mocked<NudgeLimitReaderPort>;
	let follow: Mocked<FollowFacade>;
	let mutationLock: Mocked<MutationLockPort>;
	let uow: Mocked<{ run: (fn: () => unknown) => unknown }>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(SendNudgeUseCase)
			.mock<MutationLockPort>(MUTATION_LOCK)
			.impl(() => ({ acquire: jest.fn() }))
			.compile();
		useCase = unit;
		repo = unitRef.get(NUDGE_REPOSITORY);
		notifier = unitRef.get(NUDGE_NOTIFIER);
		limitReader = unitRef.get(NUDGE_LIMIT_READER);
		follow = unitRef.get(FollowFacade);
		mutationLock = unitRef.get(MUTATION_LOCK);
		uow = unitRef.get(UNIT_OF_WORK);

		uow.run.mockImplementation((fn: () => unknown) => fn());
		follow.isMutualFriend.mockResolvedValue(true);
		repo.findTargetTodo.mockResolvedValue(targetTodo);
		limitReader.getDailyLimitInTx.mockResolvedValue(3);
		repo.countTodayNudges.mockResolvedValue(0);
		repo.countSentSince.mockResolvedValue(0);
		repo.findLastNudgeForTodo.mockResolvedValue(null);
		repo.createNudge.mockResolvedValue(createdNudge);
	});

	it("자기 자신이면 NUDGE_1104", async () => {
		await expect(
			useCase.execute({ senderId: "s", receiverId: "s", todoId: 10 }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("친구가 아니면 NUDGE_1103", async () => {
		follow.isMutualFriend.mockResolvedValue(false);
		await expect(
			useCase.execute({ senderId: "s", receiverId: "r", todoId: 10 }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("Todo가 없으면 TODO_0801", async () => {
		repo.findTargetTodo.mockResolvedValue(null);
		await expect(
			useCase.execute({ senderId: "s", receiverId: "r", todoId: 10 }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("수신자 소유가 아니면 TODO_0801", async () => {
		repo.findTargetTodo.mockResolvedValue({ ...targetTodo, ownerId: "other" });
		await expect(
			useCase.execute({ senderId: "s", receiverId: "r", todoId: 10 }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("비공개면 TODO_0801", async () => {
		repo.findTargetTodo.mockResolvedValue({
			...targetTodo,
			visibility: "PRIVATE",
		});
		await expect(
			useCase.execute({ senderId: "s", receiverId: "r", todoId: 10 }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("일일 한도 초과면 NUDGE_1101", async () => {
		repo.countSentSince.mockResolvedValue(3);
		await expect(
			useCase.execute({ senderId: "s", receiverId: "r", todoId: 10 }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("성공 시 콕 찌르기 생성 + 알림 enqueue", async () => {
		const result = await useCase.execute({
			senderId: "s",
			receiverId: "r",
			todoId: 10,
			message: "hi",
		});
		expect(result.id).toBe(1);
		expect(notifier.notifyNudgeSent).toHaveBeenCalledWith(
			expect.objectContaining({
				nudgeId: 1,
				senderId: "s",
				receiverId: "r",
				todoId: 10,
				todoTitle: "할 일",
			}),
		);
	});

	it("동일 Todo 쿨다운 중이면 NUDGE_1102", async () => {
		repo.findLastNudgeForTodo.mockResolvedValue(
			Nudge.reconstitute({
				id: 9,
				senderId: "s",
				receiverId: "r",
				todoId: 10,
				message: null,
				readAt: null,
				createdAt: new Date(),
			}),
		);
		await expect(
			useCase.execute({ senderId: "s", receiverId: "r", todoId: 10 }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("무제한(null)이면 한도 체크를 통과한다", async () => {
		limitReader.getDailyLimitInTx.mockResolvedValue(null);
		repo.countTodayNudges.mockResolvedValue(999);
		const result = await useCase.execute({
			senderId: "s",
			receiverId: "r",
			todoId: 10,
		});
		expect(result.id).toBe(1);
	});

	it("같은 시각 기준의 일일·Todo 쿨다운 키를 모든 guarded read 전에 UoW 안에서 잠근다", async () => {
		// Given - KST 자정 직전 시작하고 lock 대기 중 다음 날로 넘어가는 상황
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-07-26T14:59:59.900Z"));
		const events: string[] = [];
		mutationLock.acquire.mockImplementation(async () => {
			events.push("lock");
			jest.setSystemTime(new Date("2026-07-26T15:00:00.100Z"));
		});
		repo.findTargetTodo.mockImplementation(async () => {
			events.push("target-read");
			return targetTodo;
		});
		limitReader.getDailyLimitInTx.mockImplementation(async () => {
			events.push("limit");
			return 3;
		});
		repo.countSentSince.mockImplementation(async () => {
			events.push("daily-count");
			return 0;
		});
		repo.findLastNudgeForTodo.mockImplementation(async () => {
			events.push("cooldown-read");
			return null;
		});

		// When
		await useCase.execute(
			{ senderId: "s", receiverId: "r", todoId: 10 },
			"Asia/Seoul",
		);

		// Then - lock key와 quota 시작점 모두 7/26 KST 기준이고 lock이 먼저임
		expect(mutationLock.acquire).toHaveBeenCalledWith([
			"mutation:v1:nudge:daily:s:2026-07-26",
			"mutation:v1:nudge:cooldown:s:10",
		]);
		expect(repo.countSentSince).toHaveBeenCalledWith(
			"s",
			new Date("2026-07-25T15:00:00.000Z"),
			new Date("2026-07-26T15:00:00.000Z"),
		);
		expect(repo.createNudge).toHaveBeenCalledWith(
			expect.objectContaining({
				createdAt: new Date("2026-07-26T14:59:59.900Z"),
			}),
		);
		expect(events).toEqual([
			"lock",
			"target-read",
			"limit",
			"daily-count",
			"cooldown-read",
		]);
		jest.useRealTimers();
	});
});
