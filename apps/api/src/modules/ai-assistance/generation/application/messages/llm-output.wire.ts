import { isPlainObject, isUndefined, mapValues, omitBy } from "es-toolkit";
import { z } from "zod";

/**
 * 업체 공통 구조화 출력 규칙(OpenAI strict·Gemini·Claude): 모든 칸은 required이고, 값이 없을 수 있는 칸은
 * `.nullable()`, 없음은 끝까지 null 하나다. `.optional()`·`.nullish()`·`.default()`·`.transform()`은 쓰지 않는다.
 * 규칙은 prompt-schema-rules.spec이 모든 PromptDefinition의 JSON Schema로 검사한다.
 */
function repairLlmFields(shape: z.ZodRawShape) {
  const absentFields = Object.fromEntries(Object.keys(shape).map((key) => [key, null]));
  return (value: unknown) => {
    const object = typeof value === "string" ? decodeJsonContainer(value) : value;
    if (!isPlainObject(object)) {
      return value;
    }
    const fields = mapValues(omitBy(object, isUndefined), (field, key) => {
      const schema = shape[String(key)];
      return typeof field === "string" && schema != null && !z.safeParse(schema, field).success
        ? decodeJsonContainer(field)
        : field;
    });
    return { ...absentFields, ...fields };
  };
}

/** JSON 배열·객체 문자열만 풀고, 그 밖의 문자열은 그대로 돌려줘 schema가 거부하게 한다. */
function decodeJsonContainer(value: string): unknown {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) || isPlainObject(parsed) ? parsed : value;
  } catch {
    return value;
  }
}

/**
 * LLM 출력 객체. 엄격 모드가 아닌 경로(Claude JSON 도구)에서 모델이 뺀 칸은 null로 보고, 배열·객체 칸을
 * JSON 문자열로 보내면 풀어서 받는다(실측 `{"actions":"[...]"}`). 문자열을 받는 칸은 건드리지 않는다.
 * `.extend`는 preprocess 위에서 쓸 수 없으므로 shape을 펼쳐 조합한다.
 */
export function llmObject<Shape extends z.ZodRawShape>(shape: Shape) {
  return z.preprocess(repairLlmFields(shape), z.object(shape));
}

/**
 * null도 되는 LLM 출력 객체. `llmObject(shape).nullable()`처럼 preprocess 바깥에 씌우면 Zod가
 * JSON Schema required에서 그 칸을 빼 OpenAI strict가 400을 내므로 안쪽에서 null을 허용한다.
 */
export function nullableLlmObject<Shape extends z.ZodRawShape>(shape: Shape) {
  return z.preprocess(repairLlmFields(shape), z.object(shape).nullable());
}

/**
 * LLM 출력 정수. `z.number().int()`는 JSON Schema에 안전 정수 minimum·maximum을 싣는다.
 * 금지 키워드 없이 integer만 알리고 정수 여부는 서버가 다시 검증한다.
 */
export const llmInteger = () =>
  z
    .number()
    .refine((value) => Number.isInteger(value))
    .meta({ type: "integer" });
