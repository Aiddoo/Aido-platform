import { SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";
import { createSocialInteractionFixture } from "#test/fixtures/social-interactions.fixture";

import { SendNudgeThanks } from "./send-nudge-thanks.use-case.js";

describe("콕에 감사 일괄 전하기", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SOCIAL_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("친구 천 명의 상태를 100명씩 갱신하고 알림을 열 배치로 기록한다", async () => {
    // Given
    const fixture = createSocialInteractionFixture();
    const todo = fixture.addTodo({ id: 10, completed: true });
    const friendIds: string[] = [];
    for (let index = 0; index < 1000; index += 1) {
      const friendId = `friend-${index}`;
      friendIds.push(friendId);
      fixture.nudgeRepository.seed({
        id: index + 1,
        senderId: friendId,
        receiverId: "receiver",
        todoId: todo.id,
      });
    }
    const followReader = { getCurrentMutualFriendIds: async () => [...friendIds] };
    const save = vi.spyOn(fixture.nudgeRepository, "saveThanksBatch");
    // When
    const result = await new SendNudgeThanks({ ...fixture, followReader }).execute({
      userId: "receiver",
      todoId: todo.id,
      throughNudgeId: 1000,
    });
    // Then
    expect(result.sentCount).toBe(1000);
    expect(
      [...fixture.nudgeRepository.records.values()].every(
        (record) => record.thankedAt?.getTime() === SOCIAL_TIME.getTime(),
      ),
    ).toBe(true);
    expect(fixture.nudgeNotifier.batchSizes).toEqual(Array(10).fill(100));
    expect(fixture.nudgeNotifier.interactions).toHaveLength(1000);
    expect(save).toHaveBeenCalledTimes(10);
    for (const [ids] of save.mock.calls) expect(ids).toHaveLength(100);
  });
  it("이미 감사한 상태는 추가 저장과 알림 없이 전송 개수에서 제외한다", async () => {
    // Given
    const fixture = createSocialInteractionFixture();
    const todo = fixture.addTodo({ completed: true });
    const record = fixture.nudgeRepository.seed({
      senderId: "sender",
      receiverId: "receiver",
      todoId: todo.id,
      thankedAt: SOCIAL_TIME,
    });
    const save = vi.spyOn(fixture.nudgeRepository, "saveThanksBatch");
    // When
    const result = await new SendNudgeThanks(fixture).execute({
      userId: "receiver",
      todoId: todo.id,
      throughNudgeId: record.id,
    });
    // Then
    expect(result.sentCount).toBe(0);
    expect(save).not.toHaveBeenCalled();
    expect(fixture.nudgeNotifier.interactions).toEqual([]);
  });
  it("배치 저장 실패는 원본 오류를 전파하고 해당 배치의 알림을 기록하지 않는다", async () => {
    // Given
    const fixture = createSocialInteractionFixture();
    const todo = fixture.addTodo({ completed: true });
    const record = fixture.nudgeRepository.seed({
      senderId: "sender",
      receiverId: "receiver",
      todoId: todo.id,
    });
    const error = new Error("배치 저장 실패");
    vi.spyOn(fixture.nudgeRepository, "saveThanksBatch").mockRejectedValueOnce(error);
    // When / Then
    await expect(
      new SendNudgeThanks(fixture).execute({
        userId: "receiver",
        todoId: todo.id,
        throughNudgeId: record.id,
      }),
    ).rejects.toBe(error);
    expect(fixture.nudgeRepository.records.get(record.id)?.thankedAt).toBeNull();
    expect(fixture.nudgeNotifier.interactions).toEqual([]);
  });
});
