import { TestBed } from "@suites/unit";
import { vi, type Mocked } from "vitest";

import { FollowReader } from "#api/follow/index";
import { UNIT_OF_WORK } from "#api/shared/application/ports/index";
import { NudgeBuilder } from "#test/builders/nudge.builder";
import { createNudgeRepositoryMock } from "#test/mocks/ports/nudge.mock";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import { NUDGE_INTERACTION_CONFIG } from "../../ports/nudge-interaction.config.port.js";
import { NUDGE_NOTIFIER, type NudgeNotifierPort } from "../../ports/nudge-notifier.port.js";
import { NUDGE_REPOSITORY, type NudgeRepositoryPort } from "../../ports/nudge.repository.port.js";
import { SendNudgeThanksUseCase } from "./send-nudge-thanks.use-case.js";

describe("콕에 감사 일괄 전하기", () => {
  let useCase: SendNudgeThanksUseCase;
  let nudgeRepository: Mocked<NudgeRepositoryPort>;
  let nudgeNotifier: Mocked<NudgeNotifierPort>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(SendNudgeThanksUseCase)
      .mock<NudgeRepositoryPort>(NUDGE_REPOSITORY)
      .impl(createNudgeRepositoryMock)
      .mock<NudgeNotifierPort>(NUDGE_NOTIFIER)
      .impl(() => ({
        notifyNudgeSent: vi.fn(),
        recordInteraction: vi.fn(),
        recordInteractions: vi.fn(),
      }))
      .mock(NUDGE_INTERACTION_CONFIG)
      .impl(() => ({ isEnabled: true }))
      .mock(UNIT_OF_WORK)
      .impl(createUnitOfWorkMock)
      .compile();
    useCase = unit;
    nudgeRepository = unitRef.get(NUDGE_REPOSITORY);
    nudgeNotifier = unitRef.get(NUDGE_NOTIFIER);
    const cutoff = NudgeBuilder.create("friend", "owner", 10).withId(1000).buildInteraction();
    nudgeRepository.lockInteractionTodo.mockResolvedValue({ ...cutoff.todo, completed: true });
    nudgeRepository.findInteractionById.mockResolvedValue(cutoff);
    const followReader: Mocked<FollowReader> = unitRef.get(FollowReader);
    followReader.getCurrentMutualFriendIds.mockResolvedValue(["friend"]);
  });

  it("친구가 천 명이어도 저장과 알림을 100명씩 열 번 호출한다", async () => {
    // Given
    const candidates = Array.from({ length: 1000 }, (_, index) =>
      NudgeBuilder.create(`friend-${index}`, "owner", 10)
        .withId(index + 1)
        .buildInteraction(),
    );
    nudgeRepository.findThanksCandidates.mockResolvedValue(candidates);

    // When
    const result = await useCase.execute({ userId: "owner", todoId: 10, throughNudgeId: 1000 });

    // Then
    expect(result.sentCount).toBe(1000);
    expect(nudgeRepository.saveThanksBatch).toHaveBeenCalledTimes(10);
    expect(nudgeNotifier.recordInteractions).toHaveBeenCalledTimes(10);
    expect(nudgeNotifier.recordInteraction).not.toHaveBeenCalled();
    for (const [ids] of nudgeRepository.saveThanksBatch.mock.calls) expect(ids).toHaveLength(100);
  });

  it("이미 감사한 상태는 Entity가 제외하며 전송 수에 포함하지 않는다", async () => {
    // Given
    const candidate = NudgeBuilder.create("friend", "owner", 10).withId(1).buildInteraction();
    nudgeRepository.findThanksCandidates.mockResolvedValue([
      { ...candidate, thankedAt: new Date() },
    ]);

    // When
    const result = await useCase.execute({ userId: "owner", todoId: 10, throughNudgeId: 1000 });

    // Then
    expect(result.sentCount).toBe(0);
    expect(nudgeNotifier.recordInteractions).not.toHaveBeenCalled();
    expect(nudgeRepository.saveThanksBatch).not.toHaveBeenCalled();
  });

  it("배치 저장 실패는 전송을 진행하지 않고 트랜잭션으로 오류를 전달한다", async () => {
    // Given
    nudgeRepository.findThanksCandidates.mockResolvedValue([
      NudgeBuilder.create("friend", "owner", 10).withId(1).buildInteraction(),
    ]);
    nudgeRepository.saveThanksBatch.mockRejectedValue(new Error("저장 실패"));

    // When
    const result = useCase.execute({ userId: "owner", todoId: 10, throughNudgeId: 1000 });

    // Then
    await expect(result).rejects.toThrow("저장 실패");
    expect(nudgeNotifier.recordInteractions).not.toHaveBeenCalled();
  });
});
