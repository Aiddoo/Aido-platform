import type { TodoRepeat } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { MEMO_LIMITS, PLAN_CATALOG, TODO_LIMITS } from "@aido/api/vocabulary";
import { eq } from "drizzle-orm";

import { AiGeneratorPort } from "#api/modules/ai-assistance/generation/ai-assistance-generation.public";
import { TodoPlanReaderPort } from "#api/modules/planning/todos/planning-todos.public";
import { ApplyActionPlanUseCase } from "#api/modules/voice/action-plans/application/use-cases/apply-action-plan.use-case";
import { CreateQuickPlanUseCase } from "#api/modules/voice/action-plans/application/use-cases/create-quick-plan.use-case";
import { DigestVoiceNoteUseCase } from "#api/modules/voice/voice-notes/application/use-cases/digest-voice-note.use-case";
import { createEntityId } from "#api/platform/database/entity-id";
import {
  memo as memoTable,
  planApplication,
  quotaCharge,
  quotaUsage,
  todo as todoTable,
  todoCategory,
  todoSeries,
  user as userTable,
} from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { plainDateFromDate } from "#api/shared/domain/time/plain-date";
import { UserFixture } from "#test/fixtures/index";
import { digestDraft, todoActionDraft } from "#test/fixtures/voice-plan.fixture";
import { createAiGenerationError, FakeAiGenerator } from "#test/mocks/fake-ai.generator";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../../../e2e/helpers/e2e-app-factory.js";

const FREE_AI_LIMIT = PLAN_CATALOG.AI_PARSE.free;
const AT = new Date("2027-01-04T03:00:00.000Z");

