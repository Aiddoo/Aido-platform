import { aiSchema, toAiSettings } from "./ai.schema.js";

const AIZA_FORMAT_KEY = `AIza${"a".repeat(35)}`;
const NEW_FORMAT_KEY = `AQ.${"Ab1_-".repeat(10)}`;

describe("aiSchema — GOOGLE_GENERATIVE_AI_API_KEY", () => {
  it("기존 AIza 형식 키를 받는다", () => {
    // Given
    const env = { GOOGLE_GENERATIVE_AI_API_KEY: AIZA_FORMAT_KEY };

    // When
    const config = aiSchema.parse(env);

    // Then
    expect(config.GOOGLE_GENERATIVE_AI_API_KEY).toBe(AIZA_FORMAT_KEY);
  });

  it("새 AQ. 형식 키를 받는다", () => {
    // Given
    const env = { GOOGLE_GENERATIVE_AI_API_KEY: NEW_FORMAT_KEY };

    // When
    const config = aiSchema.parse(env);

    // Then
    expect(NEW_FORMAT_KEY).toHaveLength(53);
    expect(config.GOOGLE_GENERATIVE_AI_API_KEY).toBe(NEW_FORMAT_KEY);
  });

  it.each([
    ["앞뒤 공백", ` ${NEW_FORMAT_KEY} `],
    ["중간 공백", `${AIZA_FORMAT_KEY.slice(0, 20)} ${AIZA_FORMAT_KEY.slice(20)}`],
    ["줄바꿈", `${NEW_FORMAT_KEY}\n`],
  ])("%s이 섞인 키를 거부한다", (_case, key) => {
    // Given
    const env = { GOOGLE_GENERATIVE_AI_API_KEY: key };

    // When
    const result = aiSchema.safeParse(env);

    // Then
    expect(result.success).toBe(false);
  });

  it.each([
    ["허용하지 않는 문자", `AQ.${"a".repeat(40)}/+=`],
    ["30자 미만", "AQ.short-key"],
  ])("%s가 있는 키를 거부한다", (_case, key) => {
    // Given
    const env = { GOOGLE_GENERATIVE_AI_API_KEY: key };

    // When
    const result = aiSchema.safeParse(env);

    // Then
    expect(result.success).toBe(false);
  });

  it.each([
    ["미설정", undefined],
    ["빈 문자열", ""],
  ])("%s 키는 기존처럼 AI 미설정으로 통과시킨다", (_case, key) => {
    // Given
    const env = { GOOGLE_GENERATIVE_AI_API_KEY: key };

    // When
    const config = aiSchema.parse(env);

    // Then
    expect(config.GOOGLE_GENERATIVE_AI_API_KEY).toBe(key);
  });
});

