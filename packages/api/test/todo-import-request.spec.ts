import { describe, expect, it } from "vitest";

import { todoImportItemSchema } from "../src/contracts/todo-import/v1/index.js";

const ITEM = {
  sourceKey: "a".repeat(64),
  collectionKey: "b".repeat(64),
  title: "회의",
  startDate: "2026-11-24",
  endDate: null,
  localTime: "09:00",
};

describe("todoImportItemSchema", () => {
  it.each([
    ["회의", true],
    ["회\u0000의", false],
    ["\u0000", false],
  ])("제목 %j 검사 결과는 %s다", (title, expected) => {
    // When
    const result = todoImportItemSchema.safeParse({ ...ITEM, title });

    // Then
    expect(result.success).toBe(expected);
  });
});
