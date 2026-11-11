import { describe, expect, test } from "vitest";
import { z } from "zod";

import { cursorPageSchema } from "../src/index.js";

const itemSchema = z.object({ id: z.number().int() });

describe("cursorPageSchema", () => {
  test("items와 nextCursor·hasNext·size 순서의 pagination을 만든다", () => {
    // Given
    const schema = cursorPageSchema(itemSchema, z.string());
    // When
    const jsonSchema = z.toJSONSchema(schema, { io: "input" });
    // Then
    expect(jsonSchema).toMatchObject({
      required: ["items", "pagination"],
      properties: {
        items: { type: "array" },
        pagination: { required: ["nextCursor", "hasNext", "size"] },
      },
    });
    expect(Object.keys(jsonSchema.properties ?? {})).toEqual(["items", "pagination"]);
  });

  test("마지막 페이지의 nextCursor null을 허용한다", () => {
    // Given
    const schema = cursorPageSchema(itemSchema, z.number().int());
    const lastPage = {
      items: [{ id: 1 }],
      pagination: { nextCursor: null, hasNext: false, size: 20 },
    };
    // When
    const result = schema.parse(lastPage);
    // Then
    expect(result).toEqual(lastPage);
  });

  test("커서 schema와 다른 타입의 nextCursor를 거부한다", () => {
    // Given
    const schema = cursorPageSchema(itemSchema, z.number().int());
    const page = { items: [], pagination: { nextCursor: "2", hasNext: true, size: 20 } };
    // When
    const result = schema.safeParse(page);
    // Then
    expect(result.success).toBe(false);
  });

  test("설명을 넘기면 items와 pagination에 Swagger 설명을 단다", () => {
    // Given
    const schema = cursorPageSchema(itemSchema, z.number().int(), {
      items: "메모 목록",
      pagination: "페이지네이션 정보",
    });
    // When
    const { properties } = z.toJSONSchema(schema, { io: "input" });
    // Then
    expect(properties).toMatchObject({
      items: { description: "메모 목록" },
      pagination: { description: "페이지네이션 정보" },
    });
  });
});
