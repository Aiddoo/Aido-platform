import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { FollowFacade } from "@/follow";
import { UNIT_OF_WORK } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { ReminderNudge } from "../../../domain/entities/reminder-nudge.entity";
import {
	NUDGE_REPOSITORY,
	type NudgeRepositoryPort,
	type ReminderNudgeWithRelations,
} from "../../ports/nudge.repository.port";
import {
	NUDGE_NOTIFIER,
	type NudgeNotifierPort,
} from "../../ports/nudge-notifier.port";
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
	let follow: Mocked<FollowFacade>;
	let uow: Mocked<{ run: (fn: () => unknown) => unknown }>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			SendRemindNudgeUseCase,
		).compile();
		useCase = unit;
		repo = unitRef.get(NUDGE_REPOSITORY);
		notifier = unitRef.get(NUDGE_NOTIFIER);
		follow = unitRef.get(FollowFacade);
		uow = unitRef.get(UNIT_OF_WORK);

		uow.run.mockImplementation((fn: () => unknown) => fn());
		follow.isMutualFriend.mockResolvedValue(true);
		repo.countTodayTodos.mockResolvedValue(0);
		repo.findLastRemindNudge.mockResolvedValue(null);
		repo.createRemindNudge.mockResolvedValue(createdRemind);
	});

	it("자기 자신이면 NUDGE_1104", async () => {
		await expect(
			useCase.execute({ senderId: "s", receiverId: "s" }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("친구가 아니면 NUDGE_1103", async () => {
		follow.isMutualFriend.mockResolvedValue(false);
		await expect(
			useCase.execute({ senderId: "s", receiverId: "r" }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("친구가 오늘 할 일이 있으면 NUDGE_1107", async () => {
		repo.countTodayTodos.mockResolvedValue(2);
		await expect(
			useCase.execute({ senderId: "s", receiverId: "r" }),
		).rejects.toBeInstanceOf(ApplicationException);
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
		await expect(
			useCase.execute({ senderId: "s", receiverId: "r" }),
		).rejects.toBeInstanceOf(ApplicationException);
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
});
