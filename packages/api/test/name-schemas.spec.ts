import { describe, expect, it } from "vitest";

import {
  createTodoCategorySchema,
  registerSchema,
  updateProfileSchema,
  updateTodoCategorySchema,
} from "../src/index.js";

const nameSchemas = [
  ["가입 이름", registerSchema.shape.name.unwrap(), 20],
  ["프로필 이름", updateProfileSchema.shape.name.unwrap(), 20],
  ["카테고리 생성 이름", createTodoCategorySchema.shape.name, 50],
  ["카테고리 수정 이름", updateTodoCategorySchema.shape.name.unwrap(), 50],
] as const;

describe.each(nameSchemas)("%s", (_title, schema, maxLength) => {
  it.each([
    ["", false],
    ["   ", false],
    ["\t\n ", false],
    ["가", true],
    ["가".repeat(maxLength), true],
    [`  ${"가".repeat(maxLength)}  `, true],
    ["가".repeat(maxLength + 1), false],
    [`  ${"가".repeat(maxLength + 1)}  `, false],
  ])("%j 검사 결과는 %s다", (input, expected) => {
    // Given

    // When
    const result = schema.safeParse(input);

    // Then
    expect(result.success).toBe(expected);
  });

  it("앞뒤 공백을 지운 값을 돌려준다", () => {
    // Given

    // When
    const result = schema.parse("  가나  ");

    // Then
    expect(result).toBe("가나");
  });
});
