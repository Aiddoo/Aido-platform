import { zodSchema } from "ai";
import { isPlainObject } from "es-toolkit";
import { z } from "zod";

import { exampleOutputs } from "#test/fixtures/ai-prompt.fixture";

import { parseMemoPrompt } from "../parsing/parse-memo/index.js";
import { PARSE_MEMO_SYSTEM_EN } from "../parsing/parse-memo/prompt.en.js";
import { PARSE_MEMO_SYSTEM_KO } from "../parsing/parse-memo/prompt.ko.js";
import { parseTodoPrompt } from "../parsing/parse-todo/index.js";
import { PARSE_TODO_SYSTEM_EN } from "../parsing/parse-todo/prompt.en.js";
import { PARSE_TODO_SYSTEM_KO } from "../parsing/parse-todo/prompt.ko.js";
import {
  dateRefSchema,
  nullableTimeRefSchema,
} from "../parsing/schedule/schedule-expression.schema.js";
import { quickPlanPrompt } from "../planning/quick-plan/index.js";
import { QUICK_PLAN_SYSTEM_EN } from "../planning/quick-plan/prompt.en.js";
import { QUICK_PLAN_SYSTEM_KO } from "../planning/quick-plan/prompt.ko.js";
import { voiceNoteDigestPrompt } from "../planning/voice-note-digest/index.js";
import { VOICE_NOTE_DIGEST_SYSTEM_EN } from "../planning/voice-note-digest/prompt.en.js";
import { VOICE_NOTE_DIGEST_SYSTEM_KO } from "../planning/voice-note-digest/prompt.ko.js";
import { reportPrompt } from "../reports/report/index.js";
import { suggestionPrompt } from "../suggestions/suggestion/index.js";
import { llmInteger, llmObject, nullableLlmObject } from "./llm-object.js";

/** OpenAI strict·Gemini·Claude 공통으로 쓸 수 없는 JSON Schema 키워드 */
const FORBIDDEN_KEYWORDS = [
  "$ref",
  "$defs",
  "definitions",
  "oneOf",
  "allOf",
  "not",
  "const",
  "default",
  "pattern",
  "format",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
];

/** 스키마 전체를 돌며 규칙 위반을 경로와 함께 모은다. 칸 이름은 properties 안이라 키워드로 보지 않는다. */
function findViolations(node: unknown, path: string): string[] {
  if (Array.isArray(node)) {
    return node.flatMap((item, index) => findViolations(item, `${path}[${index}]`));
  }
  if (!isPlainObject(node)) {
    return [];
  }
  const violations = FORBIDDEN_KEYWORDS.filter((keyword) => keyword in node).map(
    (keyword) => `${path}: ${keyword}`,
  );
  const { properties, required, additionalProperties } = node;
  if (isPlainObject(properties)) {
    const keys = Object.keys(properties).sort();
    const requiredKeys = Array.isArray(required) ? [...required].sort() : [];
    if (JSON.stringify(keys) !== JSON.stringify(requiredKeys)) {
      violations.push(
        `${path}: required ${JSON.stringify(requiredKeys)} ≠ ${JSON.stringify(keys)}`,
      );
    }
    if (additionalProperties !== false) {
      violations.push(`${path}: additionalProperties`);
    }
  }
  const children = Object.entries(node).filter(([key]) => key !== "required" && key !== "enum");
  return [
    ...violations,
    ...children.flatMap(([key, value]) =>
      key === "properties" && isPlainObject(value)
        ? Object.entries(value).flatMap(([name, property]) =>
            findViolations(property, `${path}.${name}`),
          )
        : findViolations(value, `${path}/${key}`),
    ),
  ];
}

