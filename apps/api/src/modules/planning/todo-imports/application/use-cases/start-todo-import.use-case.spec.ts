import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG } from "@aido/api/vocabulary";

import { ResolveTodoTimezoneUseCase } from "#api/modules/planning/todos/planning-todos.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FakeTodoImportCategories } from "#test/doubles/planning/fake-todo-import-categories";
import { InMemoryTodoImportRepository } from "#test/doubles/planning/in-memory-todo-import.repository";
import { StubTodoOwnerTimezone } from "#test/doubles/planning/stub-todo-owner-timezone";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createEntitlementFixture } from "#test/fixtures/access/entitlement.fixture";
import {
  createTodoImportFixture,
  TODO_IMPORT_FIXTURE_CATEGORY_ID,
  TODO_IMPORT_FIXTURE_COLLECTION_KEY,
  TODO_IMPORT_FIXTURE_NOW,
  TODO_IMPORT_FIXTURE_TODAY,
  TODO_IMPORT_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo-import.fixture";

import { TodoImportLockKeys } from "../todo-imports.lock-keys.js";
import { AssertTodoImportTargetsUseCase } from "./assert-todo-import-targets.use-case.js";
import {
  type StartTodoImportCommand,
  StartTodoImportUseCase,
} from "./start-todo-import.use-case.js";

function setUp(
  options: {
    readonly subscriptionStatus?: string;
    readonly storedTimezone?: string;
    readonly imports?: InMemoryTodoImportRepository;
    readonly now?: Temporal.Instant;
  } = {},
) {
  const clock = new FixedClock(options.now ?? TODO_IMPORT_FIXTURE_NOW);
  const entitlements = createEntitlementFixture(
    { subscriptionStatus: options.subscriptionStatus ?? "FREE" },
    { clock },
  );
  const categories = new FakeTodoImportCategories([
    { id: TODO_IMPORT_FIXTURE_CATEGORY_ID, name: "업무", usage: 10 },
  ]);
  const todoImportRepository = options.imports ?? new InMemoryTodoImportRepository();
  const mutationLock = new RecordingMutationLock();
  const storedTimezones = new Map<string, string>();
  if (options.storedTimezone != null) {
    storedTimezones.set(TODO_IMPORT_FIXTURE_USER_ID, options.storedTimezone);
  }
  const useCase = new StartTodoImportUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock,
    todoImportRepository,
    timezoneResolver: new ResolveTodoTimezoneUseCase({
      ownerTimezone: new StubTodoOwnerTimezone(storedTimezones),
    }),
    entitlementReader: entitlements.reader,
    assertTargets: new AssertTodoImportTargetsUseCase({
      categoryReader: categories.reader,
      categoryCreator: categories.creator,
      entitlementReader: entitlements.reader,
    }),
    clock,
    logger: new SilentLogger(),
  });
  return { useCase, todoImportRepository, mutationLock };
}

function startCommand(overrides: Partial<StartTodoImportCommand> = {}): StartTodoImportCommand {
  return {
    userId: TODO_IMPORT_FIXTURE_USER_ID,
    idempotencyKey: "start-key-1",
    requestedTimezone: "Asia/Seoul",
    source: "DEVICE_CALENDAR",
    startDate: TODO_IMPORT_FIXTURE_TODAY,
    endDate: TODO_IMPORT_FIXTURE_TODAY.add({ days: 29 }),
    timeMode: "TIME",
    visibility: "PRIVATE",
    targets: [
      { kind: "EXISTING_CATEGORY", targetKey: "work", categoryId: TODO_IMPORT_FIXTURE_CATEGORY_ID },
    ],
    collections: [
      {
        collectionKey: TODO_IMPORT_FIXTURE_COLLECTION_KEY,
        targetKey: "work",
        expectedItemCount: 20,
      },
    ],
    ...overrides,
  };
}

