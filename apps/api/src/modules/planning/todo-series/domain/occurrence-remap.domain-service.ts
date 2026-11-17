import { sortBy, uniqBy } from "es-toolkit";

export interface OccurrenceSlot {
  readonly todoId: number;
  readonly seriesId: string;
  readonly occurrenceDate: string;
  readonly completed: boolean;
}

export interface OccurrenceRemapPlan {
  // 새 규칙의 날짜마다 남길 회차. 다른 구간의 행이면 새 규칙으로 옮긴다
  readonly keep: readonly OccurrenceSlot[];
  readonly deletedTodoIds: readonly number[];
  // 기준 회차가 첫 날짜를 이미 완료한 회차로 바뀌면 그 회차다
  readonly responseTodoId: number;
  // 기준 회차가 새 규칙에 없는 날짜면 옮겨 갈 첫 날짜다
  readonly pivotMoveDate: string | null;
}

// 규칙이 바뀌면 이후 회차를 새 날짜에 맞춘다. 맞는 행은 id를 유지해 옮기고(댓글·진행 보존) 맞지 않는 미완료 행은
// 지운다. 기준 회차만은 지우지 않고 첫 날짜로 옮긴다. 완료 행은 맞지 않아도 기록으로 원래 구간에 남는다
export function planOccurrenceRemap(params: {
  readonly rows: readonly OccurrenceSlot[];
  readonly dates: readonly string[];
  readonly pivotTodoId: number;
  readonly sourceSeriesId: string;
}): OccurrenceRemapPlan {
  const { rows, dates, pivotTodoId, sourceSeriesId } = params;
  const dateSet = new Set(dates);
  const keep = pickOccurrencePerDate(
    rows.filter((row) => dateSet.has(row.occurrenceDate)),
    sourceSeriesId,
  );
  const keptTodoIds = new Set(keep.map((row) => row.todoId));
  const deletedTodoIds = new Set(
    rows.filter((row) => !keptTodoIds.has(row.todoId) && !row.completed).map((row) => row.todoId),
  );
  const firstDate = dates.at(0);
  if (!deletedTodoIds.has(pivotTodoId) || firstDate == null) {
    return {
      keep,
      deletedTodoIds: [...deletedTodoIds],
      responseTodoId: pivotTodoId,
      pivotMoveDate: null,
    };
  }
  const occupant = keep.find((row) => row.occurrenceDate === firstDate);
  if (occupant?.completed === true) {
    // 첫 날짜를 이미 완료했으면 기록을 지키고 그 회차를 돌려준다
    return {
      keep,
      deletedTodoIds: [...deletedTodoIds],
      responseTodoId: occupant.todoId,
      pivotMoveDate: null,
    };
  }
  deletedTodoIds.delete(pivotTodoId);
  if (occupant != null) {
    deletedTodoIds.add(occupant.todoId);
  }
  return {
    keep,
    deletedTodoIds: [...deletedTodoIds],
    responseTodoId: pivotTodoId,
    pivotMoveDate: firstDate,
  };
}

// 유니크 인덱스 때문에 합치는 규칙에는 날짜마다 한 행만 들어간다. 완료 기록을 먼저, 그다음 기준 규칙의 행을 지킨다
function pickOccurrencePerDate(
  rows: readonly OccurrenceSlot[],
  sourceSeriesId: string,
): readonly OccurrenceSlot[] {
  const ranked = sortBy(rows, [
    (row) => (row.completed ? 0 : 1),
    (row) => (row.seriesId === sourceSeriesId ? 0 : 1),
  ]);
  return uniqBy(ranked, (row) => row.occurrenceDate);
}
