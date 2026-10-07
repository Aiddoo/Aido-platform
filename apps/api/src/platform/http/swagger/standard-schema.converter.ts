import type { SwaggerDocumentOptions } from "@nestjs/swagger";
import { z } from "zod";

type JsonSchema = z.core.JSONSchema.BaseSchema;

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
    nonNullAlternatives !== undefined && nonNullAlternatives.length !== converted.anyOf?.length;
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

export const convertStandardSchema: NonNullable<
  SwaggerDocumentOptions["standardSchemaConverter"]
> = (schema) => {
  if (!(schema instanceof z.ZodType)) return undefined;

  // Keep released input shapes, including nullable numeric boundary representation.
  const jsonSchema = z.toJSONSchema(schema, { io: "input" });
  const converted = normalizeJsonSchema(jsonSchema);
  const components = Object.fromEntries(
    Object.entries(jsonSchema.$defs ?? {}).map(([name, definition]) => [
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