describe("계획 사용량·멱등 적용 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let aiGenerator: FakeAiGenerator;
  let quickPlan: CreateQuickPlanUseCase;
  let digest: DigestVoiceNoteUseCase;
  let apply: ApplyActionPlanUseCase;
  let todoPlanReader: TodoPlanReaderPort;
  let userId: string;
  let categoryId: number;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 10 }) });
    client = await database.start();
    aiGenerator = new FakeAiGenerator();
    context = await createE2eApp({
      testDatabase: database,
      customizeBuilder: (builder) =>
        builder.overrideProvider(AiGeneratorPort).useValue(aiGenerator),
      additionalResetters: [() => aiGenerator.clear()],
    });
    quickPlan = context.module.get(CreateQuickPlanUseCase);
    digest = context.module.get(DigestVoiceNoteUseCase);
    apply = context.module.get(ApplyActionPlanUseCase);
    todoPlanReader = context.module.get(TodoPlanReaderPort);
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    const user = UserFixture.create({
      id: createEntityId(),
      email: "voice-plan@example.com",
      userTag: "VOICEP01",
      aiUsageCount: 0,
      aiUsageResetAt: instantFromDate(AT),
      subscriptionStatus: "FREE",
      createdAt: instantFromDate(AT),
      updatedAt: instantFromDate(AT),
    });
    await client.insert(userTable).values(user);
    userId = user.id;
    const [category] = await client
      .insert(todoCategory)
      .values({
        userId,
        name: "업무",
        color: "#000000",
        sortOrder: 0,
        updatedAt: instantFromDate(AT),
      })
      .returning({ id: todoCategory.id });
    if (category == null) {
      throw new Error("category insert failed");
    }
    categoryId = category.id;
  });

  afterEach(() => vi.useRealTimers());

  afterAll(async () => {
    if (context) {
      await destroyE2eApp(context);
    } else {
      await database?.stop();
    }
  });

  function runQuickPlan(idempotencyKey: string, text = "내일 회의록 보내기") {
    return quickPlan.execute({
      userId,
      text,
      source: "VOICE",
      idempotencyKey,
      timezone: "Asia/Seoul",
      locale: "ko",
    });
  }

  function todoAction(key = "todo-0", title = "회의록 보내기") {
    return {
      type: "CREATE_TODO" as const,
      key,
      title,
      categoryId,
      startDate: "2027-01-05",
      endDate: null,
      scheduledTime: "09:00",
      repeat: null,
      visibility: null,
      items: [{ title: "슬라이드" }],
    };
  }

  function runApply(
    actions: Parameters<ApplyActionPlanUseCase["execute"]>[0]["actions"],
    key = "apply-1",
  ) {
    return apply.execute({
      userId,
      timezone: "Asia/Seoul",
      source: "QUICK_VOICE",
      sourceMemoId: undefined,
      actions,
      idempotencyKey: key,
    });
  }

  function runApplyFromMemo(
    sourceMemoId: number,
    actions: Parameters<ApplyActionPlanUseCase["execute"]>[0]["actions"],
    targetUserId = userId,
  ) {
    return apply.execute({
      userId: targetUserId,
      timezone: "Asia/Seoul",
      source: "MEMO",
      sourceMemoId,
      actions,
      idempotencyKey: "memo-key",
    });
  }

  async function insertMemo(ownerId: string) {
    const [row] = await client
      .insert(memoTable)
      .values({
        userId: ownerId,
        content: "원본 메모",
        sortOrder: 0,
        updatedAt: Temporal.Instant.fromEpochMilliseconds(AT.getTime()),
      })
      .returning({ id: memoTable.id });
    if (row == null) {
      throw new Error("memo insert failed");
    }
    return row.id;
  }

  async function memoExists(memoId: number) {
    const rows = await client.select().from(memoTable).where(eq(memoTable.id, memoId));
    return rows.length === 1;
  }

  async function usedAiCount() {
    const [row] = await client
      .select({ count: userTable.aiUsageCount })
      .from(userTable)
      .where(eq(userTable.id, userId));
    return row?.count;
  }

  async function userTodos() {
    return client.select().from(todoTable).where(eq(todoTable.userId, userId));
  }

  describe("예약·환불", () => {
    it("남은 횟수보다 많은 요청이 동시에 와도 한도를 넘지 않는다", async () => {
      // Given
      await client
        .update(userTable)
        .set({ aiUsageCount: FREE_AI_LIMIT - 2 })
        .where(eq(userTable.id, userId));
      aiGenerator.setDefaultResponse({});
      for (let index = 0; index < 6; index += 1) {
        aiGenerator.setRawResponse({ todos: [todoActionDraft()], memo: null });
      }
      // When
      const results = await Promise.allSettled(
        Array.from({ length: 6 }, (_, index) => runQuickPlan(`key-${index}`)),
      );
      // Then
      const succeeded = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter((result) => result.status === "rejected");
      expect(succeeded).toHaveLength(2);
      for (const result of rejected) {
        expect(result.reason).toMatchObject({ errorCode: ErrorCode.AI_1303 });
      }
      expect(await usedAiCount()).toBe(FREE_AI_LIMIT);
      expect(aiGenerator.getCallCount()).toBe(2);
    });

    it("같은 키가 동시에 와도 AI를 한 번만 부르고 한 번만 차감한다", async () => {
      // Given
      aiGenerator.setRawResponse({ todos: [todoActionDraft()], memo: null });
      aiGenerator.setDelay(50);
      // When
      const results = await Promise.allSettled(
        Array.from({ length: 4 }, () => runQuickPlan("same-key")),
      );
      // Then
      const rejected = results.filter((result) => result.status === "rejected");
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      for (const result of rejected) {
        expect(result.reason).toMatchObject({ errorCode: ErrorCode.AI_1314 });
      }
      expect(aiGenerator.getCallCount()).toBe(1);
      expect(await usedAiCount()).toBe(1);
    });

    it("AI 실패는 정확히 한 번 환불하고 원장에 사유를 남긴다", async () => {
      // Given
      aiGenerator.setInvalidResponse(createAiGenerationError("TIMEOUT"));
      // When
      const failure = runQuickPlan("key-1");
      // Then
      await expect(failure).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1301,
        details: { charged: false },
      });
      expect(await usedAiCount()).toBe(0);
      const charges = await client.select().from(quotaCharge).where(eq(quotaCharge.userId, userId));
      expect(charges).toEqual([
        expect.objectContaining({
          status: "REFUNDED",
          refundReason: "FAILED",
          reason: "quick-plan",
          attempt: 1,
        }),
      ]);
    });

    function runDigest(idempotencyKey: string) {
      return digest.execute({
        userId,
        text: "오늘 회의는 좋았습니다.",
        durationSeconds: 60,
        segments: [],
        idempotencyKey,
        timezone: "Asia/Seoul",
        locale: "ko",
      });
    }

    async function voiceNoteUsage() {
      const usage = await client.select().from(quotaUsage).where(eq(quotaUsage.userId, userId));
      return usage.map((row) => row.used);
    }

    it("할 일이 0개여도 요약을 돌려준 녹음 정리는 VOICE_NOTE 1회를 확정하고 재요청도 같다", async () => {
      // Given
      aiGenerator.setRawResponse(digestDraft({ todos: [] }));
      // When
      const first = await runDigest("digest-1");
      const second = await runDigest("digest-1");
      // Then
      expect([first.charged, second.charged]).toEqual([true, true]);
      expect(second.summary).toBe(first.summary);
      expect(aiGenerator.getCallCount()).toBe(1);
      expect(await voiceNoteUsage()).toEqual([1]);
      const charges = await client.select().from(quotaCharge).where(eq(quotaCharge.userId, userId));
      expect(charges).toEqual([
        expect.objectContaining({ status: "COMMITTED", attempt: 1, refundReason: null }),
      ]);
    });

    it("돌려줄 내용이 전혀 없는 녹음 정리는 한 번 환불하고 AI_1302다", async () => {
      // Given
      aiGenerator.setRawResponse(digestDraft({ title: "", summary: "", keyPoints: [], todos: [] }));
      // When
      const failure = runDigest("digest-1");
      // Then
      await expect(failure).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1302,
        details: { charged: false },
      });
      expect(await voiceNoteUsage()).toEqual([0]);
      const charges = await client.select().from(quotaCharge).where(eq(quotaCharge.userId, userId));
      expect(charges).toEqual([
        expect.objectContaining({ status: "REFUNDED", refundReason: "NO_ACTION", attempt: 1 }),
      ]);
    });

    it("AI 실패한 녹음 정리는 한 번 환불하고 charged:false다", async () => {
      // Given
      aiGenerator.setInvalidResponse(createAiGenerationError("TIMEOUT"));
      // When
      const failure = runDigest("digest-1");
      // Then
      await expect(failure).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1301,
        details: { charged: false },
      });
      expect(await voiceNoteUsage()).toEqual([0]);
    });

    it("원장에는 말한 내용 없이 지문 해시만 남는다", async () => {
      // Given
      aiGenerator.setRawResponse({ todos: [todoActionDraft()], memo: null });
      // When
      await runQuickPlan("key-1", "비밀스러운 내용");
      // Then
      const [charge] = await client
        .select()
        .from(quotaCharge)
        .where(eq(quotaCharge.userId, userId));
      expect(charge?.requestHash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(charge)).not.toContain("비밀");
    });

    it("같은 키로 내용이 다르면 AI_1318이고 사용량이 그대로다", async () => {
      // Given
      aiGenerator.setRawResponse({ todos: [todoActionDraft()], memo: null });
      await runQuickPlan("key-1");
      // When
      const reused = runQuickPlan("key-1", "다른 내용");
      // Then
      await expect(reused).rejects.toMatchObject({ errorCode: ErrorCode.AI_1318 });
      expect(await usedAiCount()).toBe(1);
    });
  });

  describe("적용", () => {
    it("차감 없이 할 일과 메모를 저장하고 멱등 기록에는 id만 남긴다", async () => {
      // Given
      const memoAction = {
        type: "CREATE_MEMO" as const,
        key: "memo-0",
        title: "제목",
        content: "내용",
      };
      // When
      const result = await runApply([todoAction(), memoAction]);
      // Then
      expect(result.todos[0]).toMatchObject({ title: "회의록 보내기", isAllDay: false });
      expect(result.todos[0]?.items).toHaveLength(1);
      expect(result.memo?.content).toBe("제목\n내용");
      expect(await usedAiCount()).toBe(0);
      expect(aiGenerator.getCallCount()).toBe(0);
      const [record] = await client
        .select()
        .from(planApplication)
        .where(eq(planApplication.userId, userId));
      expect(record?.todoIds).toEqual(result.todos.map((todo) => todo.id));
      expect(record?.memoId).toBe(result.memo?.id);
      expect(JSON.stringify(record)).not.toContain("회의록");
    });

    it("같은 키가 동시에 와도 한 번만 만들고 같은 결과를 돌려준다", async () => {
      // Given
      const actions = [todoAction()];
      // When
      const results = await Promise.all(Array.from({ length: 5 }, () => runApply(actions)));
      // Then
      const todos = await userTodos();
      expect(todos).toHaveLength(1);
      for (const result of results) {
        expect(result.todos.map((todo) => todo.id)).toEqual(todos.map((todo) => todo.id));
      }
    });

    it("같은 키로 고친 내용을 보내면 AI_1318이고 새로 만들지 않는다", async () => {
      // Given
      await runApply([todoAction()]);
      // When
      const reused = runApply([todoAction("todo-0", "고친 제목")]);
      // Then
      await expect(reused).rejects.toMatchObject({ errorCode: ErrorCode.AI_1318 });
      expect(await userTodos()).toHaveLength(1);
    });

    it("재요청 전에 사용자가 지운 할 일은 돌려주지도 다시 만들지도 않는다", async () => {
      // Given
      const first = await runApply([todoAction()]);
      await client.delete(todoTable).where(eq(todoTable.id, first.todos[0]?.id ?? 0));
      // When
      const second = await runApply([todoAction()]);
      // Then
      expect(second.todos).toEqual([]);
      expect(await userTodos()).toHaveLength(0);
    });

    it("메모 개수 상한에 걸리면 앞서 만든 할 일과 멱등 기록까지 모두 되돌린다", async () => {
      // Given
      await client.insert(memoTable).values(
        Array.from({ length: MEMO_LIMITS.MAX_PER_USER }, (_, index) => ({
          userId,
          content: `메모 ${index}`,
          sortOrder: index,
          updatedAt: Temporal.Instant.fromEpochMilliseconds(AT.getTime()),
        })),
      );
      const memoAction = {
        type: "CREATE_MEMO" as const,
        key: "memo-0",
        title: "",
        content: "내용",
      };
      // When
      const failure = runApply([todoAction(), memoAction]);
      // Then
      await expect(failure).rejects.toMatchObject({ errorCode: ErrorCode.MEMO_2003 });
      expect(await userTodos()).toHaveLength(0);
      const records = await client
        .select()
        .from(planApplication)
        .where(eq(planApplication.userId, userId));
      expect(records).toHaveLength(0);
    });

    it.each<{ name: string; repeat: TodoRepeat }>([
      {
        name: "격주",
        repeat: { frequency: "WEEKLY", interval: 2, weekdays: ["TUE"], end: { type: "NEVER" } },
      },
      { name: "매월", repeat: { frequency: "MONTHLY", monthDay: 15, end: { type: "NEVER" } } },
      {
        name: "횟수 종료",
        repeat: { frequency: "DAILY", end: { type: "COUNT", count: 3 } },
      },
    ])("$name 반복은 규칙과 회차를 만들고 응답에는 첫 회차만 담는다", async ({ repeat }) => {
      // Given
      const action = { ...todoAction(), repeat };
      // When
      const result = await runApply([action]);
      // Then
      const [series] = await client.select().from(todoSeries).where(eq(todoSeries.userId, userId));
      const occurrences = await userTodos();
      expect(series).toBeDefined();
      expect(occurrences.length).toBeGreaterThan(0);
      expect(occurrences.every((todo) => todo.seriesId === series?.id)).toBe(true);
      expect(result.todos).toHaveLength(1);
      const replayed = await runApply([action]);
      expect(replayed.todos.map((todo) => todo.id)).toEqual(result.todos.map((todo) => todo.id));
      expect(await userTodos()).toHaveLength(occurrences.length);
    });

    it("다른 사용자의 카테고리는 AI_1315로 거절한다", async () => {
      // Given
      const action = { ...todoAction(), categoryId: categoryId + 1000 };
      // When
      const failure = runApply([action]);
      // Then
      await expect(failure).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1315,
        details: { reason: "CATEGORY_NOT_OWNED", categoryIds: [categoryId + 1000] },
      });
      expect(await userTodos()).toHaveLength(0);
    });
  });

  describe("메모에서 만든 계획", () => {
    it("저장에 성공하면 원본 메모를 지운다", async () => {
      // Given
      const memoId = await insertMemo(userId);
      // When
      const result = await runApplyFromMemo(memoId, [todoAction()]);
      // Then
      expect(result.todos).toHaveLength(1);
      expect(await memoExists(memoId)).toBe(false);
    });

    it("할 일 생성에 실패하면 앞서 만든 할 일을 되돌리고 메모가 남는다", async () => {
      // Given
      const memoId = await insertMemo(userId);
      await client.insert(todoTable).values(
        Array.from({ length: TODO_LIMITS.MAX_PER_CATEGORY - 1 }, (_, index) => ({
          userId,
          categoryId,
          title: `할 일 ${index}`,
          startDate: plainDateFromDate(AT),
          sortOrder: index,
          updatedAt: instantFromDate(AT),
        })),
      );
      // When
      const failure = runApplyFromMemo(memoId, [todoAction("todo-0"), todoAction("todo-1")]);
      // Then
      await expect(failure).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0811 });
      expect(await userTodos()).toHaveLength(TODO_LIMITS.MAX_PER_CATEGORY - 1);
      expect(await memoExists(memoId)).toBe(true);
      const records = await client
        .select()
        .from(planApplication)
        .where(eq(planApplication.userId, userId));
      expect(records).toHaveLength(0);
    });

    it("같은 키의 재요청은 이미 지운 메모 때문에 실패하지 않고 같은 결과를 준다", async () => {
      // Given
      const memoId = await insertMemo(userId);
      const first = await runApplyFromMemo(memoId, [todoAction()]);
      // When
      const second = await runApplyFromMemo(memoId, [todoAction()]);
      // Then
      expect(second.todos.map((todo) => todo.id)).toEqual(first.todos.map((todo) => todo.id));
      expect(await userTodos()).toHaveLength(1);
    });

    it("같은 키가 동시에 와도 메모를 한 번만 지우고 모두 성공한다", async () => {
      // Given
      const memoId = await insertMemo(userId);
      // When
      const results = await Promise.all(
        Array.from({ length: 4 }, () => runApplyFromMemo(memoId, [todoAction()])),
      );
      // Then
      expect(results.map((result) => result.todos.length)).toEqual([1, 1, 1, 1]);
      expect(await userTodos()).toHaveLength(1);
      expect(await memoExists(memoId)).toBe(false);
    });

    it("다른 사용자의 메모는 MEMO_2001로 거절하고 지우지도 만들지도 않는다", async () => {
      // Given
      const other = UserFixture.create({
        id: createEntityId(),
        email: "voice-plan-other@example.com",
        userTag: "VOICEP02",
        createdAt: instantFromDate(AT),
        updatedAt: instantFromDate(AT),
      });
      await client.insert(userTable).values(other);
      const memoId = await insertMemo(other.id);
      // When
      const failure = runApplyFromMemo(memoId, [todoAction()]);
      // Then
      await expect(failure).rejects.toMatchObject({
        errorCode: ErrorCode.MEMO_2001,
        details: { memoId },
      });
      expect(await memoExists(memoId)).toBe(true);
      expect(await userTodos()).toHaveLength(0);
    });
  });

  describe("다가오는 할 일", () => {
    it("지난·완료 할 일을 빼고 반복 할 일은 다음 회차 하나만 날짜순으로 준다", async () => {
      // Given
      const row = (title: string, startDate: string, overrides: Record<string, unknown> = {}) => ({
        userId,
        categoryId,
        title,
        startDate: Temporal.PlainDate.from(startDate),
        updatedAt: instantFromDate(AT),
        ...overrides,
      });
      const seriesId = "11111111-1111-4111-8111-111111111111";
      await client.insert(todoTable).values([
        row("지난 할 일", "2027-01-01"),
        row("완료한 할 일", "2027-01-05", { completed: true }),
        row("나중 할 일", "2027-01-20"),
        row("곧 할 일", "2027-01-05"),
        row("진행 중 기간", "2027-01-01", { endDate: Temporal.PlainDate.from("2027-01-10") }),
        row("운동", "2027-01-08", {
          seriesId,
          occurrenceDate: Temporal.PlainDate.from("2027-01-08"),
        }),
        row("운동", "2027-01-06", {
          seriesId,
          occurrenceDate: Temporal.PlainDate.from("2027-01-06"),
        }),
      ]);
      // When
      const upcoming = await todoPlanReader.findUpcoming(UserId.reconstitute(userId), {
        fromDate: new Date("2027-01-04T00:00:00.000Z"),
        limit: 3,
      });
      // Then
      expect(
        upcoming.map(({ title, startDate, isRepeating }) => [title, startDate, isRepeating]),
      ).toEqual([
        ["진행 중 기간", "2027-01-01", false],
        ["곧 할 일", "2027-01-05", false],
        ["운동", "2027-01-06", true],
      ]);
    });
  });
});
