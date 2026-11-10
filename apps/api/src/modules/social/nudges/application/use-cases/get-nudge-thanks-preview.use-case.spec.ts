import { createSocialInteractionFixture } from "#test/fixtures/social-interactions.fixture";

import { GetNudgeThanksPreview } from "./get-nudge-thanks-preview.use-case.js";

const FIRST_THANKED_AT = new Date("2026-07-26T01:00:00.000Z");
const LAST_THANKED_AT = new Date("2026-07-26T03:12:00.000Z");

describe("감사 미리보기", () => {
  it("이미 감사한 친구는 중복 없이 세고 마지막 감사 시각을 함께 돌려준다", async () => {
    // Given
    const fixture = createSocialInteractionFixture();
    fixture.addUser("other");
    fixture.addMutual("other", "receiver");
    const todo = fixture.addTodo({ completed: true });
    fixture.nudgeRepository.seed({
      id: 1,
      senderId: "sender",
      receiverId: "receiver",
      todoId: todo.id,
      thankedAt: FIRST_THANKED_AT,
    });
    fixture.nudgeRepository.seed({
      id: 2,
      senderId: "sender",
      receiverId: "receiver",
      todoId: todo.id,
      thankedAt: LAST_THANKED_AT,
    });
    fixture.nudgeRepository.seed({
      id: 3,
      senderId: "other",
      receiverId: "receiver",
      todoId: todo.id,
    });
    // When
    const preview = await new GetNudgeThanksPreview(fixture).execute({
      userId: "receiver",
      todoId: todo.id,
      limit: 20,
    });
    // Then
    expect(preview).toMatchObject({
      throughNudgeId: 3,
      thankedRecipientCount: 1,
      lastThankedAt: LAST_THANKED_AT,
    });
  });

  it("콕을 받은 적이 없으면 감사한 친구 수 0과 null 시각을 돌려준다", async () => {
    // Given
    const fixture = createSocialInteractionFixture();
    const todo = fixture.addTodo({ completed: true });
    // When
    const preview = await new GetNudgeThanksPreview(fixture).execute({
      userId: "receiver",
      todoId: todo.id,
      limit: 20,
    });
    // Then
    expect(preview).toEqual({
      todoId: todo.id,
      throughNudgeId: null,
      recipients: [],
      totalRecipients: 0,
      nextCursor: null,
      hasNext: false,
      thankedRecipientCount: 0,
      lastThankedAt: null,
    });
  });
});
