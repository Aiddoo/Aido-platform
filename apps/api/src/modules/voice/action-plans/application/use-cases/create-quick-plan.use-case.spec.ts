import { quickPlanResponseSchema } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryPlanResultReplay } from "#test/doubles/voice/in-memory-plan-result-replay";
import { StubPlanningContextReader } from "#test/doubles/voice/stub-planning-context.reader";
import { QUOTA_LEDGER_TIME } from "#test/fixtures/access/quota-ledger.fixture";
import { memoActionDraft, todoActionDraft } from "#test/fixtures/voice-plan.fixture";
import { createPlanFlowFixture } from "#test/fixtures/voice/plan-flow.fixture";
import { createAiGenerationError } from "#test/mocks/fake-ai.generator";

import type { QuickPlanResult } from "../ports/plan-result-replay.port.js";
import { CreateQuickPlanUseCase } from "./create-quick-plan.use-case.js";

const FREE_LIMIT = PLAN_CATALOG.AI_PARSE.free;
const FAIR_USE_LIMIT = PLAN_CATALOG.AI_PARSE.fairUse.premium;
const NEXT_MONTH = new Date("2026-06-01T00:00:00.000Z");

function setup(ledgerInput: Parameters<typeof createPlanFlowFixture>[0] = {}) {
  const fixture = createPlanFlowFixture(ledgerInput);
  const replay = new InMemoryPlanResultReplay<QuickPlanResult>();
  const useCase = new CreateQuickPlanUseCase({
    runner: fixture.runner,
    generator: fixture.generator,
    contextReader: new StubPlanningContextReader({
      categories: [{ id: 1, name: "업무" }],
      upcomingTodos: [{ id: 41, title: "치과 예약", startDate: "2027-01-04", isRepeating: false }],
    }),
    localePreferenceReader: fixture.localePreferenceReader,
    replay,
    clock: fixture.clock,
    logger: fixture.logger,
  });
  const execute = (
    overrides: { text?: string; idempotencyKey?: string; signal?: AbortSignal } = {},
  ) =>
    useCase.execute({
      userId: fixture.userId,
      text: "내일 회의록 보내기",
      source: "VOICE",
      idempotencyKey: "key-1",
      timezone: "Asia/Seoul",
      locale: "ko",
      ...overrides,
    });
  const used = async () =>
    (await fixture.ledger.read(UserId.reconstitute(fixture.userId), "AI_PARSE")).used;
  return { ...fixture, replay, execute, used };
}

