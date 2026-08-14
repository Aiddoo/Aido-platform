import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { FollowReader } from "@/follow";
import { MUTATION_LOCK, type MutationLockPort, UNIT_OF_WORK } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { ReminderNudge } from "../../../domain/entities/reminder-nudge.entity";
import { NUDGE_NOTIFIER, type NudgeNotifierPort } from "../../ports/nudge-notifier.port";
import {
	NUDGE_REPOSITORY,
	type NudgeRepositoryPort,
	type ReminderNudgeWithRelations,
} from "../../ports/nudge.repository.port";
import { SendRemindNudgeUseCase } from "./send-remind-nudge.use-case";

const createdRemind: ReminderNudgeWithRelations = {
	id: 5,
	senderId: "s",
	receiverId: "r",
	message: null,
	createdAt: new Date(),
	sender: {
		id: "s",
		userTag: "SENDER12",
		profile: { name: "S", profileImage: null },
	},
};

describe("SendRemindNudgeUseCase", () => {
	let useCase: SendRemindNudgeUseCase;
	let repo: Mocked<NudgeRepositoryPort>;
	let notifier: Mocked<NudgeNotifierPort>;
	let follow: Mocked<FollowReader>;
	let mutationLock: Mocked<MutationLockPort>;
	let uow: Mocked<{ run: (fn: () => unknown) => unknown }>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(SendRemindNudgeUseCase)
			.mock<MutationLockPort>(MUTATION_LOCK)
			.impl(() => ({ acquire: jest.fn() }))
			.compile();
		useCase = unit;
		repo = unitRef.get(NUDGE_REPOSITORY);
		notifier = unitRef.get(NUDGE_NOTIFIER);
		follow = unitRef.get(FollowReader);
		mutationLock = unitRef.get(MUTATION_LOCK);
		uow = unitRef.get(UNIT_OF_WORK);

		uow.run.mockImplementation((fn: () => unknown) => fn());
		follow.isMutualFriend.mockResolvedValue(true);
		repo.countTodayTodos.mockResolvedValue(0);
		repo.findLastRemindNudge.mockResolvedValue(null);
		repo.createRemindNudge.mockResolvedValue(createdRemind);
	});

	it("자기 자신이면 NUDGE_1104", async () => {
		await expect(useCase.execute({ senderId: "s", receiverId: "s" })).rejects.toBeInstanceOf(
			ApplicationException,
		);
	});

	it("친구가 아니면 NUDGE_1103", async () => {
		follow.isMutualFriend.mockResolvedValue(false);
		await expect(useCase.execute({ senderId: "s", receiverId: "r" })).rejects.toBeInstanceOf(
			ApplicationException,
		);
	});

	it("친구가 오늘 할 일이 있으면 NUDGE_1107", async () => {
		repo.countTodayTodos.mockResolvedValue(2);
		await expect(useCase.execute({ senderId: "s", receiverId: "r" })).rejects.toBeInstanceOf(
			ApplicationException,
		);
	});

	it("쿨다운 중이면 NUDGE_1108", async () => {
		repo.findLastRemindNudge.mockResolvedValue(
			ReminderNudge.reconstitute({
				id: 3,
				senderId: "s",
				receiverId: "r",
				message: null,
				createdAt: new Date(),
			}),
		);
		await expect(useCase.execute({ senderId: "s", receiverId: "r" })).rejects.toBeInstanceOf(
			ApplicationException,
		);
	});

	it("성공 시 생성 + 알림 enqueue (todoId 없음)", async () => {
		const result = await useCase.execute({ senderId: "s", receiverId: "r" });
		expect(result.id).toBe(5);
		expect(notifier.notifyNudgeSent).toHaveBeenCalledWith(
			expect.objectContaining({ nudgeId: 5, senderId: "s", receiverId: "r" }),
		);
		const payload = notifier.notifyNudgeSent.mock.calls[0]?.[0];
		expect(payload?.todoId).toBeUndefined();
		expect(payload?.todoTitle).toBeUndefined();
	});

	it("친구 쿨다운 키를 오늘 Todo와 최근 reminder guarded read 전에 UoW 안에서 잠근다", async () => {
		// Given - guarded read 호출 순서 기록
		const events: string[] = [];
		mutationLock.acquire.mockImplementation(async () => {
			events.push("lock");
		});
		repo.countTodayTodos.mockImplementation(async () => {
			events.push("today-todo-read");
			return 0;
		});
		repo.findLastRemindNudge.mockImplementation(async () => {
			events.push("cooldown-read");
			return null;
		});

		// When
		await useCase.execute({ senderId: "s", receiverId: "r" }, "Asia/Seoul");

		// Then
		expect(mutationLock.acquire).toHaveBeenCalledWith(["mutation:v1:remind-nudge:cooldown:s:r"]);
		expect(events).toEqual(["lock", "today-todo-read", "cooldown-read"]);
	});
});
