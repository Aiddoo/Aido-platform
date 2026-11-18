import type {
  TodoActivationReaderPort,
  TodoActivityWindow,
} from "#api/modules/planning/todos/planning-todos-queries.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";

import type {
  GrowthCohortRange,
  GrowthMetricsReaderPort,
} from "../ports/growth-metrics.reader.port.js";
import type {
  GrowthActivityReadModel,
  GrowthCohortSignupReadModel,
} from "../read-models/growth-cohort.read-model.js";
import { GetGrowthSummaryUseCase } from "./get-growth-summary.use-case.js";

const AS_OF = Temporal.Instant.from("2026-07-26T12:34:56Z");
const MEASURED_FROM = Temporal.Instant.from("2026-06-15T00:12:34Z");

function createActivity(overrides: Partial<GrowthActivityReadModel> = {}): GrowthActivityReadModel {
  return { measurementStartedAt: null, totalActiveUsers: 0, dau: 0, wau: 0, mau: 0, ...overrides };
}

function createSignup(
  userId: string,
  overrides: Partial<Omit<GrowthCohortSignupReadModel, "userId">> = {},
): GrowthCohortSignupReadModel {
  return {
    userId: UserId.reconstitute(userId),
    signedUpAt: Temporal.Instant.from("2026-06-20T03:00:00Z"),
    signupLocalDate: Temporal.PlainDate.from("2026-06-20"),
    asOfLocalDate: Temporal.PlainDate.from("2026-07-26"),
    activeOn: { d1: false, d7: false, d30: false },
    ...overrides,
  };
}

// 요청받은 범위를 기록하고 정해 둔 활동 수·가입 cohort를 돌려주는 리더
class StubGrowthMetricsReader implements Pick<
  GrowthMetricsReaderPort,
  "getActivity" | "listCohortSignups"