describe("업체 공통 구조화 출력 규칙", () => {
  it.each([
    { id: parseTodoPrompt.id, schema: parseTodoPrompt.schema },
    { id: parseMemoPrompt.id, schema: parseMemoPrompt.schema },
    { id: quickPlanPrompt.id, schema: quickPlanPrompt.schema },
    { id: voiceNoteDigestPrompt.id, schema: voiceNoteDigestPrompt.schema },
    { id: reportPrompt.id, schema: reportPrompt.schema },
    { id: suggestionPrompt.id, schema: suggestionPrompt.schema },
  ] satisfies { id: string; schema: z.ZodType }[])(
    "$id 출력 schema는 루트가 object이고 모든 칸이 required이며 금지 키워드가 없다",
    async ({ schema }: { schema: z.ZodType }) => {
      // When
      const jsonSchema = await zodSchema(schema).jsonSchema;
      // Then
      expect(jsonSchema.type).toBe("object");
      expect(findViolations(jsonSchema, "$")).toEqual([]);
    },
  );

  it("규칙 검사는 preprocess 바깥의 nullable이 required에서 칸을 빼는 실수를 잡아낸다", async () => {
    // Given
    const inner = { hour: llmInteger().nullable() };
    const broken = llmObject({ time: llmObject(inner).nullable() });
    const correct = llmObject({ time: nullableLlmObject(inner) });
    // When
    const violations = [
      findViolations(await zodSchema(broken).jsonSchema, "$"),
      findViolations(await zodSchema(correct).jsonSchema, "$"),
    ];
    // Then
    expect(violations[0]).not.toEqual([]);
    expect(violations[1]).toEqual([]);
  });

  it("모델이 뺀 칸과 undefined인 칸은 null로 채우고 받은 값은 그대로 둔다", () => {
    // Given
    const draft = { kind: "WEEKDAY", weekday: "TUE", weekOffset: undefined };
    // When
    const parsed = dateRefSchema.parse(draft);
    // Then
    expect(parsed).toEqual({
      kind: "WEEKDAY",
      amount: null,
      weekday: "TUE",
      weekOffset: null,
      month: null,
      day: null,
      year: null,
    });
  });

  it("null도 되는 객체는 null을 그대로 받고 객체면 뺀 칸을 null로 채운다", () => {
    // When
    const results = [nullableTimeRefSchema.parse(null), nullableTimeRefSchema.parse({ hour: 3 })];
    // Then
    expect(results).toEqual([
      null,
      { hour: 3, minute: null, meridiem: null, partOfDay: null, relativeMinutes: null },
    ]);
  });

  it("null이 될 수 없는 칸을 빼면 출력 오류로 거절한다", () => {
    // When
    const result = dateRefSchema.safeParse({ amount: 1 });
    // Then
    expect(result.success).toBe(false);
  });

  it("llmInteger는 정수만 받고 JSON Schema에는 integer만 알린다", async () => {
    // Given
    const schema = llmObject({ day: llmInteger() });
    // When
    const results = [schema.safeParse({ day: 3 }).success, schema.safeParse({ day: 1.5 }).success];
    const jsonSchema = await zodSchema(schema).jsonSchema;
    // Then
    expect(results).toEqual([true, false]);
    expect(jsonSchema.properties).toEqual({ day: { type: "integer" } });
  });

  it.each([
    { name: "parse-todo ko", system: PARSE_TODO_SYSTEM_KO, schema: parseTodoPrompt.schema },
    { name: "parse-todo en", system: PARSE_TODO_SYSTEM_EN, schema: parseTodoPrompt.schema },
    { name: "parse-memo ko", system: PARSE_MEMO_SYSTEM_KO, schema: parseMemoPrompt.schema },
    { name: "parse-memo en", system: PARSE_MEMO_SYSTEM_EN, schema: parseMemoPrompt.schema },
    { name: "quick-plan ko", system: QUICK_PLAN_SYSTEM_KO, schema: quickPlanPrompt.schema },
    { name: "quick-plan en", system: QUICK_PLAN_SYSTEM_EN, schema: quickPlanPrompt.schema },
    {
      name: "voice-note-digest ko",
      system: VOICE_NOTE_DIGEST_SYSTEM_KO,
      schema: voiceNoteDigestPrompt.schema,
    },
    {
      name: "voice-note-digest en",
      system: VOICE_NOTE_DIGEST_SYSTEM_EN,
      schema: voiceNoteDigestPrompt.schema,
    },
  ] satisfies { name: string; system: string; schema: z.ZodType }[])(
    "$name 예시 출력은 값이 없는 칸까지 null로 모두 쓴다",
    ({ system, schema }) => {
      // When
      const outputs = exampleOutputs(system);
      // Then
      expect(outputs.length).toBeGreaterThan(0);
      for (const output of outputs) {
        expect(JSON.stringify(output)).toBe(JSON.stringify(schema.parse(output)));
      }
    },
  );

  it.each([
    { name: "parse-todo ko", system: PARSE_TODO_SYSTEM_KO },
    { name: "parse-todo en", system: PARSE_TODO_SYSTEM_EN },
    { name: "parse-memo ko", system: PARSE_MEMO_SYSTEM_KO },
    { name: "parse-memo en", system: PARSE_MEMO_SYSTEM_EN },
    { name: "quick-plan ko", system: QUICK_PLAN_SYSTEM_KO },
    { name: "quick-plan en", system: QUICK_PLAN_SYSTEM_EN },
    { name: "voice-note-digest ko", system: VOICE_NOTE_DIGEST_SYSTEM_KO },
    { name: "voice-note-digest en", system: VOICE_NOTE_DIGEST_SYSTEM_EN },
  ])("$name 지시문은 칸을 생략하라고 하지 않는다", ({ system }) => {
    // Then
    expect(system).not.toMatch(/\bomit|생략/i);
  });
});
