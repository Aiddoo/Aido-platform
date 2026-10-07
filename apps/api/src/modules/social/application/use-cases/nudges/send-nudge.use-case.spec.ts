import { MutationLockKeys } from "#api/shared/application/ports/index";
import { SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";
import { createSocialInteractionFixture } from "#test/fixtures/social-interactions.fixture";

import { SendNudge } from "./send-nudge.use-case.js";

describe("친구의 할 일에 콕 보내기", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SOCIAL_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    { name: "자기 자신", receiverId: "sender", change: "none", code: "NUDGE_1104" },
    { name: "친구가 아닌 사용자", receiverId: "other", change: "none", code: "NUDGE_1103" },
    { name: "삭제된 할 일", receiverId: "receiver", change: "missing", code: "TODO_0801" },
    { name: "타인의 할 일", receiverId: "receiver", change: "owner", code: "TODO_0801" },
    { name: "비공개 할 일", receiverId: "receiver", change: "private", code: "TODO_0801" },
    { name: "오늘이 아닌 할 일", receiverId: "receiver", change: "date", code: "NUDGE_1106" },
  ])("$name 은 $code 오류로 거부하고 기록이나 알림을 추가하지 않는다", async (input) => {
    // Given
    const fixture = createSocialInteractionFixture();
    const todo = fixture.addTodo();
    const record = fixture.nudgeRepository.todos.get(todo.id)!;
    if (input.change === "missing") fixture.nudgeRepository.todos.delete(todo.id);
    if (input.change === "owner") record.ownerId = "other";
    if (input.change === "private") record.visibility = "PRIVATE";
    if (input.change === "date") record.startDate = new Date("2026-07-25T00:00:00Z");
    // When / Then
    await expect(
      new SendNudge({
        ...fixture,
        notifier: fixture.nudgeNotifier,
        limitReader: fixture.nudgeLimitReader,
      }).execute({
        senderId: "sender",
        receiverId: input.receiverId,
        todoId: todo.id,
        timezone: "UTC",
      }),
    ).rejects.toMatchObject({ errorCode: input.code });
    expect(fixture.nudgeRepository.records.size).toBe(0);
    expect(fixture.nudgeNotifier.notifications).toEqual([]);
  });
  it.each([
    { name: "일일 한도", code: "NUDGE_1101" },
    { name: "동일 할 일 쿨다운", code: "NUDGE_1102" },
  ])("$name 동안은 추가 저장 없이 $code 오류로 거부한다", async (input) => {
    // Given
    const fixture = createSocialInteractionFixture();
    const todo = fixture.addTodo();
    if (input.code === "NUDGE_1101")
      for (let index = 0; index < 3; index += 1)
        fixture.nudgeRepository.seed({
          senderId: "sender",
          receiverId: "receiver",
          todoId: todo.id + index + 1,
        });
    else
      fixture.nudgeRepository.seed({ senderId: "sender", receiverId: "receiver", todoId: todo.id });
    const before = fixture.nudgeRepository.records.size;
    // When / Then
    await expect(
      new SendNudge({
        ...fixture,
        notifier: fixture.nudgeNotifier,
        limitReader: fixture.nudgeLimitReader,
      }).execute({ senderId: "sender", receiverId: "receiver", todoId: todo.id, timezone: "UTC" }),
    ).rejects.toMatchObject({ errorCode: input.code });
    expect(fixture.nudgeRepository.records.size).toBe(before);
    expect(fixture.nudgeNotifier.notifications).toEqual([]);
  });
  it.each(["FREE", "ACTIVE"])(
    "%s 사용자의 콕과 대상 할 일 제목을 저장된 상태에서 알림으로 전달한다",
    async (subscriptionStatus) => {
      // Given
      const fixture = createSocialInteractionFixture();
      const todo = fixture.addTodo();
      fixture.database.users.set("sender", { role: "USER", subscriptionStatus });
      if (subscriptionStatus === "ACTIVE")
        for (let index = 0; index < 4; index += 1)
          fixture.nudgeRepository.seed({
            senderId: "sender",
            receiverId: "receiver",
            todoId: todo.id + index + 1,
          });
      // When
      const result = await new SendNudge({
        ...fixture,
        notifier: fixture.nudgeNotifier,
        limitReader: fixture.nudgeLimitReader,
      }).execute({
        senderId: "sender",
        receiverId: "receiver",
        todoId: todo.id,
        message: "같이 해요",
        timezone: "UTC",
      });
      // Then
      expect(fixture.nudgeRepository.records.get(result.id)).toMatchObject({
        senderId: "sender",
        receiverId: "receiver",
        todoId: todo.id,
        message: "같이 해요",
        createdAt: SOCIAL_TIME,
      });
      expect(fixture.nudgeNotifier.notifications).toEqual([
        {
          nudgeId: result.id,
          senderId: "sender",
          receiverId: "receiver",
          senderName: "sender",
          todoId: todo.id,
          todoTitle: todo.title,
          message: "같이 해요",
        },
      ]);
    },
  );
  it("guarded read 전에 잠금을 획득하고 자정 대기 후에도 입력 시각의 날짜 구간을 유지한다", async () => {
    // Given
    vi.setSystemTime(new Date("2026-07-26T14:59:59.900Z"));
    const fixture = createSocialInteractionFixture();
    const todo = fixture.addTodo();
    const events: string[] = [];
    const originalTarget = fixture.nudgeRepository.findTargetTodo.bind(fixture.nudgeRepository);
    vi.spyOn(fixture.nudgeRepository, "findTargetTodo").mockImplementation(async (id) => {
      events.push("target");
      return originalTarget(id);
    });
    const count = vi.spyOn(fixture.nudgeRepository, "countSentSince");
    fixture.mutationLock.acquire = async (keys) => {
      events.push("lock");
      fixture.lockCalls.push([...keys]);
      vi.setSystemTime(new Date("2026-07-26T15:00:00.100Z"));
    };
    // When
    const result = await new SendNudge({
      ...fixture,
      notifier: fixture.nudgeNotifier,
      limitReader: fixture.nudgeLimitReader,
    }).execute({
      senderId: "sender",
      receiverId: "receiver",
      todoId: todo.id,
      timezone: "Asia/Seoul",
    });
    // Then
    expect(events).toEqual(["lock", "target"]);
    expect(fixture.lockCalls).toEqual([
      [
        MutationLockKeys.nudgeDailyQuota("sender"),
        MutationLockKeys.nudgeCooldown("sender", todo.id),
      ],
    ]);
    expect(count).toHaveBeenCalledWith(
      "sender",
      new Date("2026-07-25T15:00:00Z"),
      new Date("2026-07-26T15:00:00Z"),
    );
    expect(result.createdAt).toEqual(new Date("2026-07-26T14:59:59.900Z"));
  });
});
