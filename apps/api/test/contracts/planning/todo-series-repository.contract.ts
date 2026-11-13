import type { TodoSeriesRepositoryPort } from "#api/modules/planning/todo-series/application/ports/todo-series.repository.port";
import { TodoSeriesId } from "#api/modules/planning/todo-series/domain/todo-series-id.vo";
import type {
  TodoSeries,
  TodoSeriesPrimitives,
} from "#api/modules/planning/todo-series/domain/todo-series.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createTodoSeriesFixture } from "#test/fixtures/planning/todo-series.fixture";
import {
  TODO_FIXTURE_OTHER_USER_ID,
  TODO_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo.fixture";

export interface TodoSeriesRepositoryContractContext {
  readonly seriesRepository: TodoSeriesRepositoryPort;
  readonly categoryId: number;
}

// id 순 정렬을 확인하려고 접두사로 순서를 정한다
const SERIES_IDS = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
] as const;

// updatedAt은 저장소 칸의 $onUpdate가 쓰므로 비교에서 뺀다
function withoutUpdatedAt(
  series: TodoSeries | null,
): Omit<TodoSeriesPrimitives, "updatedAt"> | null {
  if (series == null) {
    return null;
  }
  const { updatedAt: _updatedAt, ...rest } = series.toPrimitives();
  return rest;
}

async function insertSeries(
  context: TodoSeriesRepositoryContractContext,
  overrides: Partial<TodoSeriesPrimitives> = {},
): Promise<TodoSeries> {
  const series = createTodoSeriesFixture({ categoryId: context.categoryId, ...overrides });
  await context.seriesRepository.insert(series);
  return series;
}

