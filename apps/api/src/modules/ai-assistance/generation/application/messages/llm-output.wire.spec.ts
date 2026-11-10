import { zodSchema } from "ai";
import { isPlainObject, mapValues } from "es-toolkit";
import { z } from "zod";

import { exampleOutputs } from "#test/fixtures/ai-prompt.fixture";

import { parseMemoPrompt } from "../../../parsing/application/messages/parse-memo-prompt.messages.js";
import { PARSE_MEMO_SYSTEM_EN } from "../../../parsing/application/messages/parse-memo-system-en.messages.js";
import { PARSE_MEMO_SYSTEM_KO } from "../../../parsing/application/messages/parse-memo-system-ko.messages.js";
import { parseTodoPrompt } from "../../../parsing/application/messages/parse-todo-prompt.messages.js";
import { PARSE_TODO_SYSTEM_EN } from "../../../parsing/application/messages/parse-todo-system-en.messages.js";
import { PARSE_TODO_SYSTEM_KO } from "../../../parsing/application/messages/parse-todo-system-ko.messages.js";
import {
  dateRefSchema,
  nullableTimeRefSchema,
} from "../../../parsing/application/messages/schedule-expression.wire.js";
import { quickPlanPrompt } from "../../../planning/application/messages/quick-plan-prompt.messages.js";
import { QUICK_PLAN_SYSTEM_EN } from "../../../planning/application/messages/quick-plan-system-en.messages.js";
import { QUICK_PLAN_SYSTEM_KO } from "../../../planning/application/messages/quick-plan-system-ko.messages.js";
import { voiceNoteDigestPrompt } from "../../../planning/application/messages/voice-note-digest-prompt.messages.js";
import { VOICE_NOTE_DIGEST_SYSTEM_EN } from "../../../planning/application/messages/voice-note-digest-system-en.messages.js";
import { VOICE_NOTE_DIGEST_SYSTEM_KO } from "../../../planning/application/messages/voice-note-digest-system-ko.messages.js";
import { reportPrompt } from "../../../reports/application/messages/report-prompt.messages.js";
import { suggestionPrompt } from "../../../suggestions/application/messages/suggestion-prompt.messages.js";
import { llmInteger, llmObject, nullableLlmObject } from "./llm-output.wire.js";

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

