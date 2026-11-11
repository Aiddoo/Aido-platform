import {
  GOLDEN_MEMO_CATEGORY_ID,
  GOLDEN_VARIANTS,
  loadParseMemoGoldenCases,
} from "#test/fixtures/ai-golden/golden-cases";
import { createAiParsingFixture } from "#test/fixtures/ai-parsing.fixture";

import { ParseMemoUseCase } from "./parse-memo.use-case.js";

const cases = GOLDEN_VARIANTS.flatMap((variant) => loadParseMemoGoldenCases(variant));

describe("ParseMemoUseCase golden — fake model이 draft를 내면 공개 응답이 기대값과 같다", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(cases)("$id $input", async (golden) => {
    // Given
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(golden.now));
    const fixture = createAiParsingFixture();
    fixture.generator.setRawResponse(golden.draft);
    const useCase = new ParseMemoUseCase(fixture);
    // When
    const result = await useCase.execute({
      userId: fixture.userId,
      content: golden.input,
      timezone: golden.timezone,
      categoryId: GOLDEN_MEMO_CATEGORY_ID,
      locale: golden.locale,
      idempotencyKey: null,
    });
    // Then
    expect(result.data).toMatchObject(golden.expected);
    expect(result.data.todos).toHaveLength(golden.expected.todos.length);
  });
});
