import { ErrorCode } from "@aido/errors";
import { TestBed } from "@suites/unit";
import { beforeEach, describe, expect, it, vi, type Mocked } from "vitest";

import { FollowReader } from "#api/follow/index";
import { UNIT_OF_WORK } from "#api/shared/application/ports/index";
import { NudgeBuilder } from "#test/builders/nudge.builder";
import { createNudgeRepositoryMock } from "#test/mocks/ports/nudge.mock";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import { Nudge } from "../../../domain/entities/nudge.aggregate.js";
import {
	NUDGE_INTERACTION_CONFIG,
	type NudgeInteractionConfigPort,
} from "../../ports/nudge-interaction.config.port.js";
import { NUDGE_NOTIFIER, type NudgeNotifierPort } from "../../ports/nudge-notifier.port.js";
import {
	NUDGE_REPOSITORY,
	type NudgeInteractionRecord,
	type NudgeRepositoryPort,
} from "../../ports/nudge.repository.port.js";
import { ReplyToNudgeUseCase } from "./reply-to-nudge.use-case.js";

describe("ReplyToNudgeUseCase", () => {
	let useCase: ReplyToNudgeUseCase;
	let repository: Mocked<NudgeRepositoryPort>;
	let notifier: Mocked<NudgeNotifierPort>;
	let followReader: Mocked<FollowReader>;
	let record: NudgeInteractionRecord;
	let nudgeInteractionConfig: { isEnabled: boolean };
	const input = { userId: "receiver", nudgeId: 1, replyKind: "STARTING" } as const;

	beforeEach(async () => {
		nudgeInteractionConfig = { isEnabled: true };
		const { unit, unitRef } = await TestBed.solitary(ReplyToNudgeUseCase)
			.mock<NudgeRepositoryPort>(NUDGE_REPOSITORY)
			.impl(createNudgeRepositoryMock)
			.mock<NudgeNotifierPort>(NUDGE_NOTIFIER)
			.impl(() => ({ notifyNudgeSent: vi.fn(), recordInteraction: vi.fn() }))
			.mock<NudgeInteractionConfigPort>(NUDGE_INTERACTION_CONFIG)
			.impl(() => nudgeInteractionConfig)
			.mock(UNIT_OF_WORK)
			.impl(createUnitOfWorkMock)
			.compile();
		useCase = unit;
		repository = unitRef.get(NUDGE_REPOSITORY);
		notifier = unitRef.get(NUDGE_NOTIFIER);
		followReader = unitRef.get(FollowReader);
		record = NudgeBuilder.create("sender", "receiver", 10).withId(1).buildInteraction();
		repository.findInteractionById.mockImplementation(async () => record);
		repository.lockInteractionTodo.mockResolvedValue(record.todo);
		repository.saveReply.mockImplementation(async (nudge) => {
			record = { ...record, ...nudge.toPersistence() };
		});
		followReader.getCurrentMutualFriendIds.mockResolvedValue(["sender"]);
	});

	it("첫 답장은 저장한 뒤 알림을 기록하며 할 일 완료 상태는 변경하지 않는다", async () => {
		// Given
		const completedBeforeReply = record.todo.completed;

		// When
		const result = await useCase.execute(input);

		// Then
		expect(result.replyKind).toBe("STARTING");
		expect(result.repliedAt).toEqual(expect.any(Date));
		expect(result.readAt).toEqual(result.repliedAt);
		expect(result.todo.completed).toBe(completedBeforeReply);
		expect(repository.saveReply).toHaveBeenCalledWith(expect.any(Nudge));
		expect(notifier.recordInteraction).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "reply",
				nudgeId: 1,
				actorId: "receiver",
				recipientId: "sender",
				replyKind: "STARTING",
			}),
		);
	});

	it("같은 답장 재요청은 저장·알림을 반복하지 않는다", async () => {
		// Given
		record = {
			...record,
			replyKind: "STARTING",
			repliedAt: new Date(),
			replyUpdatedAt: new Date(),
		};

		// When
		const result = await useCase.execute(input);

		// Then
		expect(result.replyKind).toBe("STARTING");
		expect(repository.saveReply).not.toHaveBeenCalled();
		expect(notifier.recordInteraction).not.toHaveBeenCalled();
	});

	it("답장을 변경하면 상태만 바꾸고 알림은 다시 보내지 않는다", async () => {
		// Given
		const firstRepliedAt = new Date("2026-10-04T01:00:00.000Z");
		record = {
			...record,
			replyKind: "LATER",
			repliedAt: firstRepliedAt,
			replyUpdatedAt: firstRepliedAt,
		};

		// When
		const result = await useCase.execute(input);

		// Then
		expect(result.replyKind).toBe("STARTING");
		expect(result.repliedAt).toEqual(firstRepliedAt);
		expect(repository.saveReply).toHaveBeenCalledOnce();
		expect(notifier.recordInteraction).not.toHaveBeenCalled();
	});

	it("발신자는 수신자의 답장을 수정할 수 없다", async () => {
		// Given
		const senderInput = { ...input, userId: "sender" };

		// When
		const reply = useCase.execute(senderInput);

		// Then
		await expect(reply).rejects.toMatchObject({ errorCode: ErrorCode.NUDGE_1105 });
		expect(repository.lockInteractionTodo).not.toHaveBeenCalled();
		expect(repository.saveReply).not.toHaveBeenCalled();
	});

	it("현재 친구 관계가 없으면 답장을 거부한다", async () => {
		// Given
		followReader.getCurrentMutualFriendIds.mockResolvedValue([]);

		// When
		const reply = useCase.execute(input);

		// Then
		await expect(reply).rejects.toMatchObject({ errorCode: ErrorCode.NUDGE_1109 });
		expect(repository.saveReply).not.toHaveBeenCalled();
	});

	it("행 잠금 후 비공개가 확인되면 답장을 저장하지 않는다", async () => {
		// Given
		repository.lockInteractionTodo.mockResolvedValue({ ...record.todo, visibility: "PRIVATE" });

		// When
		const reply = useCase.execute(input);

		// Then
		await expect(reply).rejects.toMatchObject({ errorCode: ErrorCode.NUDGE_1109 });
		expect(repository.saveReply).not.toHaveBeenCalled();
		expect(notifier.recordInteraction).not.toHaveBeenCalled();
	});

	it("삭제·접근 불가 상태에서는 존재 여부를 드러내지 않는다", async () => {
		// Given
		repository.findInteractionById.mockResolvedValue(null);

		// When
		const reply = useCase.execute(input);

		// Then
		await expect(reply).rejects.toMatchObject({ errorCode: ErrorCode.NUDGE_1105 });
	});

	it("기능이 꺼져 있으면 저장소에 접근하지 않는다", async () => {
		// Given
		nudgeInteractionConfig.isEnabled = false;

		// When
		const reply = useCase.execute(input);

		// Then
		await expect(reply).rejects.toMatchObject({ errorCode: ErrorCode.NUDGE_1105 });
		expect(repository.findInteractionById).not.toHaveBeenCalled();
	});

	it("알림 기록이 실패하면 실패를 전파해 같은 UoW를 롤백시킨다", async () => {
		// Given
		const error = new Error("알림 저장 실패");
		notifier.recordInteraction.mockRejectedValue(error);

		// When
		const reply = useCase.execute(input);

		// Then
		await expect(reply).rejects.toBe(error);
	});
});