/** null이 아닌 갈래가 둘 이상인 anyOf의 경로. 도구 입력에서 유니온 배열은 문자열로 깨져 온다. */
function findUnions(node: unknown, path: string): string[] {
  if (Array.isArray(node)) {
    return node.flatMap((item, index) => findUnions(item, `${path}[${index}]`));
  }
  if (!isPlainObject(node)) {
    return [];
  }
  const { anyOf } = node;
  const branches = Array.isArray(anyOf) ? anyOf : [];
  const isUnion =
    branches.filter((branch) => !(isPlainObject(branch) && branch["type"] === "null")).length > 1;
  return [
    ...(isUnion ? [path] : []),
    ...Object.entries(node).flatMap(([key, value]) => findUnions(value, `${path}/${key}`)),
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

  it.each([
    { id: parseTodoPrompt.id, schema: parseTodoPrompt.schema },
    { id: parseMemoPrompt.id, schema: parseMemoPrompt.schema },
    { id: quickPlanPrompt.id, schema: quickPlanPrompt.schema },
    { id: voiceNoteDigestPrompt.id, schema: voiceNoteDigestPrompt.schema },
    { id: reportPrompt.id, schema: reportPrompt.schema },
    { id: suggestionPrompt.id, schema: suggestionPrompt.schema },
  ] satisfies { id: string; schema: z.ZodType }[])(
    "$id 출력 schema의 anyOf는 값과 null 둘뿐이라 객체 유니온이 없다",
    async ({ schema }: { schema: z.ZodType }) => {
      // When
      const jsonSchema = await zodSchema(schema).jsonSchema;
      // Then
      expect(findUnions(jsonSchema, "$")).toEqual([]);
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

  describe("배열·객체 칸을 JSON 문자열로 보낸 응답", () => {
    const planPrompts = [
      { id: quickPlanPrompt.id, schema: quickPlanPrompt.schema, system: QUICK_PLAN_SYSTEM_KO },
      {
        id: voiceNoteDigestPrompt.id,
        schema: voiceNoteDigestPrompt.schema,
        system: VOICE_NOTE_DIGEST_SYSTEM_KO,
      },
      { id: parseMemoPrompt.id, schema: parseMemoPrompt.schema, system: PARSE_MEMO_SYSTEM_KO },
      { id: parseTodoPrompt.id, schema: parseTodoPrompt.schema, system: PARSE_TODO_SYSTEM_KO },
    ];

    /** 객체의 배열·객체 칸을 모두 JSON 문자열로 바꾼다. 실측한 `{"actions":"[...]"}`처럼 칸이 문자열로 온 모양이다. */
    function stringifyContainers(output: Record<string, unknown>) {
      return mapValues(output, (value) =>
        Array.isArray(value) || isPlainObject(value) ? JSON.stringify(value) : value,
      );
    }

    it.each(planPrompts)(
      "$id 예시의 모든 칸을 문자열로 보내도 같은 값으로 받는다",
      ({ schema, system }) => {
        // Given
        const outputs = exampleOutputs(system).filter(isPlainObject);
        // When
        const parsed = outputs.map((output) => schema.parse(stringifyContainers(output)));
        // Then
        expect(outputs.length).toBeGreaterThan(0);
        expect(parsed).toEqual(outputs.map((output) => schema.parse(output)));
      },
    );

    it("리포트의 tips와 제안의 picks도 문자열이면 풀어서 받는다", () => {
      // Given
      const report = { summary: "잘했어요", tips: JSON.stringify(["일찍 시작하기"]) };
      const suggestion = { picks: JSON.stringify([]) };
      // When
      const parsed = [reportPrompt.schema.parse(report), suggestionPrompt.schema.parse(suggestion)];
      // Then
      expect(parsed).toEqual([{ summary: "잘했어요", tips: ["일찍 시작하기"] }, { picks: [] }]);
    });

    it("배열 안의 항목만 문자열이어도 풀어서 받는다", () => {
      // Given
      const item = { summary: "잘했어요", tips: ["일찍 시작하기"] };
      const schema = llmObject({ reports: z.array(reportPrompt.schema) });
      // When
      const parsed = schema.parse({ reports: [JSON.stringify(item)] });
      // Then
      expect(parsed).toEqual({ reports: [item] });
    });

    it("JSON처럼 보이는 문자열 칸은 그대로 둔다", () => {
      // Given
      const schema = llmObject({ title: z.string(), note: z.string().nullable() });
      // When
      const parsed = schema.parse({ title: '["회의","준비"]', note: '{"a":1}' });
      // Then
      expect(parsed).toEqual({ title: '["회의","준비"]', note: '{"a":1}' });
    });

    it.each([
      { name: "JSON이 아닌 문자열", todos: "할 일 없음" },
      { name: "잘린 JSON", todos: '[{"title":"운동"' },
      { name: "끝에 괄호가 더 붙어 깨진 JSON", todos: '[{"title":"운동"}]}' },
      { name: "배열이 아닌 JSON 값", todos: "3" },
    ])("$name 값은 고쳐 받지 않고 schema가 거부한다", ({ todos }) => {
      // When
      const result = quickPlanPrompt.schema.safeParse({ todos, memo: null });
      // Then
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]).toMatchObject({ path: ["todos"], code: "invalid_type" });
    });

    it("문자열로 풀어 받는 처리는 업체에 보내는 JSON Schema를 바꾸지 않는다", async () => {
      // When
      const jsonSchema = await zodSchema(quickPlanPrompt.schema).jsonSchema;
      // Then
      expect(jsonSchema).toMatchObject({
        type: "object",
        required: ["todos", "memo"],
        properties: { todos: { type: "array" } },
      });
    });
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
