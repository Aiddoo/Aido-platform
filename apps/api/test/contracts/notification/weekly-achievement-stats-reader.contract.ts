import type { WeeklyAchievementStatsReaderPort } from "#api/modules/notification/reminders/application/ports/weekly-achievement-stats-reader.port";

const WEEKLY_STATS_USER_PLANS = ["FREE", "PREMIUM", "ADMIN"] as const;

export interface WeeklyStatsTodoSeed {
  readonly start: string;
  readonly end: string | null;
  readonly completed?: boolean;
}

export interface WeeklyStatsUserSeed {
  readonly timezone: string;
  readonly plan?: (typeof WEEKLY_STATS_USER_PLANS)[number];
  readonly todos?: readonly WeeklyStatsTodoSeed[];
}

export interface WeeklyAchievementStatsReaderContractSubject {
  readonly reader: WeeklyAchievementStatsReaderPort;
  givenUser(seed: WeeklyStatsUserSeed): Promise<string>;
}

const SEOUL = "Asia/Seoul";
const LOS_ANGELES = "America/Los_Angeles";
// 월요일 2026-11-02 ~ 일요일 2026-11-08, 끝은 다음 월요일(배타)
const PERIOD = {
  periodStart: Temporal.PlainDate.from("2026-11-02"),
  periodEnd: Temporal.PlainDate.from("2026-11-09"),
};

// 집계 결과는 순서를 약속하지 않아(GROUP BY) 사용자 ID 순으로 맞춰 비교한다
async function countsFor(reader: WeeklyAchievementStatsReaderPort, timezone: string) {
  const [total, completed] = await Promise.all([
    reader.groupTotalTodosByUser({ timezones: [timezone], ...PERIOD }),
    reader.groupCompletedTodosByUser({ timezones: [timezone], ...PERIOD }),
  ]);
  const byUserId = (rows: readonly { userId: string; count: number }[]) =>
    new Map(
      rows
        .toSorted((left, right) => left.userId.localeCompare(right.userId))
        .map((row) => [row.userId, row.count]),
    );
  return { total: byUserId(total), completed: byUserId(completed) };
}

export function describeWeeklyAchievementStatsReaderContract(
  createSubject: () => Promise<WeeklyAchievementStatsReaderContractSubject>,
): void {
  describe("주간 달성 집계 리더 계약", () => {
    it.each([
      {
        name: "기간 시작 전에 끝난 할 일",
        span: { start: "2026-10-28", end: "2026-10-31" },
        days: 0,
      },
      { name: "시작 직전 일요일 하루짜리", span: { start: "2026-11-01", end: null }, days: 0 },
      {
        name: "기간 전에 시작해 기간 안으로 이어진 할 일",
        span: { start: "2026-10-30", end: "2026-11-03" },
        days: 2,
      },
      {
        name: "기간 마지막 날에 끝나는 할 일",
        span: { start: "2026-11-06", end: "2026-11-08" },
        days: 3,
      },
      {
        name: "기간 뒤까지 이어지는 할 일",
        span: { start: "2026-11-07", end: "2026-11-12" },
        days: 2,
      },
      {
        name: "일요일에서 다음 주 월요일로 넘어가는 할 일",
        span: { start: "2026-11-08", end: "2026-11-09" },
        days: 1,
      },
      {
        name: "다음 주 월요일에 시작하는 할 일",
        span: { start: "2026-11-09", end: null },
        days: 0,
      },
      { name: "종료일이 없는 하루짜리", span: { start: "2026-11-04", end: null }, days: 1 },
      {
        name: "시작일과 종료일이 같은 하루짜리",
        span: { start: "2026-11-05", end: "2026-11-05" },
        days: 1,
      },
      {
        name: "몇 년에 걸친 할 일은 기간 안의 날만",
        span: { start: "2020-01-01", end: "2030-12-31" },
        days: 7,
      },
    ] as const)("$name은 기간 안의 날마다 $days번 센다", async ({ span, days }) => {
      // Given
      const subject = await createSubject();
      const userId = await subject.givenUser({
        timezone: SEOUL,
        todos: [{ ...span, completed: true }],
      });

      // When
      const counts = await countsFor(subject.reader, SEOUL);

      // Then
      expect(counts.total.get(userId) ?? 0).toBe(days);
      expect(counts.completed.get(userId) ?? 0).toBe(days);
    });

    it("한 사용자의 할 일들을 날마다 더하고 완료는 완료한 할 일의 날만 더한다", async () => {
      // Given
      const subject = await createSubject();
      const userId = await subject.givenUser({
        timezone: SEOUL,
        todos: [
          { start: "2026-10-30", end: "2026-11-03", completed: true },
          { start: "2026-11-06", end: "2026-11-08", completed: true },
          { start: "2026-11-07", end: "2026-11-12" },
          { start: "2026-11-04", end: null },
        ],
      });

      // When
      const counts = await countsFor(subject.reader, SEOUL);

      // Then
      expect(counts.total.get(userId)).toBe(2 + 3 + 2 + 1);
      expect(counts.completed.get(userId)).toBe(2 + 3);
    });

    it("서울과 로스앤젤레스 사용자는 각자의 시간대 집계에만 들어가고 같은 날짜 규칙을 쓴다", async () => {
      // Given
      const subject = await createSubject();
      const seoulUserId = await subject.givenUser({
        timezone: SEOUL,
        todos: [{ start: "2026-11-08", end: "2026-11-09" }],
      });
      const laUserId = await subject.givenUser({
        timezone: LOS_ANGELES,
        todos: [{ start: "2026-11-01", end: "2026-11-02", completed: true }],
      });

      // When
      const seoul = await countsFor(subject.reader, SEOUL);
      const losAngeles = await countsFor(subject.reader, LOS_ANGELES);

      // Then
      expect([...seoul.total]).toEqual([[seoulUserId, 1]]);
      expect([...seoul.completed]).toEqual([]);
      expect([...losAngeles.total]).toEqual([[laUserId, 1]]);
      expect([...losAngeles.completed]).toEqual([[laUserId, 1]]);
    });

    it("주간 달성 푸시 대상은 물어본 사용자 중 무료 사용자뿐이다", async () => {
      // Given
      const subject = await createSubject();
      const free = await subject.givenUser({ timezone: SEOUL, plan: "FREE" });
      const premium = await subject.givenUser({ timezone: SEOUL, plan: "PREMIUM" });
      const admin = await subject.givenUser({ timezone: SEOUL, plan: "ADMIN" });
      const otherFree = await subject.givenUser({ timezone: SEOUL, plan: "FREE" });

      // When
      const recipients = await subject.reader.findFreeRecipientIds([free, premium, admin]);
      const none = await subject.reader.findFreeRecipientIds([]);

      // Then
      expect([...recipients]).toEqual([free]);
      expect(recipients.has(otherFree)).toBe(false);
      expect(none.size).toBe(0);
    });
  });
}
