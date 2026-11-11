import { voiceNoteDigestResponseSchema } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryPlanResultReplay } from "#test/doubles/voice/in-memory-plan-result-replay";
import { StubPlanningContextReader } from "#test/doubles/voice/stub-planning-context.reader";
import { QUOTA_LEDGER_TIME } from "#test/fixtures/access/quota-ledger.fixture";
import { digestDraft, memoActionDraft, todoActionDraft } from "#test/fixtures/voice-plan.fixture";
import { createPlanFlowFixture } from "#test/fixtures/voice/plan-flow.fixture";
import { createAiGenerationError } from "#test/mocks/fake-ai.generator";

import type { VoiceNoteDigestResult } from "../ports/voice-note-digest-result-replay.port.js";
import { DigestVoiceNoteUseCase } from "./digest-voice-note.use-case.js";

const { maxCharacters } = PLAN_CATALOG.VOICE_NOTE.perUse;
const NEXT_MONTH = new Date("2026-06-01T00:00:00.000Z");
const FREE = { role: "USER", subscriptionStatus: "FREE", accessDeadline: null } as const;
const PREMIUM = { role: "USER", subscriptionStatus: "ACTIVE", accessDeadline: NEXT_MONTH } as const;
const ADMIN = { role: "ADMIN", subscriptionStatus: "FREE", accessDeadline: null } as const;

const segments = [
  { startMs: 0, text: "다음 주 일정을 정했습니다.", isBookmarked: false },
  { startMs: 4200, text: "회의록은 제가 보냅니다.", isBookmarked: true },
];

function setup(ledgerInput: Parameters<typeof createPlanFlowFixture>[0] = {}) {
  const fixture = createPlanFlowFixture(ledgerInput);
  const replay = new InMemoryPlanResultReplay<VoiceNoteDigestResult>();
  const useCase = new DigestVoiceNoteUseCase({
    runner: fixture.runner,
    quota: fixture.quota,
    generator: fixture.generator,
    contextReader: new StubPlanningContextReader(),
    localePreferenceReader: fixture.localePreferenceReader,
    replay,
    clock: fixture.clock,
    alert: fixture.alert,
    logger: fixture.logger,
  });
  const execute = (
    overrides: { text?: string; segments?: typeof segments; durationSeconds?: number } = {},
  ) =>
    useCase.execute({
      userId: fixture.userId,
      text: "다음 주 일정을 정했습니다. 회의록은 제가 보냅니다.",
      durationSeconds: 60,
      segments,
      idempotencyKey: "key-1",
      timezone: "Asia/Seoul",
      locale: "ko",
      ...overrides,
    });
  const used = async () =>
    (await fixture.ledger.read(UserId.reconstitute(fixture.userId), "VOICE_NOTE")).used;
  return { ...fixture, replay, execute, used };
}

