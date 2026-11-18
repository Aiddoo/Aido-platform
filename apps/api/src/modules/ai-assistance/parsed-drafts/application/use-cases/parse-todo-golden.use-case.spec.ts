import { omit } from "es-toolkit";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createAiParsingFixture } from "#test/fixtures/ai-assistance/ai-parsing-scenario.fixture";
import { GOLDEN_VARIANTS, loadParseTodoGoldenCases } from "#test/fixtures/ai-golden/golden-cases";

import { ParseTodoUseCase } from "./parse-todo.use-case.js";

const cases = GOLDEN_VARIANTS.flatMap((variant) => loadParseTodoGoldenCases(variant));

describe("ParseTodoUseCase golden — fake model이 draft를 내면 공개 응답이 기대값과 같다", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(cases)("$id $input", async (golden) => {
    // Given
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(golden.now));
    const fixture = createAiParsingFixture();
    fixture.generator.setRawResponse(golden.draft);
    const useCase = new ParseTodoUseCase(fixture);
    // When
    const result = await useCase.execute({
      userId: fixture.userId,
      text: golden.input,
      timezone: golden.timezone,
      categoryId: undefined,
      requestedLocale: golden.locale,
    });
    // Then
    // 출시 앱 필드가 그대로인지 본다. repeat는 resolve-todo-schedule.spec에서 따로 검증한다.
    expect(omit(result.draft.todos[0], ["repeat"])).toEqual(golden.expected);
    expect(result.meta.promptVersion).toBe("parse-todo@10");
    expect((await fixture.quota.read(UserId.reconstitute(fixture.userId), "AI_PARSE")).used).toBe(
      golden.draft.intent === "TASK" ? 1 : 0,
    );
  });
});
