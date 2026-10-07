import { vi } from "vitest";

import { TodoBuilder } from "#test/builders/todo.builder";
import {
  createEngagementCommentFixture,
  ENGAGEMENT_TIME,
  ENGAGEMENT_OWNER_ID,
  ENGAGEMENT_VIEWER_ID,
} from "#test/fixtures/engagement-comment.fixture";
import { createTodoResponseFixture } from "#test/fixtures/todo-response.fixture";

import { GetTodoDetails } from "./get-todo-details.use-case.js";

describe("GetTodoDetails — 할 일 상세 조회와 방문 기록", () => {
  let fixture: ReturnType<typeof createEngagementCommentFixture>;
  let useCase: GetTodoDetails;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(ENGAGEMENT_TIME);
    fixture = createEngagementCommentFixture();
    fixture.reader.details.set(1, {
      todo: createTodoResponseFixture(
        TodoBuilder.create(ENGAGEMENT_OWNER_ID).withId(1).withStartDate(ENGAGEMENT_TIME).build(),
      ),
      owner: { id: ENGAGEMENT_OWNER_ID, name: "작성자", profileImage: null },
      viewCount: 7,
      commentCount: 3,
      isOwner: false,
    });
    fixture.repository.viewCounts.set(1, 7);
    useCase = new GetTodoDetails({
      todoCommentReader: fixture.reader,
      todoCommentRepository: fixture.repository,
      unitOfWork: fixture.unitOfWork,
    });
  });
  afterEach(() => vi.useRealTimers());

  it("소유자는 조회수를 추가하지 않고 편집 권한을 받는다", async () => {
    // Given / When
    const result = await useCase.execute({ todoId: 1, viewerId: ENGAGEMENT_OWNER_ID });
    // Then
    expect(result.permissions).toEqual({ canEdit: true, canComment: true, canNudge: false });
    expect(result.metrics).toEqual({ viewCount: 7, commentCount: 3 });
    expect(fixture.repository.views.size).toBe(0);
    expect(fixture.repository.viewCounts.get(1)).toBe(7);
  });

  it("같은 방문자의 반복 조회는 조회수를 한 번만 늘리고 방문자 권한을 유지한다", async () => {
    // Given / When
    const first = await useCase.execute({ todoId: 1, viewerId: ENGAGEMENT_VIEWER_ID });
    const second = await useCase.execute({ todoId: 1, viewerId: ENGAGEMENT_VIEWER_ID });
    // Then
    expect(first.permissions).toEqual({ canEdit: false, canComment: true, canNudge: true });
    expect(first.metrics.viewCount).toBe(8);
    expect(second.metrics.viewCount).toBe(8);
    expect(fixture.repository.views.size).toBe(1);
    expect(fixture.repository.viewCounts.get(1)).toBe(8);
  });

  it("접근할 수 없는 할 일은 TODO_0801로 거부하고 조회수를 기록하지 않는다", async () => {
    // Given
    fixture.reader.accessiblePairs.delete(`1:${ENGAGEMENT_VIEWER_ID}`);
    // When / Then
    await expect(
      useCase.execute({ todoId: 1, viewerId: ENGAGEMENT_VIEWER_ID }),
    ).rejects.toMatchObject({ errorCode: "TODO_0801" });
    expect(fixture.repository.views.size).toBe(0);
    expect(fixture.repository.viewCounts.get(1)).toBe(7);
  });
});
