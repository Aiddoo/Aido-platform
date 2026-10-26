import type { SwaggerDocumentOptions } from "@nestjs/swagger";
import { z } from "zod";

type JsonSchema = z.core.JSONSchema.BaseSchema;

// z.toJSONSchema target "openapi-3.0"(zod 4.6.7)는 nullable 양수의 minimum을 잃고 $ref를
// #/definitions로 바꾸며 tuple 표현이 달라 출시된 OpenAPI 계약과 달라지므로 직접 정규화를 유지한다.
function normalizeJsonSchema(schema: JsonSchema): JsonSchema {
  let converted: JsonSchema = { ...schema };
  delete converted.id;
  delete converted.$schema;
  delete converted.$defs;
  delete converted.definitions;
  delete converted.propertyNames;
  delete converted.apiParameter;

  const nonNullAlternatives = converted.anyOf?.filter((alternative) => alternative.type !== "null");
  const isNullableUnion =
    nonNullAlternatives != null && nonNullAlternatives.length !== converted.anyOf?.length;
  if (isNullableUnion && nonNullAlternatives) {
    delete converted.anyOf;
    const sole = nonNullAlternatives.length === 1 ? nonNullAlternatives[0] : undefined;
    if (sole) {
      converted =
        sole.$ref && Object.keys(sole).length === 1
          ? { allOf: [sole], ...converted, nullable: true }
          : { ...sole, ...converted, nullable: true };
      if (sole.enum && !sole.enum.includes(null)) converted.enum = [...sole.enum, null];
    } else {
      converted = { ...converted, anyOf: nonNullAlternatives, nullable: true };
    }
  } else {
    if (typeof converted.exclusiveMinimum === "number") {
      converted.minimum = converted.exclusiveMinimum;
      converted.exclusiveMinimum = true;
    }
    if (typeof converted.exclusiveMaximum === "number") {
      converted.maximum = converted.exclusiveMaximum;
      converted.exclusiveMaximum = true;
    }
  }
  // nullish-strict: JSON Schema const는 null도 값이다
  if (converted.const !== undefined) {
    converted.enum = [converted.const];
    delete converted.const;
  }
  if (converted.properties)
    converted.properties = Object.fromEntries(
      Object.entries(converted.properties).map(([name, property]) => [
        name,
        typeof property === "boolean" ? property : normalizeJsonSchema(property),
      ]),
    );
  if (Array.isArray(converted.items))
    converted.items = converted.items.map((item) =>
      typeof item === "boolean" ? item : normalizeJsonSchema(item),
    );
  else if (converted.items && typeof converted.items === "object")
    converted.items = normalizeJsonSchema(converted.items);
  for (const name of ["anyOf", "oneOf", "allOf"] as const) {
    if (converted[name]) converted[name] = converted[name].map(normalizeJsonSchema);
  }
  if (converted.additionalProperties && typeof converted.additionalProperties === "object")
    converted.additionalProperties = normalizeJsonSchema(converted.additionalProperties);
  return converted;
}

const ROOT_DEFINITION_PREFIX = "#/$defs/";

// zod 4.6부터 id가 있는 루트는 $defs에 들어가고 루트는 { $ref }만 남는다.
// 이전 출력(루트 본문 inline)과 같은 계약을 유지하려고 루트 정의를 다시 꺼낸다.
function unwrapRootDefinition(schema: JsonSchema): {
  root: JsonSchema;
  definitions: Record<string, JsonSchema>;
} {
  const definitions: Record<string, JsonSchema> = schema.$defs ?? {};
  const name = schema.$ref?.startsWith(ROOT_DEFINITION_PREFIX)
    ? schema.$ref.slice(ROOT_DEFINITION_PREFIX.length)
    : undefined;
  const rootDefinition = name == null ? undefined : definitions[name];
  if (name == null || rootDefinition == null) return { root: schema, definitions };

  const { [name]: _unwrapped, ...rest } = definitions;
  return { root: rootDefinition, definitions: rest };
}

export const convertStandardSchema: NonNullable<
  SwaggerDocumentOptions["standardSchemaConverter"]
> = (schema) => {
  if (!(schema instanceof z.ZodType)) return undefined;

  // Keep released input shapes, including nullable numeric boundary representation.
  const { root: jsonSchema, definitions } = unwrapRootDefinition(
    z.toJSONSchema(schema, { io: "input" }),
  );
  const converted = normalizeJsonSchema(jsonSchema);
  const components = Object.fromEntries(
    Object.entries(definitions).map(([name, definition]) => [
      name,
      normalizeJsonSchema(definition),
    ]),
  );
  const id = schema.meta()?.id;
  if (!id || schema.meta()?.apiParameter === true) return { schema: converted, components };

  return {
    schema: { $ref: `#/components/schemas/${id}` },
    components: { ...components, [id]: converted },
  };
};
