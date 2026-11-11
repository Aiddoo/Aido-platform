import { ErrorCode } from "@aido/api/errors";
import { ACTION_PLAN_LIMITS, PLAN_CATALOG } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createSpyApplicationLogger } from "#test/doubles/ai-assistance/spy-application-logger";
import { StubAiDataSharingConsentReader } from "#test/doubles/ai-assistance/stub-ai-data-sharing-consent.reader";
import { DateClock } from "#test/doubles/platform/date-clock";
import { digestDraft, memoActionDraft, todoActionDraft } from "#test/fixtures/voice-plan.fixture";
import { createAiGenerationError, FakeAiGenerator } from "#test/mocks/fake-ai.generator";

import {
  PLANNING_CATEGORY_LIMIT,
  PLANNING_UPCOMING_TODO_LIMIT,
} from "../../application/messages/planning-context.constants.js";
import { quickPlanPrompt } from "../../application/messages/quick-plan-prompt.messages.js";
import { voiceNoteDigestPrompt } from "../../application/messages/voice-note-digest-prompt.messages.js";
import { AiActionPlanGeneratorAdapter } from "./ai-action-plan-generator.adapter.js";

const consentReader = new StubAiDataSharingConsentReader();
consentReader.decision = "AGREED";

const planningInput = {
  userId: UserId.reconstitute("user-1"),
  timezone: "Asia/Seoul",
  locale: "ko" as const,
  categories: [{ id: 1, name: "업무" }],
  upcomingTodos: [{ id: 41, title: "치과 예약", startDate: "2027-01-05", isRepeating: false }],
};

const fullCategories = Array.from({ length: PLANNING_CATEGORY_LIMIT }, (_, index) => ({
  id: index + 1,
  name: "카".repeat(50),
}));
const fullUpcomingTodos = Array.from({ length: PLANNING_UPCOMING_TODO_LIMIT }, (_, index) => ({
  id: index + 1,
  title: "할".repeat(200),
  startDate: "2027-01-05",
  isRepeating: false,
}));

function setup() {
  const aiGenerator = new FakeAiGenerator();
  const logger = createSpyApplicationLogger();
  return {
    aiGenerator,
    logger,
    generator: new AiActionPlanGeneratorAdapter({
      generator: aiGenerator,
      consentReader,
      clock: new DateClock(),
      logger,
    }),
  };
}

