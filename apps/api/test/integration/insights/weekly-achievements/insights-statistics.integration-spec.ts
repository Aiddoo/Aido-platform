import { count } from "drizzle-orm";
import { omit } from "es-toolkit";

import { tallyDailyCompletions } from "#api/modules/insights/daily-completions/domain/daily-completion.domain-service";
import { DateRange } from "#api/modules/insights/daily-completions/domain/date-range.vo";
import { PlanningCompletionGroupReaderAdapter } from "#api/modules/insights/daily-completions/infrastructure/adapters/planning-completion-group-reader.adapter";
import { WeeklyAchievementRepositoryPort } from "#api/modules/insights/weekly-achievements/application/ports/weekly-achievement.repository.port";
import { GetWeeklyAchievementUseCase } from "#api/modules/insights/weekly-achievements/application/use-cases/get-weekly-achievement.use-case";
import { ListWeeklyAchievementYearsUseCase } from "#api/modules/insights/weekly-achievements/application/use-cases/list-weekly-achievement-years.use-case";
import { ListWeeklyAchievementsUseCase } from "#api/modules/insights/weekly-achievements/application/use-cases/list-weekly-achievements.use-case";
import { IsoWeek } from "#api/modules/insights/weekly-achievements/domain/iso-week.vo";
import {
  WeeklyAchievement,
  type WeeklyAchievementPrimitives,
} from "#api/modules/insights/weekly-achievements/domain/weekly-achievement.aggregate";
import { toWeeklyAchievementResponse } from "#api/modules/insights/weekly-achievements/presentation/http/v1/weekly-achievement-response.mapper";
import { DrizzleTodoCompletionGroupReader } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo-completion-group.reader";
import {
  todo,
  todoCategory,
  user as userTable,
  weeklyAchievement,
} from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "#test/e2e/helpers/e2e-app-factory";
import { createUserRowFixture } from "#test/fixtures/identity/user-row.fixture";
import {
  createTodoCategoryRowFixture,
  createTodoRowFixture,
} from "#test/fixtures/planning/todo-row.fixture";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const AT = new Date("2027-01-08T12:00:00Z");
const AT_INSTANT = Temporal.Instant.from("2027-01-08T12:00:00Z");
let statements: string[] | null = null;
describe("Insights 집계·주간 기록 실제 PostgreSQL 회귀", () => {
  let db: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let userId: string;
  let daily: PlanningCompletionGroupReaderAdapter;
  let weekly: WeeklyAchievementRepositoryPort;
  beforeAll(async () => {
    db = new TestDatabase({
      createClient: (url) =>
        createTestClient(url, { max: 4 }, (statement) => {
          if (statements !== null) {
            statements.push(statement);
          }
        }),
    });
    client = await db.start();
    context = await createE2eApp({ testDatabase: db });
    weekly = context.module.get(WeeklyAchievementRepositoryPort);
    daily = new PlanningCompletionGroupReaderAdapter(
      new DrizzleTodoCompletionGroupReader(
        createDatabaseTransactionFixture(client).transactionHost,
      ),
    );
  });
  beforeEach(async () => {
    statements = null;
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    const user = createUserRowFixture();
    await client.insert(userTable).values(user);
    userId = user.id;
  });
  afterEach(() => {
    statements = null;
    vi.useRealTimers();
  });
  afterAll(async () => {
    await destroyE2eApp(context);
  });
  async function measure<T>(name: string, work: () => Promise<T>) {
    statements = [];
    try {
      const result = await work();
      const sql = statements.filter(
        (value) => !/^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|SET)\b/i.test(value),
      );
      return { result, count: sql.length };
    } finally {
      statements = null;
    }
  }
  let nextId = 0;
  function snapshot(
    week: number,
    overrides: Partial<WeeklyAchievementPrimitives> = {},
  ): WeeklyAchievement {
    nextId += 1;
    return WeeklyAchievement.reconstitute({
      id: 1_000_000 + nextId,
      userId,
      year: 2027,
      week,
      totalTodos: 5,
      completedTodos: 3,
      achievedAt: AT_INSTANT,
      ...overrides,
    });
  }
  function findWeek(week: number, year = 2027) {
    return weekly.findByWeek({
      userId: UserId.reconstitute(userId),
      isoWeek: IsoWeek.reconstitute(year, week),
    });
  }
  it("일일집계는 날짜/카테고리 수와 무관하게 두 SQL, 빈 기간은 한 SQL", async () => {
    // Given
    const categories = [];
    for (let index = 0; index < 3; index++) {
      const [row] = await client
        .insert(todoCategory)
        .values(
          omit(
            createTodoCategoryRowFixture({
              userId,
              name: `category ${index}`,
              color: ["#FF0000", "#00FF00", "#0000FF"][index],
              sortOrder: index,
            }),
            ["id"],
          ),
        )
        .returning();
      if (row === undefined) {
        throw new Error("category absent");
      }
      categories.push(row);
    }
    for (let index = 0; index < 9; index++) {
      const category = categories[index % 3];
      if (category === undefined) {
        throw new Error("category absent");
      }
      await client.insert(todo).values(
        omit(
          createTodoRowFixture({
            userId,
            categoryId: category.id,
            startDate: Temporal.PlainDate.from(`2027-01-0${1 + Math.floor(index / 3)}`),
            completed: index % 2 === 0,
            visibility: index === 0 ? "PRIVATE" : "PUBLIC",
            sortOrder: index,
          }),
          ["id"],
        ),
      );
    }
    const range = {
      userId: UserId.reconstitute(userId),
      range: DateRange.create(
        Temporal.PlainDate.from("2027-01-01"),
        Temporal.PlainDate.from("2027-01-03"),
      ),
    };

    // When
    const all = await measure("daily-nine-todos-three-categories", () =>
      daily.listByDateRange(range),
    );
    const visible = await measure("daily-public-only", () => daily.listPublicByDateRange(range));
    const empty = await measure("daily-empty", () =>
      daily.listByDateRange({
        ...range,
        range: DateRange.create(
          Temporal.PlainDate.from("2028-01-01"),
          Temporal.PlainDate.from("2028-01-03"),
        ),
      }),
    );

    // Then
    const allDays = tallyDailyCompletions({ ...range, groups: all.result });
    const visibleDays = tallyDailyCompletions({ ...range, groups: visible.result });
    expect(all.count).toBe(2);
    expect(allDays).toHaveLength(3);
    expect(allDays.reduce((total, day) => total + day.toPrimitives().totalTodos, 0)).toBe(9);
    expect(visible.count).toBe(2);
    expect(visibleDays.reduce((total, day) => total + day.toPrimitives().totalTodos, 0)).toBe(8);
    expect(empty.count).toBe(1);
    expect(empty.result).toEqual([]);
  });
  it("연말·연초에 걸친 할 일은 2026년 53주(2026-12-28~2027-01-03)의 날마다 한 번씩 센다", async () => {
    // Given
    const [category] = await client
      .insert(todoCategory)
      .values(omit(createTodoCategoryRowFixture({ userId, sortOrder: 0 }), ["id"]))
      .returning();
    if (category === undefined) {
      throw new Error("category absent");
    }
    const spans = [
      { startDate: "2026-12-28", endDate: "2027-01-03", completed: true },
      // 앞 주 일요일과 다음 주 월요일은 이 주에 들지 않는다
      { startDate: "2026-12-27", endDate: null, completed: false },
      { startDate: "2027-01-04", endDate: null, completed: false },
    ];
    await client.insert(todo).values(
      spans.map((span, index) =>
        omit(
          createTodoRowFixture({
            userId,
            categoryId: category.id,
            startDate: Temporal.PlainDate.from(span.startDate),
            endDate: span.endDate == null ? null : Temporal.PlainDate.from(span.endDate),
            completed: span.completed,
            sortOrder: index,
          }),
          ["id"],
        ),
      ),
    );
    const week53 = {
      userId: UserId.reconstitute(userId),
      range: DateRange.create(IsoWeek.create(2026, 53).startDate, IsoWeek.create(2026, 53).endDate),
    };

    // When
    const groups = await daily.listByDateRange(week53);

    // Then
    const days = tallyDailyCompletions({ ...week53, groups }).map((day) => day.toPrimitives());
    expect(days.map((day) => [day.date.toString(), day.totalTodos, day.completedTodos])).toEqual([
      ["2026-12-28", 1, 1],
      ["2026-12-29", 1, 1],
      ["2026-12-30", 1, 1],
      ["2026-12-31", 1, 1],
      ["2027-01-01", 1, 1],
      ["2027-01-02", 1, 1],
      ["2027-01-03", 1, 1],
    ]);
  });
  it("새해 주간 목록은 실제 SQL로 지난해 53주까지 읽어 연속 주를 잇고 기록 있는 연도를 최근 해부터 준다", async () => {
    // Given
    await weekly.saveAll([
      snapshot(52, { year: 2026 }),
      snapshot(53, { year: 2026 }),
      snapshot(1, { year: 2027 }),
    ]);
    const list = context.module.get(ListWeeklyAchievementsUseCase);
    const listYears = context.module.get(ListWeeklyAchievementYearsUseCase);

    // When
    const newYear = await list.execute({ userId, year: 2027 });
    const lastYear = await list.execute({ userId, year: 2026 });
    const years = await listYears.execute({ userId });

    // Then
    expect(newYear.summary).toMatchObject({ totalWeeks: 1, currentStreak: 3, bestStreak: 3 });
    expect(lastYear.page.items.map((row) => row.isoWeek.week)).toEqual([53, 52]);
    expect(lastYear.summary).toMatchObject({ totalWeeks: 2, currentStreak: 2, bestStreak: 2 });
    expect(years).toEqual([2027, 2026]);
  });
  it("주간 기록을 원자 저장하고 동일 키 갱신 시 달성 시각을 보존한다", async () => {
    // Given
    const records = [snapshot(1), snapshot(2), snapshot(3)];

    // When
    const insert = await measure("weekly-upsert-three-new", () => weekly.saveAll(records));
    const update = await measure("weekly-upsert-three-existing", () =>
      weekly.saveAll(records.map((row) => snapshot(row.isoWeek.week, { completedTodos: 4 }))),
    );

    // Then
    expect(insert.count).toBe(1);
    expect(update.count).toBe(1);
    expect((await findWeek(2))?.toPrimitives()).toMatchObject({
      id: records[1]?.id.value,
      completedTodos: 4,
      achievedAt: AT_INSTANT,
    });
  });
  it("주간 목록은 summary·저장 시간대와 함께 세 번, 시간대가 캐시된 뒤 cursor가 있으면 기준 행까지 세 번 조회한다", async () => {
    // Given
    await weekly.saveAll([snapshot(1), snapshot(2), snapshot(3)]);
    const useCase = context.module.get(ListWeeklyAchievementsUseCase);

    // When
    const first = await measure("weekly-list-no-cursor", () =>
      useCase.execute({ userId, year: 2027, cursor: undefined, size: 2 }),
    );
    const next = await measure("weekly-list-valid-cursor", () =>
      useCase.execute({ userId, year: 2027, cursor: 2, size: 2 }),
    );

    // Then
    // 라벨의 올해를 정할 저장 시간대는 설정 캐시를 거쳐 처음 한 번만 읽는다
    expect(first.count).toBe(3);
    expect(first.result.page.items.map((row) => row.isoWeek.week)).toEqual([3, 2]);
    expect(first.result.summary.totalWeeks).toBe(3);
    expect(next.count).toBe(3);
    expect(next.result.page.items.map((row) => row.isoWeek.week)).toEqual([1]);
  });
  it("같은 user/year/week 중복입력은 기존순서대로 마지막 값이 이긴다", async () => {
    // Given
    const records = [snapshot(1, { completedTodos: 1 }), snapshot(1, { completedTodos: 4 })];

    // When
    const result = await measure("weekly-duplicate-input", () => weekly.saveAll(records));

    // Then
    expect(result.count).toBe(1);
    expect((await findWeek(1))?.completedTodos).toBe(4);
    expect(await client.select({ count: count() }).from(weeklyAchievement)).toEqual([{ count: 1 }]);
  });
  it("같은 사용자·연도에 존재하는 cursor만 기준으로 주차 내림차순 목록을 읽는다", async () => {
    // Given
    await weekly.saveAll([snapshot(1), snapshot(2), snapshot(3), snapshot(4)]);
    const foreign = createUserRowFixture();
    await client.insert(userTable).values(foreign);
    await weekly.saveAll([snapshot(7, { userId: foreign.id }), snapshot(8, { year: 2026 })]);
    const cases = [
      { name: "valid-anchor", cursor: 4, expected: [3, 2, 1], statements: 2 },
      { name: "no-anchor-input", cursor: undefined, expected: [4, 3, 2], statements: 1 },
      { name: "missing-anchor", cursor: 99, expected: [], statements: 1 },
      { name: "foreign-user-anchor", cursor: 7, expected: [], statements: 1 },
      { name: "other-year-anchor", cursor: 8, expected: [], statements: 1 },
      { name: "first-week-anchor", cursor: 1, expected: [], statements: 2 },
    ];
    for (const item of cases) {
      // When
      const result = await measure("weekly-cursor-" + item.name, () =>
        weekly.listByYear({
          userId: UserId.reconstitute(userId),
          year: 2027,
          afterWeek: item.cursor ?? null,
          limit: 3,
        }),
      );

      // Then
      expect(result.count).toBe(item.statements);
      expect(result.result.map((row) => row.isoWeek.week)).toEqual(item.expected);
      for (const record of result.result) {
        expect(record.isoWeek.year).toBe(2027);
        expect(record.achievedAt.equals(AT_INSTANT)).toBe(true);
      }
    }
  });
  it("실제 주간 상세는 locale로 직렬화하고 없는 기록은 기존 오류로 거부한다", async () => {
    // Given
    await weekly.saveAll([snapshot(1)]);
    const get = context.module.get(GetWeeklyAchievementUseCase);

    // When
    const { achievement: found, localToday } = await get.execute({ userId, year: 2027, week: 1 });
    const ko = toWeeklyAchievementResponse(found, "ko", localToday);
    const en = toWeeklyAchievementResponse(found, "en", localToday);

    // Then
    expect(ko.achievedAt).toBe(AT.toISOString());
    expect(en.achievedAt).toBe(ko.achievedAt);
    expect(ko.weekLabel).not.toBe(en.weekLabel);
    expect(ko.dateRange).toEqual(en.dateRange);
    await expect(get.execute({ userId, year: 2027, week: 52 })).rejects.toMatchObject({
      errorCode: "ACHIEVEMENT_1801",
    });
  });
});
