import { loadParseTodoGoldenCases } from "#test/fixtures/ai-golden/golden-cases";
import { createAiQuotaFixture } from "#test/fixtures/ai-quota.fixture";

import { ParseTodo } from "./parse-todo.use-case.js";

const cases = [...loadParseTodoGoldenCases("ko"), ...loadParseTodoGoldenCases("en")];

describe("ParseTodo golden — fake model이 draft를 내면 공개 응답이 기대값과 같다", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("golden은 ko 16건·en 10건이다", () => {
    // Given / When / Then
    expect(cases.filter((golden) => golden.locale === "ko")).toHaveLength(16);
    expect(cases.filter((golden) => golden.locale === "en")).toHaveLength(10);
  });

  it.each(cases)("$id $input", async (golden) => {
    // Given
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(golden.now));
    const fixture = createAiQuotaFixture();
    fixture.aiProvider.setRawResponse(golden.draft);
    const useCase = new ParseTodo(fixture);
    // When
    const result = await useCase.execute({
      userId: fixture.userId,
      text: golden.input,
      timezone: golden.timezone,
      categoryId: undefined,
      locale: golden.locale,
    });
    // Then
    expect(result.data).toEqual(golden.expected);
    expect(result.meta.promptVersion).toBe("parse-todo@v2");
    expect((await fixture.quota.read(fixture.userId)).used).toBe(
      golden.draft.intent === "TASK" ? 1 : 0,
    );
  });
});
