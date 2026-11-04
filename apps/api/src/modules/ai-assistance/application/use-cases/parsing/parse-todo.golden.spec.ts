import { GOLDEN_VARIANTS, loadParseTodoGoldenCases } from "#test/fixtures/ai-golden/golden-cases";
import { createAiParsingFixture } from "#test/fixtures/ai-parsing.fixture";

import { ParseTodo } from "./parse-todo.use-case.js";

const cases = GOLDEN_VARIANTS.flatMap((variant) => loadParseTodoGoldenCases(variant));

describe("ParseTodo golden — fake model이 draft를 내면 공개 응답이 기대값과 같다", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(cases)("$id $input", async (golden) => {
    // Given
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(golden.now));
    const fixture = createAiParsingFixture();
    fixture.generator.setRawResponse(golden.draft);
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
    expect(result.meta.promptVersion).toBe("parse-todo@5");
    expect((await fixture.quota.read(fixture.userId, "AI_PARSE")).used).toBe(
      golden.draft.intent === "TASK" ? 1 : 0,
    );
  });
});
