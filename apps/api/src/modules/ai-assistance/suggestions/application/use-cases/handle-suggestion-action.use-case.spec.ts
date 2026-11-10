import { ErrorCode } from "@aido/api/errors";

import { TodoCategoryId } from "#api/modules/planning/categories/planning-categories.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemorySuggestionRepository } from "#test/doubles/ai-assistance/in-memory-suggestion.repository";
import { createSpyApplicationLogger } from "#test/doubles/ai-assistance/spy-application-logger";
import { FakeStagedTodoCreator } from "#test/doubles/planning/fake-staged-todo-creator";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingAfterCommitRegistry } from "#test/doubles/platform/recording-after-commit-registry";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import {
  createSuggestionFixture,
  SUGGESTION_FIXTURE_USER_ID,
} from "#test/fixtures/ai-assistance/suggestion.fixture";
import { createTodoReadModelFixture } from "#test/fixtures/planning/todo-read-model.fixture";
import { StubUserLocalePreferenceReader } from "#test/mocks/ports/ai-parsing.stub";

import type { SuggestionPrimitives } from "../../domain/suggestion.aggregate.js";
import { HandleSuggestionActionUseCase } from "./handle-suggestion-action.use-case.js";

const USER_ID = SUGGESTION_FIXTURE_USER_ID;
const NOW = "2026-03-23T00:00:00.000Z";
const NOT_EXPIRED = Temporal.Instant.from("2030-01-01T00:00:00Z");

function setup(
  options: {
    readonly at?: string;
    readonly entitled?: boolean;
    readonly suggestion?: Partial<SuggestionPrimitives>;
  } = {},
) {
  const repository = new InMemorySuggestionRepository();
  repository.seed(createSuggestionFixture({ expiresAt: NOT_EXPIRED, ...options.suggestion }));
  const todoCreator = new FakeStagedTodoCreator();
  const afterCommit = new RecordingAfterCommitRegistry();
  const localePreferenceReader = new StubUserLocalePreferenceReader();
  const useCase = new HandleSuggestionActionUseCase({
    repository,
    todoCreator,
    entitlementReader: { canInTx: async () => options.entitled ?? true },
    unitOfWork: new ImmediateUnitOfWork(),
    userMutationLock: { lockById: async () => true },
    mutationLock: new RecordingMutationLock(),
    afterCommit,
    localePreferenceReader,
    clock: new FixedClock(Temporal.Instant.from(options.at ?? NOW)),
    logger: createSpyApplicationLogger(),
  });
  return { useCase, repository, todoCreator, afterCommit, localePreferenceReader };
}