describe("StartTodoImportUseCase", () => {
  it("사용자 가져오기 잠금 아래에서 업로드 중 가져오기를 만들고 정한 시간대를 남긴다", async () => {
    // Given
    const { useCase, todoImportRepository, mutationLock } = setUp();

    // When
    const started = await useCase.execute(startCommand());

    // Then
    expect(started).toMatchObject({
      status: "UPLOADING",
      timezone: "Asia/Seoul",
      expectedItemCount: 20,
      receivedItemCount: 0,
      undoableUntil: null,
    });
    expect(todoImportRepository.size).toBe(1);
    expect(mutationLock.acquiredKeys).toEqual([
      [TodoImportLockKeys.userImports(UserId.reconstitute(TODO_IMPORT_FIXTURE_USER_ID))],
    ]);
  });

  it.each([
    {
      label: "헤더 시간대",
      requestedTimezone: "America/Los_Angeles",
      stored: "Asia/Seoul",
      expected: "America/Los_Angeles",
    },
    {
      label: "헤더가 없으면 저장된 시간대",
      requestedTimezone: undefined,
      stored: "Europe/London",
      expected: "Europe/London",
    },
    {
      label: "둘 다 없으면 서울",
      requestedTimezone: undefined,
      stored: undefined,
      expected: "Asia/Seoul",
    },
  ])(
    "오늘을 정하고 가져오기에 남기는 시간대: $label",
    async ({ requestedTimezone, stored, expected }) => {
      // Given
      const { useCase } = setUp({ storedTimezone: stored });

      // When
      // LA는 서울보다 하루 늦어 LA의 30일 안에 드는 기간을 보낸다
      const started = await useCase.execute(
        startCommand({ requestedTimezone, endDate: TODO_IMPORT_FIXTURE_TODAY.add({ days: 28 }) }),
      );

      // Then
      expect(started.timezone).toBe(expected);
    },
  );

  it("서울은 이미 다음 날이어도 LA 시간대 요청은 LA의 오늘부터 시작할 수 있다", async () => {
    // Given
    const seoulNextDay = Temporal.Instant.from("2026-11-24T16:00:00Z");
    const laToday = Temporal.PlainDate.from("2026-11-24");
    const { useCase: seoulUseCase } = setUp({ now: seoulNextDay });
    const { useCase: laUseCase } = setUp({ now: seoulNextDay });

    // When
    const seoul = seoulUseCase.execute(startCommand({ startDate: laToday, endDate: laToday }));
    const la = await laUseCase.execute(
      startCommand({
        requestedTimezone: "America/Los_Angeles",
        startDate: laToday,
        endDate: laToday,
      }),
    );

    // Then
    await expect(seoul).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_IMPORT_2306,
      details: { reason: "START_BEFORE_TODAY" },
    });
    expect(la.startDate.equals(laToday)).toBe(true);
  });

  it("같은 키로 같은 본문을 다시 보내면 처음 가져오기를 주고, 본문이 다르면 2307이다", async () => {
    // Given
    const { useCase, todoImportRepository } = setUp();
    const first = await useCase.execute(startCommand());

    // When
    const replayed = await useCase.execute(startCommand({ requestedTimezone: "Europe/London" }));
    const mismatch = useCase.execute(startCommand({ visibility: "PUBLIC" }));

    // Then
    expect(replayed.id).toBe(first.id);
    expect(replayed.timezone).toBe("Asia/Seoul");
    await expect(mismatch).rejects.toMatchObject({ errorCode: ErrorCode.TODO_IMPORT_2307 });
    expect(todoImportRepository.saveCount).toBe(1);
  });

  it("진행 중 가져오기가 있으면 그 id와 함께 2301이다", async () => {
    // Given
    const running = createTodoImportFixture({ status: "RUNNING", idempotencyKey: "older" });
    const { useCase } = setUp({ imports: new InMemoryTodoImportRepository([running]) });

    // When
    const result = useCase.execute(startCommand());

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_IMPORT_2301,
      details: { importId: running.id.value },
    });
  });

  it("새 카테고리 이름이 카테고리 만들기 규칙을 넘으면 업로드 전에 같은 오류(SYS_0002)로 막는다", async () => {
    // Given
    const { useCase, todoImportRepository } = setUp();
    // 계약(Zod)은 코드 포인트로 세어 이모지 26개를 받지만 카테고리 이름은 UTF-16 단위로 50을 넘는다
    const name = "📅".repeat(26);

    // When
    const result = useCase.execute(
      startCommand({
        targets: [{ kind: "NEW_CATEGORY", targetKey: "work", name, color: "#FF0000" }],
      }),
    );

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.SYS_0002,
      details: { maxLength: 50 },
    });
    expect(todoImportRepository.saveCount).toBe(0);
  });

  it.each([
    { status: "FREE", days: PLAN_CATALOG.CALENDAR_IMPORT.free },
    { status: "ACTIVE", days: PLAN_CATALOG.CALENDAR_IMPORT.premium },
  ])(
    "요금제 $status: $days 일까지 받고 하루 넘으면 차감 없는 기간 한도(2302)다",
    async ({ status, days }) => {
      // Given
      const { useCase } = setUp({ subscriptionStatus: status });
      const lastDay = TODO_IMPORT_FIXTURE_TODAY.add({ days: days - 1 });

      // When
      const within = await useCase.execute(startCommand({ endDate: lastDay }));
      const { useCase: overUseCase } = setUp({ subscriptionStatus: status });
      const over = overUseCase.execute(
        startCommand({ idempotencyKey: "over", endDate: lastDay.add({ days: 1 }) }),
      );

      // Then
      expect(within.status).toBe("UPLOADING");
      await expect(over).rejects.toMatchObject({
        errorCode: ErrorCode.TODO_IMPORT_2302,
        details: {
          charged: false,
          featureQuota: { feature: "CALENDAR_IMPORT", limit: days, used: null },
        },
      });
    },
  );
});
