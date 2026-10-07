import { SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";
import { createSocialInteractionFixture } from "#test/fixtures/social-interactions.fixture";

import { ReplyToNudge } from "./reply-to-nudge.use-case.js";

function replyFixture() {
  const fixture = createSocialInteractionFixture();
  const todo = fixture.addTodo({ id: 10 });
  const nudge = fixture.nudgeRepository.seed({
    senderId: "sender",
    receiverId: "receiver",
    todoId: todo.id,
  });
  const input = {
    userId: "receiver",
    nudgeId: nudge.id,
    replyKind: "STARTING",
  } satisfies Parameters<ReplyToNudge["execute"]>[0];
  return { ...fixture, todo, nudge, input, useCase: new ReplyToNudge(fixture) };
}

describe("받은 콕에 답장", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SOCIAL_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("첫 답장은 저장과 알림을 남기지만 할 일 완료 상태를 바꾸지 않는다", async () => {
    // Given
    const fixture = replyFixture();
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result).toMatchObject({
      replyKind: "STARTING",
      repliedAt: SOCIAL_TIME,
      replyUpdatedAt: SOCIAL_TIME,
      readAt: SOCIAL_TIME,
      isAvailable: true,
    });
    expect(fixture.nudgeRepository.records.get(fixture.nudge.id)).toMatchObject({
      replyKind: "STARTING",
      repliedAt: SOCIAL_TIME,
    });
    expect(fixture.nudgeRepository.todos.get(fixture.todo.id)?.completed).toBe(false);
    expect(fixture.nudgeNotifier.interactions).toEqual([
      {
        kind: "reply",
        nudgeId: fixture.nudge.id,
        todoId: fixture.todo.id,
        actorId: "receiver",
        recipientId: "sender",
        actorName: "receiver",
        todoTitle: fixture.todo.title,
        replyKind: "STARTING",
      },
    ]);
  });
  it("같은 답장 재요청은 저장이나 알림을 반복하지 않고 처음 시각을 보존한다", async () => {
    // Given
    const fixture = replyFixture();
    await fixture.useCase.execute(fixture.input);
    vi.setSystemTime(new Date(SOCIAL_TIME.getTime() + 10000));
    const save = vi.spyOn(fixture.nudgeRepository, "saveReply");
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result.replyUpdatedAt).toEqual(SOCIAL_TIME);
    expect(save).not.toHaveBeenCalled();
    expect(fixture.nudgeNotifier.interactions).toHaveLength(1);
  });
  it("답장 변경은 첫 답장 시각을 보존하고 새 알림을 추가하지 않는다", async () => {
    // Given
    const fixture = replyFixture();
    await fixture.useCase.execute(fixture.input);
    const updatedAt = new Date(SOCIAL_TIME.getTime() + 10000);
    vi.setSystemTime(updatedAt);
    // When
    const result = await fixture.useCase.execute({ ...fixture.input, replyKind: "LATER" });
    // Then
    expect(result).toMatchObject({
      replyKind: "LATER",
      repliedAt: SOCIAL_TIME,
      replyUpdatedAt: updatedAt,
    });
    expect(fixture.nudgeNotifier.interactions).toHaveLength(1);
  });
  it.each([
    { state: "sender", code: "NUDGE_1105" },
    { state: "missing", code: "NUDGE_1105" },
    { state: "unfriended", code: "NUDGE_1109" },
    { state: "private", code: "NUDGE_1109" },
    { state: "deleted-todo", code: "NUDGE_1105" },
  ])("$state 상태이면 $code 오류로 거부하고 답장을 저장하지 않는다", async (input) => {
    // Given
    const fixture = replyFixture();
    if (input.state === "missing") fixture.nudgeRepository.records.delete(fixture.nudge.id);
    if (input.state === "unfriended") fixture.followRepository.follows.clear();
    if (input.state === "private")
      fixture.nudgeRepository.todos.get(fixture.todo.id)!.visibility = "PRIVATE";
    if (input.state === "deleted-todo") fixture.nudgeRepository.todos.delete(fixture.todo.id);
    // When / Then
    await expect(
      fixture.useCase.execute({
        ...fixture.input,
        userId: input.state === "sender" ? "sender" : "receiver",
      }),
    ).rejects.toMatchObject({ errorCode: input.code });
    expect(fixture.nudgeRepository.records.get(fixture.nudge.id)?.replyKind ?? null).toBeNull();
    expect(fixture.nudgeNotifier.interactions).toEqual([]);
  });
  it("행 잠금 이후 할 일이 비공개로 바뀌었다면 답장을 저장하지 않는다", async () => {
    // Given
    const fixture = replyFixture();
    const lock = fixture.nudgeRepository.lockInteractionTodo.bind(fixture.nudgeRepository);
    vi.spyOn(fixture.nudgeRepository, "lockInteractionTodo").mockImplementation(
      async (...input) => {
        fixture.nudgeRepository.todos.get(fixture.todo.id)!.visibility = "PRIVATE";
        return lock(...input);
      },
    );
    // When / Then
    await expect(fixture.useCase.execute(fixture.input)).rejects.toMatchObject({
      errorCode: "NUDGE_1109",
    });
    expect(fixture.nudgeRepository.records.get(fixture.nudge.id)?.replyKind).toBeNull();
  });
  it("기능이 꺼져 있으면 저장소에 접근하기 전에 거부한다", async () => {
    // Given
    const fixture = replyFixture();
    fixture.nudgeInteractionConfig.isEnabled = false;
    const read = vi.spyOn(fixture.nudgeRepository, "findInteractionById");
    // When / Then
    await expect(fixture.useCase.execute(fixture.input)).rejects.toMatchObject({
      errorCode: "NUDGE_1105",
    });
    expect(read).not.toHaveBeenCalled();
  });
  it("알림 기록 실패는 원본 오류를 UoW 호출자에게 전달한다", async () => {
    // Given
    const fixture = replyFixture();
    const error = new Error("알림 저장 실패");
    vi.spyOn(fixture.nudgeNotifier, "recordInteraction").mockRejectedValueOnce(error);
    // When / Then
    await expect(fixture.useCase.execute(fixture.input)).rejects.toBe(error);
    expect(fixture.nudgeNotifier.interactions).toEqual([]);
  });
});