describe("DigestVoiceNoteUseCase", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(QUOTA_LEDGER_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("녹음 길이 확인(1.15.1은 경보만)", () => {
    const { maxSeconds } = PLAN_CATALOG.VOICE_NOTE.perUse;

    it("등급 상한을 허용 오차보다 넘긴 녹음은 거절하지 않고 운영 경보를 올린다", async () => {
      // Given
      const { aiGenerator, execute, alert } = setup();
      aiGenerator.setRawResponse(digestDraft());
      const durationSeconds = maxSeconds.free + 31;

      // When
      const response = await execute({ durationSeconds });

      // Then
      expect(response.charged).toBe(true);
      expect(alert.alerts).toEqual([
        expect.objectContaining({
          key: "voice.note-digest.duration-over-limit",
          severity: "warning",
          details: { durationSeconds, maxSeconds: maxSeconds.free },
        }),
      ]);
    });

    it("허용 오차 안의 녹음은 경보를 올리지 않는다", async () => {
      // Given
      const { aiGenerator, execute, alert } = setup();
      aiGenerator.setRawResponse(digestDraft());

      // When
      await execute({ durationSeconds: maxSeconds.free + 30 });

      // Then
      expect(alert.alerts).toEqual([]);
    });
  });

  it("핵심 내용의 시각은 AI가 고른 문장 번호로 앱이 보낸 값에서 찾는다", async () => {
    // Given
    const { aiGenerator, execute, used } = setup();
    aiGenerator.setRawResponse(
      digestDraft({
        keyPoints: [
          { text: "회의록", sentenceIndex: 1 },
          { text: "번호 없음", sentenceIndex: null },
          { text: "범위 밖", sentenceIndex: 99 },
        ],
      }),
    );
    // When
    const response = await execute();
    // Then
    const parsed = voiceNoteDigestResponseSchema.parse(response);
    expect(parsed.keyPoints).toEqual([
      { text: "회의록", startMs: 4200 },
      { text: "번호 없음", startMs: null },
      { text: "범위 밖", startMs: null },
    ]);
    expect(parsed.charged).toBe(true);
    expect(await used()).toBe(1);
  });

  it("프롬프트에 시각을 보내지 않아 AI가 시간을 지어낼 수 없다", async () => {
    // Given
    const { aiGenerator, execute } = setup();
    aiGenerator.setRawResponse(digestDraft());
    // When
    await execute();
    // Then
    expect(aiGenerator.getLastPrompt()).not.toContain("4200");
  });

  describe("할 일이 0개인 정리", () => {
    it.each([
      { name: "요약만", draft: { todos: [], keyPoints: [] } },
      { name: "핵심 내용만", draft: { todos: [], summary: "" } },
      { name: "요약과 핵심 내용", draft: { todos: [] } },
    ])("$name 돌려주면 1회를 확정해 charged:true다", async ({ draft }) => {
      // Given
      const { aiGenerator, execute, used, quotaChargeRepository } = setup();
      aiGenerator.setRawResponse(digestDraft(draft));
      // When
      const response = await execute();
      // Then
      expect(response.charged).toBe(true);
      expect(response.featureQuota).toMatchObject({ used: 1 });
      expect(await used()).toBe(1);
      expect([...quotaChargeRepository.all]).toEqual([
        expect.objectContaining({ status: "COMMITTED", refundReason: null }),
      ]);
    });

    it("메모만 있어도 돌려줄 내용이 있으니 1회를 확정한다", async () => {
      // Given
      const { aiGenerator, execute, used } = setup();
      aiGenerator.setRawResponse(
        digestDraft({ summary: "", keyPoints: [], todos: [], memo: memoActionDraft() }),
      );
      // When
      const response = await execute();
      // Then
      expect(response.charged).toBe(true);
      expect(await used()).toBe(1);
    });

    it("같은 키의 재요청은 AI를 다시 부르지 않고 같은 결과와 charged:true를 주며 한 번만 차감한다", async () => {
      // Given
      const { aiGenerator, execute, used } = setup();
      aiGenerator.setRawResponse(digestDraft({ todos: [] }));
      const first = await execute();
      // When
      const second = await execute();
      // Then
      expect(second.summary).toBe(first.summary);
      expect(second.plan).toEqual(first.plan);
      expect([first.charged, second.charged]).toEqual([true, true]);
      expect(second.featureQuota).toMatchObject({ used: 1 });
      expect(aiGenerator.getCallCount()).toBe(1);
      expect(await used()).toBe(1);
    });

    it("기억한 결과를 잃은 재요청은 추가 차감 없이 같은 행에서 다시 만든다", async () => {
      // Given
      const { aiGenerator, execute, replay, used, quotaChargeRepository } = setup();
      aiGenerator.setRawResponse(digestDraft({ todos: [] }));
      await execute();
      replay.results.clear();
      aiGenerator.setRawResponse(digestDraft({ todos: [] }));
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

    it("다시 만든 정리도 이미 차감된 요청이라 charged:true다", async () => {
      // Given
      const { aiGenerator, execute, replay, used } = setup();
      aiGenerator.setRawResponse(digestDraft({ todos: [] }));
      await execute();
      replay.results.clear();
      aiGenerator.setRawResponse(digestDraft({ todos: [] }));
      // When
      const second = await execute();
      // Then
      expect(second.charged).toBe(true);
      expect(await used()).toBe(1);
    });

    it("다시 만들기가 실패하면 환불하고 차감하지 않았다고 답한다", async () => {
      // Given
      const { aiGenerator, execute, replay, used } = setup();
      aiGenerator.setRawResponse(digestDraft({ todos: [] }));
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

    it.each([
      { tier: "FREE", input: FREE, limit: PLAN_CATALOG.VOICE_NOTE.free },
      { tier: "PREMIUM", input: PREMIUM, limit: PLAN_CATALOG.VOICE_NOTE.fairUse.premium },
      { tier: "ADMIN", input: ADMIN, limit: PLAN_CATALOG.VOICE_NOTE.fairUse.premium },
    ])("$tier은 할 일 없는 정리도 사용량에 기록한다", async ({ input, limit }) => {
      // Given
      const { aiGenerator, execute, used } = setup(input);
      aiGenerator.setRawResponse(digestDraft({ todos: [] }));
      // When
      const response = await execute();
      // Then
      expect(response.charged).toBe(true);
      expect(response.featureQuota).toMatchObject({ limit, used: 1 });
      expect(await used()).toBe(1);
    });
  });

  it("빈 결과(AI_1302)로 환불된 키를 다시 보내면 만들어지고 순 차감은 한 번이다", async () => {
    // Given
    const { aiGenerator, execute, used, quotaChargeRepository } = setup();
    aiGenerator.setRawResponse(digestDraft({ title: " ", summary: "", keyPoints: [], todos: [] }));
    await expect(execute()).rejects.toMatchObject({
      errorCode: ErrorCode.AI_1302,
      details: { charged: false },
    });
    aiGenerator.setRawResponse(digestDraft({ todos: [] }));
    // When
    const second = await execute();
    // Then
    expect(second.charged).toBe(true);
    expect(await used()).toBe(1);
    expect([...quotaChargeRepository.all]).toEqual([
      expect.objectContaining({ status: "COMMITTED", attempt: 2 }),
    ]);
  });

  it("같은 키가 계속 빈 결과면 매번 환불되어 차감이 쌓이지 않는다", async () => {
    // Given
    const { aiGenerator, execute, used } = setup();
    // When
    for (const _attempt of [1, 2, 3]) {
      aiGenerator.setRawResponse(
        digestDraft({ title: " ", summary: "", keyPoints: [], todos: [] }),
      );
      await expect(execute()).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1302,
        details: { charged: false },
      });
    }
    // Then
    expect(await used()).toBe(0);
  });

  it("돌려줄 내용이 전혀 없으면 환불하고 AI_1302다", async () => {
    // Given
    const { aiGenerator, execute, used, quotaChargeRepository } = setup();
    aiGenerator.setRawResponse(digestDraft({ title: " ", summary: "", keyPoints: [], todos: [] }));
    // When
    const failure = execute();
    // Then
    await expect(failure).rejects.toMatchObject({
      errorCode: ErrorCode.AI_1302,
      details: { charged: false },
    });
    expect(await used()).toBe(0);
    expect([...quotaChargeRepository.all]).toEqual([
      expect.objectContaining({ status: "REFUNDED", refundReason: "NO_ACTION", attempt: 1 }),
    ]);
  });

  it("돌려줄 내용이 없는데 환불에 실패하면 charged:false를 말하지 않는다", async () => {
    // Given
    const { aiGenerator, execute, quota } = setup();
    aiGenerator.setRawResponse(digestDraft({ title: " ", summary: "", keyPoints: [], todos: [] }));
    quota.refund = async () => false;
    // When
    const failure = execute();
    // Then
    await expect(failure).rejects.toMatchObject({
      errorCode: ErrorCode.AI_1302,
      details: undefined,
    });
  });

  it("AI 실패는 정확히 한 번 환불하고 원장에 사유를 남긴다", async () => {
    // Given
    const { aiGenerator, execute, used, quotaChargeRepository } = setup();
    aiGenerator.setInvalidResponse(createAiGenerationError("TIMEOUT"));
    // When
    const failure = execute();
    // Then
    await expect(failure).rejects.toMatchObject({
      errorCode: ErrorCode.AI_1301,
      details: { charged: false },
    });
    expect(await used()).toBe(0);
    expect([...quotaChargeRepository.all]).toEqual([
      expect.objectContaining({
        meter: "VOICE_NOTE",
        status: "REFUNDED",
        refundReason: "FAILED",
        reason: "voice-note-digest",
      }),
    ]);
  });

  it("같은 키의 재요청은 AI를 다시 부르지 않고 같은 결과를 주며 한 번만 차감한다", async () => {
    // Given
    const { aiGenerator, execute, used } = setup();
    aiGenerator.setRawResponse(digestDraft());
    const first = await execute();
    // When
    const second = await execute();
    // Then
    expect(second.keyPoints).toEqual(first.keyPoints);
    expect(aiGenerator.getCallCount()).toBe(1);
    expect(await used()).toBe(1);
  });

  it("같은 키로 문장이 다르면 AI_1318이다", async () => {
    // Given
    const { aiGenerator, execute } = setup();
    aiGenerator.setRawResponse(digestDraft());
    await execute();
    // When
    const failure = execute({ segments: [] });
    // Then
    await expect(failure).rejects.toMatchObject({ errorCode: ErrorCode.AI_1318 });
  });

  describe("등급별 글자 상한", () => {
    it.each([
      { tier: "FREE", input: FREE, limit: maxCharacters.free },
      { tier: "PREMIUM", input: PREMIUM, limit: maxCharacters.premium },
      { tier: "ADMIN", input: ADMIN, limit: maxCharacters.premium },
    ])("$tier은 $limit자까지 받고 넘으면 차감 전에 AI_1312다", async ({ input, limit }) => {
      // Given
      const { aiGenerator, execute, used } = setup(input);
      aiGenerator.setRawResponse(digestDraft());
      // When
      const accepted = await execute({ text: "가".repeat(limit), segments: [] });
      const rejected = execute({ text: "가".repeat(limit + 1), segments: [] });
      // Then
      expect(accepted.charged).toBe(true);
      await expect(rejected).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1312,
        details: {
          charged: false,
          characterCount: limit + 1,
          maxCharacters: limit,
          featureQuota: expect.objectContaining({ feature: "VOICE_NOTE" }),
        },
      });
      expect(aiGenerator.getCallCount()).toBe(1);
      expect(await used()).toBe(1);
    });

    it("이스케이프로 프롬프트가 길어지는 전사는 입력 상한 전에 AI_1312로 막는다", async () => {
      // Given
      const { aiGenerator, execute, used } = setup(PREMIUM);
      const text = "<".repeat(Math.ceil(maxCharacters.premium / 6) + 1);
      // When
      const rejected = execute({ text, segments: [] });
      // Then
      await expect(rejected).rejects.toMatchObject({ errorCode: ErrorCode.AI_1312 });
      expect(aiGenerator.getCallCount()).toBe(0);
      expect(await used()).toBe(0);
    });
  });

  describe("등급별 횟수 한도", () => {
    it.each([
      { tier: "FREE", input: FREE, count: PLAN_CATALOG.VOICE_NOTE.free, blocked: true },
      { tier: "PREMIUM", input: PREMIUM, count: PLAN_CATALOG.VOICE_NOTE.free, blocked: false },
      {
        tier: "PREMIUM 공정 사용 상한",
        input: PREMIUM,
        count: PLAN_CATALOG.VOICE_NOTE.fairUse.premium,
        blocked: true,
      },
      {
        tier: "ADMIN 공정 사용 상한",
        input: ADMIN,
        count: PLAN_CATALOG.VOICE_NOTE.fairUse.premium,
        blocked: true,
      },
    ])("$tier: $count회 쓴 뒤 막힘=$blocked", async ({ input, count, blocked }) => {
      // Given
      const { aiGenerator, execute, quotaUsageRepository, userId } = setup(input);
      quotaUsageRepository.setUsage({
        userId,
        meter: "VOICE_NOTE",
        periodKey: "2026-M04",
        used: count,
      });
      aiGenerator.setRawResponse(digestDraft());
      // When
      const outcome = execute();
      // Then
      if (blocked) {
        await expect(outcome).rejects.toMatchObject({
          errorCode: ErrorCode.AI_1313,
          details: { charged: false },
        });
        expect(aiGenerator.getCallCount()).toBe(0);
      } else {
        await expect(outcome).resolves.toMatchObject({ charged: true });
      }
    });
  });

  it("로그에 전사와 요약을 남기지 않고 길이와 개수만 남긴다", async () => {
    // Given
    const { aiGenerator, execute, logger } = setup();
    aiGenerator.setRawResponse(
      digestDraft({ summary: "비밀 요약", todos: [todoActionDraft({ title: "비밀 제목" })] }),
    );
    // When
    await execute({ text: "비밀 전사" });
    // Then
    expect(JSON.stringify(logger.messages)).not.toContain("비밀");
    expect(logger.messages).toContainEqual(
      expect.objectContaining({
        event: "voice.note-digest.completed",
        segmentCount: 2,
        durationSeconds: 60,
        todoCount: 1,
      }),
    );
  });
});
