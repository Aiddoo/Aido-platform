import { ConfigModule, type ConfigType } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { z } from "zod";

import { defineConfig } from "./define-config.js";

const sampleSchema = z
  .object({
    SAMPLE_URL: z.url("SAMPLE_URL must be a valid URL"),
    SAMPLE_LIMIT: z.coerce.number().int().positive().default(10),
  })
  .transform((env) => ({ url: env.SAMPLE_URL, limit: env.SAMPLE_LIMIT }));

const sampleConfig = defineConfig("sample", sampleSchema, (env) => ({
  SAMPLE_URL: env.SAMPLE_URL,
  SAMPLE_LIMIT: env.SAMPLE_LIMIT,
}));

describe("defineConfig", () => {
  it("env 원문을 schema로 검증해 namespace 값으로 바꾼다", () => {
    // When
    const config = sampleConfig.parse({ SAMPLE_URL: "https://aido.kr", SAMPLE_LIMIT: "3" });

    // Then
    expect(config).toEqual({ url: "https://aido.kr", limit: 3 });
  });

  it("값이 없으면 schema 기본값을 쓴다", () => {
    // When
    const config = sampleConfig.parse({ SAMPLE_URL: "https://aido.kr" });

    // Then
    expect(config.limit).toBe(10);
  });

  it("검증 메시지는 schema가 정한 그대로다", () => {
    // When
    const parse = () => sampleConfig.parse({ SAMPLE_URL: "not-a-url" });

    // Then
    expect(parse).toThrow("SAMPLE_URL must be a valid URL");
  });

  it("ConfigModule에 등록하면 KEY로 process.env 값을 주입받는다", async () => {
    // Given
    vi.stubEnv("SAMPLE_URL", "https://api.aido.kr");
    vi.stubEnv("SAMPLE_LIMIT", "5");
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true, load: [sampleConfig] })],
    }).compile();

    // When
    const config = module.get<ConfigType<typeof sampleConfig>>(sampleConfig.KEY);

    // Then
    expect(config).toEqual({ url: "https://api.aido.kr", limit: 5 });
    await module.close();
  });
});