export function describeTodoSeriesRepositoryContract(
  createContext: () => Promise<TodoSeriesRepositoryContractContext>,
): void {
  describe("반복 규칙 저장소 계약", () => {
    it("넣은 규칙은 주인에게만 보이고 규칙·커서·체크리스트를 같은 값으로 복원한다", async () => {
      // Given
      const context = await createContext();
      const series = await insertSeries(context, {
        id: SERIES_IDS[0],
        originSeriesId: SERIES_IDS[0],
        scheduledLocalTime: "09:00",
        timezone: "America/New_York",
        rule: {
          frequency: "WEEKLY",
          interval: 2,
          weekdays: ["MON", "THU"],
          monthDay: null,
          end: { type: "UNTIL", date: "2027-03-31" },
        },
        checklistTemplate: [{ title: "물병 채우기" }],
        nextOccurrenceDate: "2026-11-12",
        generatedCount: 3,
      });

      // When
      const found = await context.seriesRepository.findByIdAndUserId(
        series.id,
        UserId.reconstitute(TODO_FIXTURE_USER_ID),
      );
      const foreign = await context.seriesRepository.findByIdAndUserId(
        series.id,
        UserId.reconstitute(TODO_FIXTURE_OTHER_USER_ID),
      );

      // Then
      expect(withoutUpdatedAt(found)).toEqual(withoutUpdatedAt(series));
      expect(foreign).toBeNull();
    });

    it("고친 규칙을 저장하면 잠가 읽어도 바뀐 값이다", async () => {
      // Given
      const context = await createContext();
      const series = await insertSeries(context, { id: SERIES_IDS[0] });
      series.applyDetails({ title: "물 두 잔", visibility: "PRIVATE" });
      series.stopAfter("2026-11-20");

      // When
      await context.seriesRepository.update(series);
      const locked = await context.seriesRepository.lockForUpdate(series.id);

      // Then
      expect(withoutUpdatedAt(locked)).toEqual(withoutUpdatedAt(series));
    });

    it("진행 중 규칙만 세고 다음 회차가 through 이하인 규칙을 id 순으로 이어 준다", async () => {
      // Given
      const context = await createContext();
      for (const [index, id] of SERIES_IDS.entries()) {
        await insertSeries(context, {
          id,
          originSeriesId: id,
          nextOccurrenceDate: `2026-11-1${index}`,
        });
      }
      await insertSeries(context, {
        id: "00000000-0000-4000-8000-000000000009",
        originSeriesId: "00000000-0000-4000-8000-000000000009",
        nextOccurrenceDate: null,
      });

      // When
      const active = await context.seriesRepository.countActiveByUserId(
        UserId.reconstitute(TODO_FIXTURE_USER_ID),
      );
      const firstBatch = await context.seriesRepository.findDueBatch({
        through: "2026-11-11",
        afterId: null,
        limit: 1,
      });
      const nextBatch = await context.seriesRepository.findDueBatch({
        through: "2026-11-11",
        afterId: firstBatch.map(({ id }) => TodoSeriesId.reconstitute(id)).at(-1) ?? null,
        limit: 5,
      });
      const behind = await context.seriesRepository.findIdsBehind(
        UserId.reconstitute(TODO_FIXTURE_USER_ID),
        "2026-11-10",
      );

      // Then
      expect(active).toBe(3);
      expect(firstBatch).toEqual([{ id: SERIES_IDS[0], userId: TODO_FIXTURE_USER_ID }]);
      expect(nextBatch).toEqual([{ id: SERIES_IDS[1], userId: TODO_FIXTURE_USER_ID }]);
      expect(behind).toEqual([SERIES_IDS[0]]);
    });

    it("진행 중 반복은 다음 회차가 남은 자기 규칙만 있다고 답한다", async () => {
      // Given
      const context = await createContext();
      const owner = UserId.reconstitute(TODO_FIXTURE_USER_ID);
      await insertSeries(context, {
        id: SERIES_IDS[0],
        originSeriesId: SERIES_IDS[0],
        nextOccurrenceDate: null,
      });
      await insertSeries(context, {
        id: SERIES_IDS[1],
        originSeriesId: SERIES_IDS[1],
        userId: TODO_FIXTURE_OTHER_USER_ID,
      });
      const onlyEnded = await context.seriesRepository.existsActiveByUserId(owner);

      // When
      await insertSeries(context, { id: SERIES_IDS[2], originSeriesId: SERIES_IDS[2] });
      const withActive = await context.seriesRepository.existsActiveByUserId(owner);

      // Then
      expect(onlyEnded).toBe(false);
      expect(withActive).toBe(true);
    });

    it("같은 원본으로 나뉜 구간을 묶고 뒤 구간만 따로 잠근다", async () => {
      // Given
      const context = await createContext();
      const [origin, middle, last] = SERIES_IDS;
      const source = await insertSeries(context, {
        id: origin,
        originSeriesId: origin,
        startDate: "2026-11-01",
      });
      await insertSeries(context, { id: middle, originSeriesId: origin, startDate: "2026-11-10" });
      await insertSeries(context, { id: last, originSeriesId: origin, startDate: "2026-11-20" });

      // When
      const family = await context.seriesRepository.lockFamilyIds(
        UserId.reconstitute(TODO_FIXTURE_USER_ID),
        TodoSeriesId.reconstitute(origin),
      );
      const following = await context.seriesRepository.lockFollowingSegments(source);

      // Then
      expect(family.map((id) => id.value)).toEqual([origin, middle, last]);
      expect(following.map((segment) => segment.id.value)).toEqual([middle, last]);
    });

    it("시간대 바꾸기는 다른 시간대 규칙만 세고, 지운 규칙은 다시 찾을 수 없다", async () => {
      // Given
      const context = await createContext();
      await insertSeries(context, { id: SERIES_IDS[0], originSeriesId: SERIES_IDS[0] });
      await insertSeries(context, {
        id: SERIES_IDS[1],
        originSeriesId: SERIES_IDS[1],
        timezone: "America/New_York",
      });

      // When
      const changed = await context.seriesRepository.updateTimezoneByUserId(
        UserId.reconstitute(TODO_FIXTURE_USER_ID),
        "America/New_York",
      );
      await context.seriesRepository.deleteMany([TodoSeriesId.reconstitute(SERIES_IDS[1])]);

      // Then
      const kept = await context.seriesRepository.findByIdAndUserId(
        TodoSeriesId.reconstitute(SERIES_IDS[0]),
        UserId.reconstitute(TODO_FIXTURE_USER_ID),
      );
      expect(changed).toBe(1);
      expect(kept?.timezone).toBe("America/New_York");
      expect(
        await context.seriesRepository.findByIdAndUserId(
          TodoSeriesId.reconstitute(SERIES_IDS[1]),
          UserId.reconstitute(TODO_FIXTURE_USER_ID),
        ),
      ).toBeNull();
    });
  });
}
