import { createPlanningTodoFixture } from "#test/fixtures/planning/planning-todos.fixture";
import { createPlanningTodoRecordFixture } from "#test/fixtures/planning/todo-response.fixture";
import { createTodoSeriesFixture } from "#test/fixtures/planning/todo-series.fixture";

const USER_ID = "planning-user";
const START = Temporal.PlainDate.from("2026-11-10");

function seriesWithOccurrences(titles: readonly string[]) {
  const series = createTodoSeriesFixture({
    userId: USER_ID,
    title: "물 마시기",
    nextOccurrenceDate: START.add({ days: titles.length }),
    generatedCount: titles.length,
  });
  const todos = titles.map((title, index) =>
    createPlanningTodoRecordFixture({
      userId: USER_ID,
      id: index + 1,
      title,
      startDate: START.add({ days: index }),
      seriesId: series.id.value,
      occurrenceDate: START.add({ days: index }),
    }),
  );
  const fixture = createPlanningTodoFixture({ userId: USER_ID, todos });
  fixture.seriesStore.set(series.id.value, series);
  return { fixture, series };
}

describe("이 할 일과 이후 고치기 적용", () => {
  it("보낸 값이 규칙과 같아도 따로 고친 회차를 덮어쓰면 회차가 바뀐 사실을 낸다", async () => {
    // Given
    const { fixture, series } = seriesWithOccurrences(["물 마시기", "물 마시기", "따로 고친 제목"]);

    // When
    await fixture.applyFollowingUpdate.execute({
      id: 1,
      userId: USER_ID,
      timezone: "Asia/Seoul",
      title: "물 마시기",
    });

    // Then
    expect(fixture.records.get(3)?.title).toBe("물 마시기");
    expect(
      fixture.eventPublisher.publishedEvents.map((event) => ({
        eventName: event.eventName,
        payload: event.toPayload(),
      })),
    ).toEqual([
      {
        eventName: "planning.todo-series.occurrences-changed",
        payload: expect.objectContaining({ seriesId: series.id.value, userId: USER_ID }),
      },
    ]);
  });

  it("고칠 값이 없으면 회차가 바뀐 사실을 내지 않는다", async () => {
    // Given
    const { fixture } = seriesWithOccurrences(["물 마시기", "물 마시기"]);

    // When
    await fixture.applyFollowingUpdate.execute({ id: 1, userId: USER_ID, timezone: "Asia/Seoul" });

    // Then
    expect(fixture.eventPublisher.publishedEvents).toEqual([]);
  });
});