describe("CreateQuickPlanUseCase", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(QUOTA_LEDGER_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("할 일이 있으면 한 번 차감하고 공유 응답 계약에 맞는 계획과 한도를 준다", async () => {
    // Given
    const { aiGenerator, execute, used } = setup();
    aiGenerator.setRawResponse({ todos: [todoActionDraft()], memo: memoActionDraft() });

    // When
    const response = await execute();

    // Then
    const parsed = quickPlanResponseSchema.parse(response);
    expect(parsed.charged).toBe(true);
    expect(parsed.featureQuota).toMatchObject({ feature: "AI_PARSE", used: 1 });
    expect(parsed.plan.actions.map((action) => action.key)).toEqual(["todo-0", "memo-0"]);
    expect(await used()).toBe(1);
  });

  it("이미 있는 같은 할 일을 겹침으로 표시한다", async () => {
    // Given
    const { aiGenerator, execute } = setup();
    aiGenerator.setRawResponse({ todos: [todoActionDraft({ title: "치과예약" })], memo: null });

    // When
    const { plan } = await execute();

    // Then
    expect(plan.actions[0]).toMatchObject({ duplicateOfTodoId: 41 });
  });

  it.each([
    { name: "행동이 하나도 없으면", memo: null, actionCount: 0 },
    { name: "메모만 있고 할 일이 0개면", memo: memoActionDraft(), actionCount: 1 },
  ])("$name 결과는 주되 환불해 charged:false다", async ({ memo, actionCount }) => {
    // Given
    const { aiGenerator, execute, used } = setup();
    aiGenerator.setRawResponse({ todos: [], memo });

    // When
    const response = await execute();

    // Then
    expect(response.charged).toBe(false);
    expect(response.plan.actions).toHaveLength(actionCount);
    expect(await used()).toBe(0);
  });

  it.each([
    { kind: "TIMEOUT", errorCode: ErrorCode.AI_1301 },
    { kind: "HALTED", errorCode: ErrorCode.AI_1301 },
    { kind: "RATE_LIMITED", errorCode: ErrorCode.AI_1310 },
    { kind: "USER_SPEND_LIMITED", errorCode: ErrorCode.AI_1310 },
    { kind: "INVALID_OUTPUT", errorCode: ErrorCode.AI_1302 },
  ] as const)("$kind 실패는 정확히 한 번 환불하고 charged:false다", async ({ kind, errorCode }) => {
    // Given
    const { aiGenerator, execute, used, quotaChargeRepository } = setup();
    aiGenerator.setInvalidResponse(createAiGenerationError(kind));

    // When
    const failure = execute();

    // Then
    await expect(failure).rejects.toMatchObject({ errorCode, details: { charged: false } });
    expect(await used()).toBe(0);
    expect([...quotaChargeRepository.all]).toEqual([
      expect.objectContaining({ status: "REFUNDED", refundReason: "FAILED", attempt: 1 }),
    ]);
  });

  it("환불에 실패하면 실패 응답에서 charged:false를 주장하지 않는다", async () => {
    // Given
    const { aiGenerator, execute, quota } = setup();
    aiGenerator.setInvalidResponse(createAiGenerationError("TIMEOUT"));
    quota.refund = async () => false;

    // When
    const failure = execute();

    // Then
    await expect(failure).rejects.toMatchObject({
      errorCode: ErrorCode.AI_1301,
      details: undefined,
    });
  });

  it("앱이 연결을 끊어 AI 호출이 멈추면 신호를 넘겼고 예약을 환불한다", async () => {
    // Given
    const { aiGenerator, execute, used, quotaChargeRepository } = setup();
    const controller = new AbortController();
    aiGenerator.setInvalidResponse(createAiGenerationError("TIMEOUT"));

    // When
    const failure = execute({ signal: controller.signal });

    // Then
    await expect(failure).rejects.toMatchObject({
      errorCode: ErrorCode.AI_1301,
      details: { charged: false },
    });
    expect(aiGenerator.getLastRequest()?.signal).toBe(controller.signal);
    expect(await used()).toBe(0);
    expect([...quotaChargeRepository.all]).toEqual([
      expect.objectContaining({ status: "REFUNDED", refundReason: "FAILED" }),
    ]);
  });

  it("할 일 0개인데 환불에 실패하면 charged:true로 답한다", async () => {
    // Given
    const { aiGenerator, execute, quota } = setup();
    aiGenerator.setRawResponse({ todos: [], memo: null });
    quota.refund = async () => false;

    // When
    const response = await execute();

    // Then
    expect(response.charged).toBe(true);
  });

  it("차감한 뒤 한도를 읽지 못해도 결과를 돌려준다", async () => {
    // Given
    const { aiGenerator, execute, quota, logger, used } = setup();
    aiGenerator.setRawResponse({ todos: [todoActionDraft()], memo: null });
    quota.read = async () => {
      throw new Error("db down");
    };

    // When
    const response = await execute();

    // Then
    expect(response.charged).toBe(true);
    expect(response.featureQuota).toBeNull();
    expect(response.plan.actions).toHaveLength(1);
    expect(logger.messages).toContainEqual(
      expect.objectContaining({ event: "ai.generation.quota-read-failed", feature: "AI_PARSE" }),
    );
    quota.read = async () => {
      throw new Error("db down");
    };
    expect(await used()).toBe(1);
  });

  describe("같은 Idempotency-Key", () => {
    it("응답을 받지 못한 재요청은 AI를 다시 부르지 않고 같은 결과를 주며 한 번만 차감한다", async () => {
      // Given
      const { aiGenerator, execute, used } = setup();
      aiGenerator.setRawResponse({ todos: [todoActionDraft()], memo: null });
      const first = await execute();

      // When
      const second = await execute();

      // Then
      expect(second.plan).toEqual(first.plan);
      expect(second.charged).toBe(true);
      expect(aiGenerator.getCallCount()).toBe(1);
      expect(await used()).toBe(1);
    });

    it("기억한 결과를 잃은 재요청은 추가 차감 없이 같은 행에서 다시 만든다", async () => {
      // Given
      const { aiGenerator, execute, replay, used, quotaChargeRepository } = setup();
      aiGenerator.setRawResponse({ todos: [todoActionDraft()], memo: null });
      await execute();
      replay.results.clear();
      aiGenerator.setRawResponse({ todos: [todoActionDraft()], memo: null });

      // When
      const second = await execute();

      // Then
      expect(second.charged).toBe(true);
      expect(aiGenerator.getCallCount()).toBe(2);
      expect(await used()).toBe(1);
      expect([...quotaChargeRepository.all]).toEqual([
        expect.objectContaining({ status: "COMMITTED", attempt: 2 }),
      ]);
    });

    it("다시 만든 결과에 할 일이 없으면 환불하고 charged:false다", async () => {
      // Given
      const { aiGenerator, execute, replay, used } = setup();
      aiGenerator.setRawResponse({ todos: [todoActionDraft()], memo: null });
      await execute();
      replay.results.clear();
      aiGenerator.setRawResponse({ todos: [], memo: memoActionDraft() });

      // When
      const second = await execute();

      // Then
      expect(second.charged).toBe(false);
      expect(await used()).toBe(0);
    });

    it("할 일 0개(NO_ACTION)로 환불된 키를 다시 보내면 만들어지고 순 차감은 한 번이다", async () => {
      // Given
      const { aiGenerator, execute, used } = setup();
      aiGenerator.setRawResponse({ todos: [], memo: memoActionDraft() });
      const first = await execute();
      aiGenerator.setRawResponse({ todos: [todoActionDraft()], memo: null });

      // When
      const second = await execute();

      // Then
      expect(first.charged).toBe(false);
      expect(second.charged).toBe(true);
      expect(await used()).toBe(1);
    });

    it("같은 키가 계속 할 일 0개면 매번 환불되어 차감이 쌓이지 않는다", async () => {
      // Given
      const { aiGenerator, execute, used } = setup();

      // When
      for (const _attempt of [1, 2, 3]) {
        aiGenerator.setRawResponse({ todos: [], memo: null });
        expect((await execute()).charged).toBe(false);
      }

      // Then
      expect(await used()).toBe(0);
    });

    it("환불된 키를 다시 보낼 때 그 사이 한도가 찼으면 차감 없이 AI_1303이다", async () => {
      // Given
      const { aiGenerator, execute, quotaUsageRepository, used, userId } = setup();
      aiGenerator.setRawResponse({ todos: [], memo: null });
      await execute();
      const ledgerUser = quotaUsageRepository.users.get(userId);
      if (ledgerUser != null) {
        ledgerUser.aiUsageCount = FREE_LIMIT;
      }

      // When
      const second = execute();

      // Then
      await expect(second).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1303,
        details: { charged: false },
      });
      expect(await used()).toBe(FREE_LIMIT);
    });

    it("다시 만들기가 실패하면 환불하고 차감하지 않았다고 답한다", async () => {
      // Given
      const { aiGenerator, execute, replay, used } = setup();
      aiGenerator.setRawResponse({ todos: [todoActionDraft()], memo: null });
      await execute();
      replay.results.clear();
      aiGenerator.setInvalidResponse(createAiGenerationError("UPSTREAM"));

      // When
      const failure = execute();

      // Then
      await expect(failure).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1301,
        details: { charged: false },
      });
      expect(await used()).toBe(0);
    });

    it("내용이 다르면 AI_1318로 거절하고 차감하지 않는다", async () => {
      // Given
      const { aiGenerator, execute, used } = setup();
      aiGenerator.setRawResponse({ todos: [todoActionDraft()], memo: null });
      await execute();

      // When
      const failure = execute({ text: "다른 내용" });

      // Then
      await expect(failure).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1318,
        details: { charged: false },
      });
      expect(aiGenerator.getCallCount()).toBe(1);
      expect(await used()).toBe(1);
    });

    it("처리 중이면 AI_1314로 답하고 AI를 한 번만 부른다", async () => {
      // Given
      const { aiGenerator, execute, used } = setup();
      aiGenerator.setRawResponse({ todos: [todoActionDraft()], memo: null });
      aiGenerator.setDelay(300);
      const first = execute();

      // When
      await vi.waitFor(() => expect(aiGenerator.getCallCount()).toBe(1));
      const second = execute();

      // Then
      await expect(second).rejects.toMatchObject({ errorCode: ErrorCode.AI_1314 });
      await first;
      expect(aiGenerator.getCallCount()).toBe(1);
      expect(await used()).toBe(1);
    });

    it("환불한 요청의 재시도는 다시 예약해 순 차감이 한 번이다", async () => {
      // Given
      const { aiGenerator, execute, used, quotaChargeRepository } = setup();
      aiGenerator.setInvalidResponse(createAiGenerationError("TIMEOUT"));
      await execute().catch(() => null);
      aiGenerator.clear();
      aiGenerator.setRawResponse({ todos: [todoActionDraft()], memo: null });

      // When
      const response = await execute();

      // Then
      expect(response.charged).toBe(true);
      expect(await used()).toBe(1);
      expect([...quotaChargeRepository.all]).toEqual([
        expect.objectContaining({ status: "COMMITTED", attempt: 2 }),
      ]);
    });
  });

  describe("등급별 한도", () => {
    it.each([
      {
        tier: "FREE",
        input: { role: "USER", subscriptionStatus: "FREE", accessDeadline: null },
        usedBefore: FREE_LIMIT,
        limit: FREE_LIMIT,
        blocked: true,
      },
      {
        tier: "PREMIUM",
        input: { role: "USER", subscriptionStatus: "ACTIVE", accessDeadline: NEXT_MONTH },
        usedBefore: FAIR_USE_LIMIT - 1,
        limit: FAIR_USE_LIMIT,
        blocked: false,
      },
      {
        tier: "PREMIUM 공정 사용 상한",
        input: { role: "USER", subscriptionStatus: "ACTIVE", accessDeadline: NEXT_MONTH },
        usedBefore: FAIR_USE_LIMIT,
        limit: FAIR_USE_LIMIT,
        blocked: true,
      },
      {
        tier: "ADMIN",
        input: { role: "ADMIN", subscriptionStatus: "FREE", accessDeadline: null },
        usedBefore: FAIR_USE_LIMIT - 1,
        limit: FAIR_USE_LIMIT,
        blocked: false,
      },
      {
        tier: "ADMIN 공정 사용 상한",
        input: { role: "ADMIN", subscriptionStatus: "FREE", accessDeadline: null },
        usedBefore: FAIR_USE_LIMIT,
        limit: FAIR_USE_LIMIT,
        blocked: true,
      },
    ] as const)(
      "$tier: 사용량 $usedBefore에서 막힘=$blocked, 사용량은 등급과 상관없이 기록한다",
      async ({ input, usedBefore, limit, blocked }) => {
        // Given
        const { aiGenerator, execute, used } = setup({ ...input, aiUsageCount: usedBefore });
        aiGenerator.setRawResponse({ todos: [todoActionDraft()], memo: null });

        // When
        const outcome = execute();

        // Then
        if (blocked) {
          await expect(outcome).rejects.toMatchObject({
            errorCode: ErrorCode.AI_1303,
            details: { charged: false, featureQuota: expect.objectContaining({ limit }) },
          });
          expect(aiGenerator.getCallCount()).toBe(0);
          expect(await used()).toBe(usedBefore);
        } else {
          await expect(outcome).resolves.toMatchObject({ featureQuota: { limit } });
          expect(await used()).toBe(usedBefore + 1);
        }
      },
    );
  });

  it("로그에 말한 내용과 제목을 남기지 않는다", async () => {
    // Given
    const { aiGenerator, execute, logger } = setup();
    aiGenerator.setRawResponse({ todos: [todoActionDraft({ title: "비밀 제목" })], memo: null });

    // When
    await execute({ text: "비밀 내용" });

    // Then
    expect(JSON.stringify(logger.messages)).not.toContain("비밀");
    expect(logger.messages).toContainEqual(
      expect.objectContaining({
        event: "voice.quick-plan.completed",
        todoCount: 1,
        duplicateCount: 0,
        quotaCharged: true,
      }),
    );
  });
});
