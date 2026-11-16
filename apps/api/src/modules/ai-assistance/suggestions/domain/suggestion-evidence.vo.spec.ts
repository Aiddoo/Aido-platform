import { ErrorCode } from "@aido/api/errors";

import { SuggestionEvidence } from "./suggestion-evidence.vo.js";

describe("SuggestionEvidence", () => {
  it.each([
    ["기록이 없으면", { recordedCount: 0, completedCount: 0, periodDays: 14 }],
    ["끝낸 수가 적은 수보다 많으면", { recordedCount: 3, completedCount: 4, periodDays: 14 }],
    ["끝낸 수가 음수면", { recordedCount: 3, completedCount: -1, periodDays: 14 }],
    ["기간이 0일이면", { recordedCount: 3, completedCount: 1, periodDays: 0 }],
  ])("%s 만들지 않는다", (_title, primitives) => {
    // When
    const create = () => SuggestionEvidence.create(primitives);

    // Then
    expect(create).toThrow(expect.objectContaining({ errorCode: ErrorCode.SYS_0001 }));
  });

  it("끝낸 수가 적은 수와 같으면 만든다", () => {
    // When
    const evidence = SuggestionEvidence.create({
      recordedCount: 3,
      completedCount: 3,
      periodDays: 14,
    });

    // Then
    expect(evidence.toPrimitives()).toEqual({
      recordedCount: 3,
      completedCount: 3,
      periodDays: 14,
    });
  });

  it("저장된 값은 검증하지 않고 그대로 읽는다", () => {
    // Given
    const stored = { recordedCount: 0, completedCount: 2, periodDays: 14 };

    // When
    const evidence = SuggestionEvidence.reconstitute(stored);

    // Then
    expect(evidence.toPrimitives()).toEqual(stored);
  });
});