> {
  readonly requests: (GrowthCohortRange & { readonly asOf?: Temporal.Instant })[] = [];
  readonly #activity: GrowthActivityReadModel;
  readonly #signups: readonly GrowthCohortSignupReadModel[];

  constructor(
    activity: GrowthActivityReadModel,
    signups: readonly GrowthCohortSignupReadModel[] = [],
  ) {
    this.#activity = activity;
    this.#signups = signups;
  }

  async getActivity(range: GrowthCohortRange): Promise<GrowthActivityReadModel> {
    this.requests.push(range);
    return this.#activity;
  }

  async listCohortSignups(
    range: GrowthCohortRange & { readonly asOf: Temporal.Instant },
  ): Promise<GrowthCohortSignupReadModel[]> {
    this.requests.push(range);
    return [...this.#signups];
  }
}

// 활성화 구간 요청을 기록하고 정해 둔 사용자만 활성화로 돌려주는 리더
class StubTodoActivationReader implements Pick<TodoActivationReaderPort, "listActivatedUserIds"> {
  readonly windows: TodoActivityWindow[] = [];
  readonly #activatedUserIds: readonly string[];

  constructor(activatedUserIds: readonly string[] = []) {
    this.#activatedUserIds = activatedUserIds;
  }

  async listActivatedUserIds(windows: readonly TodoActivityWindow[]): Promise<UserId[]> {
    this.windows.push(...windows);
    return windows
      .filter((activityWindow) => this.#activatedUserIds.includes(activityWindow.userId.value))
      .map((activityWindow) => activityWindow.userId);
  }
}

function createUseCase(params: {
  readonly activity: GrowthActivityReadModel;
  readonly signups?: readonly GrowthCohortSignupReadModel[];
  readonly activatedUserIds?: readonly string[];
}) {
  const growthMetricsReader = new StubGrowthMetricsReader(params.activity, params.signups);
  const todoActivationReader = new StubTodoActivationReader(params.activatedUserIds);
  return {
    growthMetricsReader,
    todoActivationReader,
    useCase: new GetGrowthSummaryUseCase({
      growthMetricsReader,
      todoActivationReader,
      snapshot: new ImmediateUnitOfWork(),
      clock: new FixedClock(AS_OF),
    }),
  };
}

describe("GetGrowthSummaryUseCase — 관리자 성장 지표", () => {
  it("범위가 없으면 어제까지 마지막 30개 UTC 날짜를 쓰고 측정 전 리텐션을 null로 둔다", async () => {
    // Given
    const { useCase, growthMetricsReader } = createUseCase({
      activity: createActivity(),
      signups: [createSignup("activated"), createSignup("idle")],
      activatedUserIds: ["activated"],
    });

    // When
    const summary = await useCase.execute({});

    // Then
    expect(growthMetricsReader.requests).toEqual([
      {
        cohortFrom: Temporal.PlainDate.from("2026-06-26"),
        cohortTo: Temporal.PlainDate.from("2026-07-25"),
      },
      {
        cohortFrom: Temporal.PlainDate.from("2026-06-26"),
        cohortTo: Temporal.PlainDate.from("2026-07-25"),
        asOf: AS_OF,
      },
    ]);
    expect(summary).toMatchObject({
      signups: 2,
      activation24h: { eligible: 2, achieved: 1, rate: 50 },
      d1: null,
      d7: null,
      d30: null,
      d7RetainedActivatedUsers: null,
      stickiness: 0,
    });
  });

  it("명시한 cohort 현지 날짜 범위를 그대로 조회하고 응답에 보존한다", async () => {
    // Given
    const { useCase, growthMetricsReader } = createUseCase({ activity: createActivity() });
    const cohortFrom = Temporal.PlainDate.from("2026-05-01");
    const cohortTo = Temporal.PlainDate.from("2026-05-31");

    // When
    const summary = await useCase.execute({ cohortFrom, cohortTo });

    // Then
    expect(growthMetricsReader.requests[0]).toMatchObject({ cohortFrom, cohortTo });
    expect(summary.cohortFrom.equals(cohortFrom)).toBe(true);
    expect(summary.cohortTo.equals(cohortTo)).toBe(true);
  });

  it("가입 뒤 24시간 구간을 planning에 한 번에 묻고 구간이 끝난 사람만 활성화 대상으로 센다", async () => {
    // Given
    const recentSignupAt = AS_OF.subtract({ hours: 23 });
    const { useCase, todoActivationReader } = createUseCase({
      activity: createActivity(),
      signups: [
        createSignup("matured"),
        createSignup("recent", {
          signedUpAt: recentSignupAt,
          signupLocalDate: Temporal.PlainDate.from("2026-07-25"),
        }),
      ],
      activatedUserIds: ["matured", "recent"],
    });

    // When
    const summary = await useCase.execute({});

    // Then
    expect(
      todoActivationReader.windows.map(({ userId, from, until }) => ({
        userId: userId.value,
        from: from.toString(),
        until: until.toString(),
      })),
    ).toEqual([
      { userId: "matured", from: "2026-06-20T03:00:00Z", until: "2026-06-21T03:00:00Z" },
      {
        userId: "recent",
        from: recentSignupAt.toString(),
        until: recentSignupAt.add({ hours: 24 }).toString(),
      },
    ]);
    expect(summary.activation24h).toEqual({ eligible: 1, achieved: 1, rate: 100 });
  });

  it("측정이 시작된 뒤 가입했고 리텐션 날짜가 지난 사람만 대상으로 달성률과 stickiness를 계산한다", async () => {
    // Given
    const { useCase } = createUseCase({
      activity: createActivity({ measurementStartedAt: MEASURED_FROM, dau: 35, mau: 120 }),
      signups: [
        createSignup("retained", { activeOn: { d1: true, d7: true, d30: false } }),
        createSignup("churned"),
        createSignup("before-measurement", {
          signedUpAt: MEASURED_FROM.subtract({ seconds: 1 }),
          signupLocalDate: Temporal.PlainDate.from("2026-06-14"),
          activeOn: { d1: true, d7: true, d30: true },
        }),
        createSignup("d7-today", {
          signupLocalDate: Temporal.PlainDate.from("2026-07-19"),
          signedUpAt: Temporal.Instant.from("2026-07-19T03:00:00Z"),
          activeOn: { d1: true, d7: true, d30: false },
        }),
      ],
      activatedUserIds: ["retained", "d7-today"],
    });

    // When
    const summary = await useCase.execute({});

    // Then
    expect(summary).toMatchObject({
      stickiness: 29.17,
      d1: { eligible: 3, achieved: 2, rate: 66.67 },
      d7: { eligible: 2, achieved: 1, rate: 50 },
      d30: { eligible: 2, achieved: 0, rate: 0 },
      d7RetainedActivatedUsers: 1,
    });
  });
});
