import { externalSchema } from "./external.schema.js";

const LEGACY_KEY = `AIza${"a".repeat(35)}`;
const NEW_FORMAT_KEY = `AQ.${"Ab1_-".repeat(10)}`;

describe("externalSchema — GOOGLE_GENERATIVE_AI_API_KEY", () => {
  it("기존 AIza 형식 키를 받는다", () => {
    // Given
    const env = { GOOGLE_GENERATIVE_AI_API_KEY: LEGACY_KEY };

    // When
    const config = externalSchema.parse(env);

    // Then
    expect(config.GOOGLE_GENERATIVE_AI_API_KEY).toBe(LEGACY_KEY);
  });

  it("새 AQ. 형식 키를 받는다", () => {
    // Given
    const env = { GOOGLE_GENERATIVE_AI_API_KEY: NEW_FORMAT_KEY };

    // When
    const config = externalSchema.parse(env);

    // Then
    expect(NEW_FORMAT_KEY).toHaveLength(53);
    expect(config.GOOGLE_GENERATIVE_AI_API_KEY).toBe(NEW_FORMAT_KEY);
  });

  it.each([
    ["앞뒤 공백", ` ${NEW_FORMAT_KEY} `],
    ["중간 공백", `${LEGACY_KEY.slice(0, 20)} ${LEGACY_KEY.slice(20)}`],
    ["줄바꿈", `${NEW_FORMAT_KEY}\n`],
  ])("%s이 섞인 키를 거부한다", (_case, key) => {
    // Given
    const env = { GOOGLE_GENERATIVE_AI_API_KEY: key };

    // When
    const result = externalSchema.safeParse(env);

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
    const result = externalSchema.safeParse(env);

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
    const config = externalSchema.parse(env);

    // Then
    expect(config.GOOGLE_GENERATIVE_AI_API_KEY).toBe(key);
  });
});
