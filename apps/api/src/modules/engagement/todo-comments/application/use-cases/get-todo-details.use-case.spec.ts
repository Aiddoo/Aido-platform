import { ErrorCode } from "@aido/api/errors";

import {
  TODO_COMMENT_FIXTURE_FRIEND_ID,
  TODO_COMMENT_FIXTURE_OWNER_ID,
  TODO_COMMENT_FIXTURE_TODO_ID,
  TODO_COMMENT_FIXTURE_VIEWER_ID,
} from "#test/fixtures/engagement/todo-comment.fixture";
import {
  createTodoCommentsFixture,
  type TodoCommentsFixture,
} from "#test/fixtures/engagement/todo-comments.fixture";
import { createTodoReadModelFixture } from "#test/fixtures/planning/todo-read-model.fixture";

import { GetTodoDetailsUseCase } from "./get-todo-details.use-case.js";

const TODO_ID = TODO_COMMENT_FIXTURE_TODO_ID;

describe("GetTodoDetailsUseCase — 할 일 상세와 조회 수", () => {
  let fixture: TodoCommentsFixture;

  beforeEach(() => {
    fixture = createTodoCommentsFixture();
    fixture.reader.details.set(TODO_ID, {
      todo: createTodoReadModelFixture({ id: TODO_ID, userId: TODO_COMMENT_FIXTURE_OWNER_ID }),
      owner: { id: TODO_COMMENT_FIXTURE_OWNER_ID, name: "작성자", profileImage: null },
      viewCount: 3,
      commentCount: 2,
      isOwner: false,
    });
    fixture.engagementCounter.viewCounts.set(TODO_ID, 3);
  });

  it("주인이 열면 조회 수를 올리지 않는다", async () => {
    // When
    const details = await new GetTodoDetailsUseCase(fixture).execute({
      todoId: TODO_ID,
      viewerId: TODO_COMMENT_FIXTURE_OWNER_ID,
      timezone: "UTC",
    });

    // Then
    expect({ isOwner: details.isOwner, viewCount: details.viewCount }).toEqual({
      isOwner: true,
      viewCount: 3,
    });
    expect(fixture.engagementCounter.viewCounts.get(TODO_ID)).toBe(3);
  });

  it("같은 방문자가 여러 번 열어도 조회 수는 한 번만 늘린다", async () => {
    // Given
    const useCase = new GetTodoDetailsUseCase(fixture);

    // When
    const first = await useCase.execute({
      todoId: TODO_ID,
      viewerId: TODO_COMMENT_FIXTURE_VIEWER_ID,
      timezone: "UTC",
    });
    const second = await useCase.execute({
      todoId: TODO_ID,
      viewerId: TODO_COMMENT_FIXTURE_VIEWER_ID,
      timezone: "UTC",
    });
    const other = await useCase.execute({
      todoId: TODO_ID,
      viewerId: TODO_COMMENT_FIXTURE_FRIEND_ID,
      timezone: "UTC",
    });

    // Then
    expect([first.viewCount, second.viewCount, other.viewCount]).toEqual([4, 4, 5]);
  });

  it("볼 수 없는 할 일은 TODO_0801로 거부하고 조회를 남기지 않는다", async () => {
    // Given
    fixture.reader.revokeAccess(TODO_ID, TODO_COMMENT_FIXTURE_VIEWER_ID);

    // When
    const opening = new GetTodoDetailsUseCase(fixture).execute({
      todoId: TODO_ID,
      viewerId: TODO_COMMENT_FIXTURE_VIEWER_ID,
      timezone: "UTC",
    });

    // Then
    await expect(opening).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
    expect(fixture.engagementCounter.viewCounts.get(TODO_ID)).toBe(3);
  });

  it.each([
    { name: "끝내지 않은 오늘 할 일", todo: { startDate: "2026-08-26" }, canNudge: true },
    {
      name: "오늘 끝낸 할 일",
      todo: { startDate: "2026-08-26", completed: true },
      canNudge: false,
    },
    { name: "내일 할 일", todo: { startDate: "2026-08-27" }, canNudge: false },
  ])(
    "친구가 보는 $name은 콕 보내기와 같은 규칙으로 canNudge가 $canNudge다",
    async ({ todo, canNudge }) => {
      // Given
      // 고정 시계는 UTC 2026-08-26 01:00이다
      fixture.reader.details.set(TODO_ID, {
        todo: createTodoReadModelFixture({
          id: TODO_ID,
          userId: TODO_COMMENT_FIXTURE_OWNER_ID,
          ...todo,
        }),
        owner: { id: TODO_COMMENT_FIXTURE_OWNER_ID, name: "작성자", profileImage: null },
        viewCount: 3,
        commentCount: 2,
        isOwner: false,
      });

      // When
      const details = await new GetTodoDetailsUseCase(fixture).execute({
        todoId: TODO_ID,
        viewerId: TODO_COMMENT_FIXTURE_VIEWER_ID,
        timezone: "UTC",
      });

      // Then
      expect(details.permissions).toEqual({ canEdit: false, canComment: true, canNudge });
    },
  );
});
