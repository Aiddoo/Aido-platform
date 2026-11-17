import { type OccurrenceSlot, planOccurrenceRemap } from "./occurrence-remap.domain-service.js";

const SOURCE = "source-series";
const FOLLOWING = "following-series";

function slot(overrides: Partial<OccurrenceSlot> & Pick<OccurrenceSlot, "todoId">): OccurrenceSlot {
  return { seriesId: SOURCE, occurrenceDate: "2026-11-10", completed: false, ...overrides };
}

describe("이후 회차 다시 맞추기 계획", () => {
  it("새 날짜에 맞는 행은 남기고 날짜마다 완료 기록과 기준 규칙 행을 먼저 지킨다", () => {
    // Given
    const rows = [
      slot({ todoId: 1, occurrenceDate: "2026-11-10" }),
      slot({ todoId: 2, occurrenceDate: "2026-11-11", seriesId: FOLLOWING }),
      slot({ todoId: 3, occurrenceDate: "2026-11-11" }),
      slot({ todoId: 4, occurrenceDate: "2026-11-12", completed: true }),
      slot({ todoId: 5, occurrenceDate: "2026-11-13" }),
    ];

    // When
    const plan = planOccurrenceRemap({
      rows,
      dates: ["2026-11-10", "2026-11-11"],
      pivotTodoId: 1,
      sourceSeriesId: SOURCE,
    });

    // Then
    expect(plan.keep.map((row) => row.todoId)).toEqual([1, 3]);
    expect(plan.deletedTodoIds).toEqual([2, 5]);
    expect(plan).toMatchObject({ responseTodoId: 1, pivotMoveDate: null });
  });

  it("기준 회차가 새 규칙에 없으면 지우지 않고 첫 날짜로 옮기며 그 날짜의 미완료 행을 비운다", () => {
    // Given
    const rows = [
      slot({ todoId: 1, occurrenceDate: "2026-11-10" }),
      slot({ todoId: 2, occurrenceDate: "2026-11-12" }),
    ];

    // When
    const plan = planOccurrenceRemap({
      rows,
      dates: ["2026-11-12", "2026-11-14"],
      pivotTodoId: 1,
      sourceSeriesId: SOURCE,
    });

    // Then
    expect(plan.deletedTodoIds).toEqual([2]);
    expect(plan).toMatchObject({ responseTodoId: 1, pivotMoveDate: "2026-11-12" });
  });

  it("첫 날짜를 이미 완료했으면 기준 회차를 지우고 완료한 회차를 돌려준다", () => {
    // Given
    const rows = [
      slot({ todoId: 1, occurrenceDate: "2026-11-10" }),
      slot({ todoId: 2, occurrenceDate: "2026-11-12", completed: true }),
    ];

    // When
    const plan = planOccurrenceRemap({
      rows,
      dates: ["2026-11-12"],
      pivotTodoId: 1,
      sourceSeriesId: SOURCE,
    });

    // Then
    expect(plan.deletedTodoIds).toEqual([1]);
    expect(plan).toMatchObject({ responseTodoId: 2, pivotMoveDate: null });
  });
});
