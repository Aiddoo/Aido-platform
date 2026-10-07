import { MutationLockKeys } from "#api/shared/application/ports/index";
import { SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";
import { createSocialInteractionFixture } from "#test/fixtures/social-interactions.fixture";

import { SendRemindNudge } from "./send-remind-nudge.use-case.js";

describe("할 일이 없는 친구에게 리마인드 콕 보내기", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SOCIAL_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    { receiverId: "sender", code: "NUDGE_1104" },
    { receiverId: "other", code: "NUDGE_1103" },
  ])("$code 조건이면 리마인드와 알림을 저장하지 않는다", async (input) => {
    // Given
    const fixture = createSocialInteractionFixture();
    // When / Then
    await expect(
      new SendRemindNudge({ ...fixture, notifier: fixture.nudgeNotifier }).execute({
        senderId: "sender",
        receiverId: input.receiverId,
        timezone: "UTC",
      }),
    ).rejects.toMatchObject({ errorCode: input.code });
    expect(fixture.nudgeRepository.reminders.size).toBe(0);
    expect(fixture.nudgeNotifier.notifications).toEqual([]);
  });
  it("친구에게 오늘 할 일이 있으면 NUDGE_1107로 거부한다", async () => {
    // Given
    const fixture = createSocialInteractionFixture();
    fixture.addTodo();
    // When / Then
    await expect(
      new SendRemindNudge({ ...fixture, notifier: fixture.nudgeNotifier }).execute({
        senderId: "sender",
        receiverId: "receiver",
        timezone: "UTC",
      }),
    ).rejects.toMatchObject({ errorCode: "NUDGE_1107" });
    expect(fixture.nudgeRepository.reminders.size).toBe(0);
  });
  it("한 시간 내 재요청은 남은 쿨다운과 NUDGE_1108로 거부한다", async () => {
    // Given
    const fixture = createSocialInteractionFixture();
    fixture.nudgeRepository.seedReminder({
      senderId: "sender",
      receiverId: "receiver",
      message: null,
      createdAt: new Date(SOCIAL_TIME.getTime() - 1000),
    });
    // When / Then
    await expect(
      new SendRemindNudge({ ...fixture, notifier: fixture.nudgeNotifier }).execute({
        senderId: "sender",
        receiverId: "receiver",
        timezone: "UTC",
      }),
    ).rejects.toMatchObject({ errorCode: "NUDGE_1108", details: { remainingSeconds: 3599 } });
    expect(fixture.nudgeRepository.reminders.size).toBe(1);
  });
  it("오늘 할 일이 없으면 todoId 없는 리마인드를 저장하고 알림을 만든다", async () => {
    // Given
    const fixture = createSocialInteractionFixture();
    // When
    const result = await new SendRemindNudge({
      ...fixture,
      notifier: fixture.nudgeNotifier,
    }).execute({
      senderId: "sender",
      receiverId: "receiver",
      message: "작게 시작해요",
      timezone: "UTC",
    });
    // Then
    expect(fixture.nudgeRepository.reminders.get(result.id)).toMatchObject({
      senderId: "sender",
      receiverId: "receiver",
      message: "작게 시작해요",
    });
    expect(fixture.nudgeNotifier.notifications).toEqual([
      {
        nudgeId: result.id,
        senderId: "sender",
        receiverId: "receiver",
        senderName: "sender",
        message: "작게 시작해요",
      },
    ]);
  });
  it("친구 쿨다운 키를 오늘 할 일과 최근 리마인드 조회 전에 획득한다", async () => {
    // Given
    const fixture = createSocialInteractionFixture();
    const events: string[] = [];
    fixture.mutationLock.acquire = async (keys) => {
      fixture.lockCalls.push([...keys]);
      events.push("lock");
    };
    const count = fixture.nudgeRepository.countTodayTodos.bind(fixture.nudgeRepository);
    vi.spyOn(fixture.nudgeRepository, "countTodayTodos").mockImplementation(async (...input) => {
      events.push("today");
      return count(...input);
    });
    // When
    await new SendRemindNudge({ ...fixture, notifier: fixture.nudgeNotifier }).execute({
      senderId: "sender",
      receiverId: "receiver",
      timezone: "UTC",
    });
    // Then
    expect(events).toEqual(["lock", "today"]);
    expect(fixture.lockCalls).toEqual([
      [MutationLockKeys.remindNudgeCooldown("sender", "receiver")],
    ]);
  });
});