describe("AiActionPlanGeneratorAdapter", () => {
  it("일정 표현을 날짜·반복으로 계산하고 모르는 카테고리는 null로 바꾼다", async () => {
    // Given
    const { aiGenerator, generator } = setup();
    aiGenerator.setRawResponse({
      todos: [todoActionDraft({ categoryId: 99, repeat: { pattern: "DAILY" } })],
      memo: memoActionDraft(),
    });
    // When
    const { plan, meta } = await generator.generateQuickPlan({
      ...planningInput,
      text: "매일 운동",
    });
    // Then
    expect(plan.todos[0]).toMatchObject({
      categoryId: null,
      startDate: "2027-01-04",
      endDate: null,
      repeat: { frequency: "DAILY", end: { type: "NEVER" } },
    });
    expect(plan.memo).toEqual({ title: "아이디어", content: "온보딩 문구 다듬기" });
    expect(meta.promptVersion).toBe(quickPlanPrompt.version);
  });

  it("사용자·동의 버전을 생성기에 넘긴다", async () => {
    // Given
    const { aiGenerator, generator } = setup();
    aiGenerator.setRawResponse({ todos: [], memo: null });
    // When
    await generator.generateQuickPlan({ ...planningInput, text: "메모" });
    // Then
    expect(aiGenerator.getLastRequest()).toMatchObject({
      userId: "user-1",
      agreedConsentVersion: "2026-11-04",
      task: "quick-plan",
    });
  });

  it.each([
    { kind: "TIMEOUT", errorCode: ErrorCode.AI_1301 },
    { kind: "HALTED", errorCode: ErrorCode.AI_1301 },
    { kind: "UNAVAILABLE", errorCode: ErrorCode.AI_1301 },
    { kind: "RATE_LIMITED", errorCode: ErrorCode.AI_1310 },
    { kind: "USER_SPEND_LIMITED", errorCode: ErrorCode.AI_1310 },
    { kind: "BLOCKED", errorCode: ErrorCode.AI_1302 },
  ] as const)(
    "$kind 실패는 $errorCode이고 호출부가 환불할 실패임을 charged:false로 담는다",
    async ({ kind, errorCode }) => {
      // Given
      const { aiGenerator, generator } = setup();
      aiGenerator.setInvalidResponse(createAiGenerationError(kind));
      // When
      const failure = generator.generateQuickPlan({ ...planningInput, text: "회의" });
      // Then
      await expect(failure).rejects.toMatchObject({ errorCode, details: { charged: false } });
    },
  );

  it("할 일 없는 빠른 계획은 차감하지 않는 결과로 남긴다", async () => {
    // Given
    const { aiGenerator, generator, logger } = setup();
    aiGenerator.setRawResponse({ todos: [], memo: null });
    // When
    await generator.generateQuickPlan({ ...planningInput, text: "회의" });
    // Then
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "NO_ACTION", quotaCharged: false }),
    );
  });

  it("할 일 없는 녹음 정리도 요약이 있으면 차감하는 결과로 남긴다", async () => {
    // Given
    const { aiGenerator, generator, logger } = setup();
    aiGenerator.setRawResponse(digestDraft({ todos: [] }));
    // When
    const digest = await generator.digestVoiceNote({
      ...planningInput,
      transcript: "회의",
      sentences: [],
    });
    // Then
    expect(digest.isEmpty).toBe(false);
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "SUCCESS", quotaCharged: true }),
    );
  });

  it("로그에 말한 내용·제목을 남기지 않는다", async () => {
    // Given
    const { aiGenerator, generator, logger } = setup();
    aiGenerator.setRawResponse({ todos: [todoActionDraft({ title: "비밀 제목" })], memo: null });
    // When
    await generator.generateQuickPlan({ ...planningInput, text: "비밀 내용" });
    // Then
    const logged = JSON.stringify([...logger.log.mock.calls, ...logger.error.mock.calls]);
    expect(logged).not.toContain("비밀");
  });

  describe("입력 상한(maxInputChars)", () => {
    it("빠른 계획은 글자 상한의 입력과 가득 찬 맥락이 입력 상한 안에 든다", () => {
      // Given
      const text = "가".repeat(ACTION_PLAN_LIMITS.QUICK_PLAN_TEXT_MAX_LENGTH);
      // When
      const { prompt } = quickPlanPrompt.build(
        {
          text,
          now: new Date("2027-01-04T03:00:00.000Z"),
          timezone: "Asia/Seoul",
          categories: fullCategories,
          upcomingTodos: fullUpcomingTodos,
        },
        "ko",
      );
      // Then
      expect(prompt.length).toBeLessThanOrEqual(quickPlanPrompt.maxInputChars);
    });

    it("녹음 정리는 프리미엄 글자 상한·문장 600개와 가득 찬 맥락이 입력 상한 안에 든다", () => {
      // Given
      const sentenceCount = ACTION_PLAN_LIMITS.DIGEST_MAX_SEGMENTS;
      const length = Math.floor(
        PLAN_CATALOG.VOICE_NOTE.perUse.maxCharacters.premium / sentenceCount,
      );
      const sentences = Array.from({ length: sentenceCount }, () => ({
        text: "가".repeat(length),
        isBookmarked: true,
      }));
      // When
      const { prompt } = voiceNoteDigestPrompt.build(
        {
          transcript: "",
          sentences,
          now: new Date("2027-01-04T03:00:00.000Z"),
          timezone: "Asia/Seoul",
          categories: fullCategories,
          upcomingTodos: fullUpcomingTodos,
        },
        "ko",
      );
      // Then
      expect(prompt.length).toBeLessThanOrEqual(voiceNoteDigestPrompt.maxInputChars);
    });

    it("이스케이프로 입력 상한을 넘으면 겹침 후보를 빼고 만든다", async () => {
      // Given
      const { aiGenerator, generator } = setup();
      aiGenerator.setRawResponse({ todos: [], memo: null });
      const text = "<".repeat(ACTION_PLAN_LIMITS.QUICK_PLAN_TEXT_MAX_LENGTH);
      // When
      await generator.generateQuickPlan({
        ...planningInput,
        text,
        categories: fullCategories,
        upcomingTodos: fullUpcomingTodos.map((todo) => ({ ...todo, title: "<".repeat(80) })),
      });
      // Then
      const prompt = aiGenerator.getLastPrompt() ?? "";
      expect(prompt.length).toBeLessThanOrEqual(quickPlanPrompt.maxInputChars);
      expect(prompt).toContain('"upcomingTodos": []');
    });
  });
});