describe("HandleSuggestionActionUseCase", () => {
  it("프리미엄이 아니면 제안을 읽지 않고 거절한다", async () => {
    // Given
    const { useCase } = setup({ entitled: false });

    // When
    const result = useCase.execute({
      userId: USER_ID,
      suggestionId: 1,
      action: "dismiss",
      timezone: "Asia/Seoul",
    });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.AI_1309 });
  });

  it("없거나 남의 제안이면 AI_1305다", async () => {
    // Given
    const { useCase } = setup();

    // When
    const result = useCase.execute({
      userId: USER_ID,
      suggestionId: 999,
      action: "accept",
      categoryId: 5,
      timezone: "Asia/Seoul",
    });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.AI_1305,
      details: { suggestionId: 999 },
    });
  });

  it.each([
    { label: "이미 처리된 제안", suggestion: { status: "ACCEPTED" }, errorCode: ErrorCode.AI_1306 },
    {
      label: "만료된 제안",
      suggestion: { expiresAt: Temporal.Instant.from("2020-01-01T00:00:00Z") },
      errorCode: ErrorCode.AI_1307,
    },
  ] as const)("$label은 수락 데이터보다 먼저 $errorCode다", async ({ suggestion, errorCode }) => {
    // Given
    const { useCase, todoCreator } = setup({ suggestion });

    // When
    const result = useCase.execute({
      userId: USER_ID,
      suggestionId: 1,
      action: "accept",
      timezone: "Asia/Seoul",
    });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode });
    expect(todoCreator.inputs).toEqual([]);
  });

  it("거절하면 DISMISSED로 저장하고 할 일을 만들지 않는다", async () => {
    // Given
    const { useCase, repository, todoCreator } = setup();

    // When
    const result = await useCase.execute({
      userId: USER_ID,
      suggestionId: 1,
      action: "dismiss",
      timezone: "Asia/Seoul",
    });

    // Then
    expect(result.createdTodosCount).toBeNull();
    expect(repository.primitivesOf(1)?.status).toBe("DISMISSED");
    expect(repository.primitivesOf(1)?.updatedAt.toString()).toBe("2026-03-23T00:00:00Z");
    expect(todoCreator.inputs).toEqual([]);
  });

  it("수락 때 categoryId가 없으면 SYS_0002이고 상태를 저장하지 않는다", async () => {
    // Given
    const { useCase, repository, todoCreator } = setup();

    // When
    const result = useCase.execute({
      userId: USER_ID,
      suggestionId: 1,
      action: "accept",
      timezone: "Asia/Seoul",
    });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    expect(repository.primitivesOf(1)?.status).toBe("PENDING");
    expect(todoCreator.inputs).toEqual([]);
  });

  it("저장된 요일이 깨졌으면 수락 때 SYS_0002다", async () => {
    // Given
    const { useCase } = setup({ suggestion: { daysOfWeek: null } });

    // When
    const result = useCase.execute({
      userId: USER_ID,
      suggestionId: 1,
      action: "accept",
      categoryId: 5,
      timezone: "Asia/Seoul",
    });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.SYS_0002,
      details: { field: "daysOfWeek" },
    });
  });

  it("수락하면 상태를 저장한 뒤 주간 반복 할 일을 만들고 효과는 커밋 뒤로 미룬다", async () => {
    // Given
    const { useCase, repository, todoCreator, afterCommit } = setup();
    todoCreator.recurringTodos = Array.from({ length: 12 }, (_, index) =>
      createTodoReadModelFixture({ id: index + 1 }),
    );

    // When
    const result = await useCase.execute({
      userId: USER_ID,
      suggestionId: 1,
      action: "accept",
      categoryId: 5,
      timezone: "Asia/Seoul",
    });

    // Then
    expect(repository.writes).toEqual(["save"]);
    expect(todoCreator.inputs).toEqual([
      expect.objectContaining({
        userId: UserId.reconstitute(USER_ID),
        title: "팀 미팅",
        categoryId: TodoCategoryId.reconstitute(5),
        scheduledTime: "10:00",
        timezone: "Asia/Seoul",
        repeat: expect.objectContaining({
          frequency: "WEEKLY",
          interval: 1,
          weekdays: ["MON", "WED", "FRI"],
        }),
      }),
    ]);
    expect(afterCommit.tasks).toHaveLength(1);
    expect(result.suggestion.status).toBe("ACCEPTED");
    expect(result.createdTodosCount).toBe(12);
  });

  describe("반복 시작일은 사용자 현지 오늘이다", () => {
    it.each([
      {
        name: "KST 새벽 수락은 한국 날짜 오늘부터 시작한다",
        at: "2026-10-27T16:30:00.000Z",
        timezone: "Asia/Seoul",
        startDate: "2026-10-28",
        endDate: "2026-11-25",
      },
      {
        name: "미주 저녁 수락은 현지 날짜 오늘부터 시작한다",
        at: "2026-10-28T02:00:00.000Z",
        timezone: "America/Los_Angeles",
        startDate: "2026-10-27",
        endDate: "2026-11-24",
      },
      {
        name: "윤일 직전 현지 자정 직후에도 현지 날짜를 쓴다",
        at: "2028-02-28T15:05:00.000Z",
        timezone: "Asia/Seoul",
        startDate: "2028-02-29",
        endDate: "2028-03-28",
      },
      {
        name: "서울 윤일 직전 23:59:59는 아직 2월 28일이다",
        at: "2028-02-28T14:59:59.000Z",
        timezone: "Asia/Seoul",
        startDate: "2028-02-28",
        endDate: "2028-03-27",
      },
      {
        name: "서울 연초 00:00:00은 새해 1월 1일부터 4주이다",
        at: "2026-12-31T15:00:00.000Z",
        timezone: "Asia/Seoul",
        startDate: "2027-01-01",
        endDate: "2027-01-29",
      },
      {
        name: "LA 연말 23:59:59는 아직 12월 31일이다",
        at: "2027-01-01T07:59:59.000Z",
        timezone: "America/Los_Angeles",
        startDate: "2026-12-31",
        endDate: "2027-01-28",
      },
      {
        name: "LA 봄 전환일 01:30 PST는 3월 12일부터 4주이다",
        at: "2028-03-12T09:30:00.000Z",
        timezone: "America/Los_Angeles",
        startDate: "2028-03-12",
        endDate: "2028-04-09",
      },
      {
        name: "LA 봄 전환일 23:59:59 PDT는 아직 3월 12일이다",
        at: "2028-03-13T06:59:59.000Z",
        timezone: "America/Los_Angeles",
        startDate: "2028-03-12",
        endDate: "2028-04-09",
      },
      {
        name: "LA 봄 전환 다음 날 00:00:00 PDT는 3월 13일이다",
        at: "2028-03-13T07:00:00.000Z",
        timezone: "America/Los_Angeles",
        startDate: "2028-03-13",
        endDate: "2028-04-10",
      },
      {
        name: "LA 가을 전환일 23:59:59 PST는 아직 11월 5일이다",
        at: "2028-11-06T07:59:59.000Z",
        timezone: "America/Los_Angeles",
        startDate: "2028-11-05",
        endDate: "2028-12-03",
      },
      {
        name: "LA 가을 전환 다음 날 00:00:00 PST는 11월 6일이다",
        at: "2028-11-06T08:00:00.000Z",
        timezone: "America/Los_Angeles",
        startDate: "2028-11-06",
        endDate: "2028-12-04",
      },
    ])("$name", async ({ at, timezone, startDate, endDate }) => {
      // Given
      const { useCase, todoCreator, localePreferenceReader } = setup({ at });

      // When
      await useCase.execute({
        userId: USER_ID,
        suggestionId: 1,
        action: "accept",
        categoryId: 5,
        timezone,
      });

      // Then
      expect(todoCreator.inputs).toEqual([
        expect.objectContaining({
          startDate: new Date(`${startDate}T00:00:00.000Z`),
          timezone,
          repeat: expect.objectContaining({ end: { type: "UNTIL", date: endDate } }),
        }),
      ]);
      expect(localePreferenceReader.readCount).toBe(0);
    });

    it("X-Timezone이 없으면 저장된 사용자 시간대로 계산한다", async () => {
      // Given
      const { useCase, todoCreator, localePreferenceReader } = setup({
        at: "2026-10-27T16:30:00.000Z",
      });
      localePreferenceReader.preferences.set(USER_ID, { timezone: "Asia/Seoul", locale: "ko" });

      // When
      await useCase.execute({
        userId: USER_ID,
        suggestionId: 1,
        action: "accept",
        categoryId: 5,
        timezone: undefined,
      });

      // Then
      expect(todoCreator.inputs).toEqual([
        expect.objectContaining({
          startDate: new Date("2026-10-28T00:00:00.000Z"),
          timezone: "Asia/Seoul",
        }),
      ]);
    });
  });
});
