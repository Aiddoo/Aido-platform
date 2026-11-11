import * as Sentry from "@sentry/nestjs";
import { generateText } from "ai";
import { MockLanguageModelV4 } from "ai/test";

import { sentryIntegrations, toSentryRelease } from "./sentry-options.js";

const USER_TEXT = "내일 오후 3시 병원 예약";
const SYSTEM_TEXT = "너는 할 일 파서다";
const MODEL_TEXT = '{"title":"병원 예약"}';
const CONTENT_ATTRIBUTES = [
  "gen_ai.input.messages",
  "gen_ai.output.messages",
  "gen_ai.system_instructions",
];

describe("Sentry AI span", () => {
  afterEach(async () => {
    await Sentry.close();
  });

  it("AI 호출 span에는 모델·토큰만 남고 입력·지시·응답 문장은 없다", async () => {
    // Given - 운영과 같은 기본 integration 위에 우리 integration 목록을 얹고, 보내는 대신 모은다
    const aiSpanKeys: string[][] = [];
    let payload = "";
    Sentry.init({
      dsn: "https://public@o0.ingest.sentry.io/0",
      tracesSampleRate: 1,
      integrations: sentryIntegrations(),
      transport: () => ({ send: async () => ({}), flush: async () => true }),
      beforeSendSpan(span) {
        const keys = Object.keys(span.attributes);
        if (keys.some((key) => key.startsWith("gen_ai."))) {
          aiSpanKeys.push(keys);
        }
        payload += JSON.stringify(span);
        return span;
      },
    });
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text", text: MODEL_TEXT }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 5, text: 5, reasoning: 0 },
        },
        warnings: [],
      }),
    });

    // When
    await Sentry.startSpan({ name: "ai-span-test" }, () =>
      generateText({ model, instructions: SYSTEM_TEXT, prompt: USER_TEXT }),
    );
    await Sentry.flush(2000);

    // Then - AI span이 실제로 생겼는지 먼저 확인해 빈 통과를 막는다
    expect(aiSpanKeys.length).toBeGreaterThan(0);
    expect(aiSpanKeys.flat()).toEqual(expect.arrayContaining(["gen_ai.usage.input_tokens"]));
    expect(aiSpanKeys.flat().filter((key) => CONTENT_ATTRIBUTES.includes(key))).toEqual([]);
    expect(payload).not.toContain(USER_TEXT);
    expect(payload).not.toContain(SYSTEM_TEXT);
    expect(payload).not.toContain("병원 예약");
  });
});

describe("toSentryRelease", () => {
  it("package.json 버전으로 슬래시 없는 릴리스 이름을 만든다", () => {
    // When
    const release = toSentryRelease({ name: "@aido/server", version: "1.15.1" });

    // Then
    expect(release).toBe("aido-server@1.15.1");
  });

  it("버전을 읽을 수 없으면 릴리스를 붙이지 않는다", () => {
    // When
    const release = toSentryRelease({ name: "@aido/server" });

    // Then
    expect(release).toBeUndefined();
  });
});
