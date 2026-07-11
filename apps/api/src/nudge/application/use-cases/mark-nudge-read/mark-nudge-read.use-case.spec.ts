import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { Nudge } from "../../../domain/entities/nudge.entity";
import {
	NUDGE_REPOSITORY,
	type NudgeRepositoryPort,
} from "../../ports/nudge.repository.port";
import { MarkNudgeReadUseCase } from "./mark-nudge-read.use-case";

const buildNudge = (receiverId: string, readAt: Date | null) =>
	Nudge.reconstitute({
		id: 1,
		senderId: "s",
		receiverId,
		todoId: 10,
		message: null,
		readAt,
		createdAt: new Date(),
	});

describe("MarkNudgeReadUseCase", () => {
	let useCase: MarkNudgeReadUseCase;
	let repo: Mocked<NudgeRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(MarkNudgeReadUseCase).compile();
		useCase = unit;
		repo = unitRef.get(NUDGE_REPOSITORY);
	});

	it("존재하지 않으면 NUDGE_1105", async () => {
		repo.findById.mockResolvedValue(null);
		await expect(
			useCase.execute({ userId: "r", nudgeId: 1 }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("다른 사용자의 콕 찌르기면 NUDGE_1105", async () => {
		repo.findById.mockResolvedValue(buildNudge("other", null));
		await expect(
			useCase.execute({ userId: "r", nudgeId: 1 }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("이미 읽음이면 no-op", async () => {
		repo.findById.mockResolvedValue(buildNudge("r", new Date()));
		await useCase.execute({ userId: "r", nudgeId: 1 });
		expect(repo.markAsRead).not.toHaveBeenCalled();
	});

	it("미읽음이면 읽음 처리", async () => {
		repo.findById.mockResolvedValue(buildNudge("r", null));
		await useCase.execute({ userId: "r", nudgeId: 1 });
		expect(repo.markAsRead).toHaveBeenCalledWith(1);
	});
});