describe("toAiSettings — 업체·작업별 AI 설정", () => {
  it("env가 없으면 Claude→Gemini→OpenAI 순서·기본 모델·작업별 thinking과 제한 시간을 쓴다", () => {
    // When
    const settings = toAiSettings(aiSchema.parse({}));
    // Then
    expect(settings.providerOrder).toEqual(["anthropic", "google", "openai"]);
    expect(settings.providers).toEqual({
      anthropic: { apiKey: null, model: "claude-haiku-5-5" },
      google: { apiKey: null, model: "gemini-3.1-flash-lite" },
      openai: { apiKey: null, model: "gpt-6-luna" },
    });
    expect(settings.tasks).toEqual({
      "parse-todo": { thinking: "minimal", deadlineMs: 12_000 },
      "parse-memo": { thinking: "low", deadlineMs: 25_000 },
      report: { thinking: "low", deadlineMs: 60_000 },
      suggestion: { thinking: "low", deadlineMs: 60_000 },
      "quick-plan": { thinking: "low", deadlineMs: 24_000 },
      "voice-note-digest": { thinking: "low", deadlineMs: 45_000 },
    });
    expect(settings.breaker).toEqual({
      billingCooldownMs: 900_000,
      healthThreshold: 5,
      healthCooldownMs: 30_000,
    });
  });

  it("작업별 env는 그 작업의 thinking·제한 시간만 바꾼다", () => {
    // Given
    const env = {
      AI_THINKING_PARSE_TODO: "low",
      AI_DEADLINE_VOICE_NOTE_DIGEST_MS: "50000",
    };
    // When
    const settings = toAiSettings(aiSchema.parse(env));
    // Then
    expect(settings.tasks["parse-todo"]).toEqual({ thinking: "low", deadlineMs: 12_000 });
    expect(settings.tasks["voice-note-digest"]).toEqual({ thinking: "low", deadlineMs: 50_000 });
    expect(settings.tasks["parse-memo"].thinking).toBe("low");
  });

  it("빈 문자열 키는 미설정이고 순서 env의 공백은 무시한다", () => {
    // Given
    const env = {
      ANTHROPIC_API_KEY: "",
      OPENAI_API_KEY: `sk-proj-${"o".repeat(30)}`,
      AI_PROVIDER_ORDER: " google , openai ",
    };
    // When
    const settings = toAiSettings(aiSchema.parse(env));
    // Then
    expect(settings.providers.anthropic.apiKey).toBeNull();
    expect(settings.providers.openai.apiKey).toBe(env.OPENAI_API_KEY);
    expect(settings.providerOrder).toEqual(["google", "openai"]);
  });

  it.each([
    ["모르는 업체", { AI_PROVIDER_ORDER: "anthropic,mistral" }],
    ["같은 업체 두 번", { AI_PROVIDER_ORDER: "google,google" }],
    ["빈 순서", { AI_PROVIDER_ORDER: "" }],
    ["지원하지 않는 thinking", { AI_THINKING_PARSE_TODO: "high" }],
    ["공백이 섞인 Claude 키", { ANTHROPIC_API_KEY: `sk-ant ${"a".repeat(30)}` }],
    ["0 이하 제한 시간", { AI_DEADLINE_QUICK_PLAN_MS: "0" }],
  ])("%s는 부팅 단계에서 거절한다", (_case, env) => {
    // When
    const result = aiSchema.safeParse(env);
    // Then
    expect(result.success).toBe(false);
  });
});

describe("toAiSettings — 킬 스위치·비용 예산", () => {
  it.each([
    { mode: "on", expected: { interactive: true, background: true } },
    { mode: "interactive-only", expected: { interactive: true, background: false } },
    { mode: "off", expected: { interactive: false, background: false } },
  ])("AI_GENERATION_MODE=$mode이면 분류별 생성 허용이 $expected이다", ({ mode, expected }) => {
    // Given
    const env = aiSchema.parse({ AI_GENERATION_MODE: mode });

    // When
    const settings = toAiSettings(env);

    // Then
    expect(settings.enabled).toEqual(expected);
  });

  it("예산 USD를 micro-USD로 바꾸고 기본값은 경고 1/10·배경 2/20·전체 3/30·사용자 0.25다", () => {
    // Given
    const env = aiSchema.parse({ AI_BUDGET_USER_DAILY_USD: "0.5" });

    // When
    const { budget } = toAiSettings(env);

    // Then
    expect(budget).toEqual({
      alert: { dailyMicroUsd: 1_000_000, monthlyMicroUsd: 10_000_000 },
      background: { dailyMicroUsd: 2_000_000, monthlyMicroUsd: 20_000_000 },
      halt: { dailyMicroUsd: 3_000_000, monthlyMicroUsd: 30_000_000 },
      userDailyMicroUsd: 500_000,
    });
  });

  it("모르는 킬 스위치 값은 거부한다", () => {
    // When
    const result = aiSchema.safeParse({ AI_GENERATION_MODE: "paused" });

    // Then
    expect(result.success).toBe(false);
  });
});
