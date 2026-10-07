import { TestBed } from "@suites/unit";
import type { Mocked } from "vitest";

import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { Nudge } from "../../../domain/entities/nudge.aggregate.js";
import { NUDGE_REPOSITORY, type NudgeRepositoryPort } from "../../ports/nudge.repository.port.js";
import { MarkNudgeReadUseCase } from "./mark-nudge-read.use-case.js";

const buildNudge = (receiverId: string, readAt: Date | null) =>
  Nudge.reconstitute({
    id: 1,
    senderId: "s",
    receiverId,
    todoId: 10,
    message: null,
    readAt,
    replyKind: null,
    repliedAt: null,
    replyUpdatedAt: null,
    thankedAt: null,
    createdAt: new Date(),
  });

describe("MarkNudgeReadUseCase", () => {
  let useCase: MarkNudgeReadUseCase;
  let repo: Mocked<NudgeRepositoryPort>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(MarkNudgeReadUseCase).compile();
    useCase = unit;
    repo = unitRef.get(NUDGE_REPOSITORY);
  });

  it("존재하지 않으면 NUDGE_1105", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ userId: "r", nudgeId: 1 })).rejects.toBeInstanceOf(
      ApplicationException,
    );
  });

  it("다른 사용자의 콕 찌르기면 NUDGE_1105", async () => {
    repo.findById.mockResolvedValue(buildNudge("other", null));
    await expect(useCase.execute({ userId: "r", nudgeId: 1 })).rejects.toBeInstanceOf(
      ApplicationException,
    );
  });

  it("이미 읽음이면 no-op", async () => {
    repo.findById.mockResolvedValue(buildNudge("r", new Date()));
    await useCase.execute({ userId: "r", nudgeId: 1 });
    expect(repo.saveRead).not.toHaveBeenCalled();
  });

  it("미읽음이면 읽음 처리", async () => {
    repo.findById.mockResolvedValue(buildNudge("r", null));
    await useCase.execute({ userId: "r", nudgeId: 1 });
    expect(repo.saveRead).toHaveBeenCalledWith(expect.any(Nudge));
    expect(repo.saveRead.mock.calls[0]?.[0].readAt).toEqual(expect.any(Date));
  });
});
