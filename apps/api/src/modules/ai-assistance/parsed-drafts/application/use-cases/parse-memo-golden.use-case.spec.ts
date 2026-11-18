import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { createAiParsingFixture } from "#test/fixtures/ai-assistance/ai-parsing-scenario.fixture";
import {
  GOLDEN_MEMO_CATEGORY_ID,
  GOLDEN_VARIANTS,
  loadParseMemoGoldenCases,
} from "#test/fixtures/ai-golden/golden-cases";

import { ParseMemoUseCase } from "./parse-memo.use-case.js";

const cases = GOLDEN_VARIANTS.flatMap((variant) => loadParseMemoGoldenCases(variant));

describe("ParseMemoUseCase golden — fake model이 draft를 내면 공개 응답이 기대값과 같다", () => {
  it.each(cases)("$id $input", async (golden) => {
    // Given
    const fixture = createAiParsingFixture(
      {},
      { clock: new FixedClock(Temporal.Instant.from(golden.now)) },
    );
    fixture.generator.setRawResponse(golden.draft);
    const useCase = new ParseMemoUseCase(fixture);
    // When
    const result = await useCase.execute({
      userId: fixture.userId,
      content: golden.input,
      timezone: golden.timezone,
      categoryId: GOLDEN_MEMO_CATEGORY_ID,
      requestedLocale: golden.locale,
      idempotencyKey: null,
    });
    // Then
    expect({ todos: [...result.draft.todos] }).toMatchObject(golden.expected);
    expect(result.draft.todos).toHaveLength(golden.expected.todos.length);
  });
});
