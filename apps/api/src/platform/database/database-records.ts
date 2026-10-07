import type { CreateInput, DefaultModelRow } from "@prisma/orm-postgres/orm-client";
import type { Char, Varchar } from "@prisma/orm-postgres/target/codec-types";
import { isPlainObject } from "es-toolkit";

import type { Contract } from "../../generated/prisma8/contract.d.js";
import contractJson from "../../generated/prisma8/contract.json" with { type: "json" };
import {
  applicationDate,
  applicationTimestamp,
  applicationTimestamptz,
  char,
  createEntityId,
  databaseDate,
  databaseTimestamp,
  databaseTimestamptz,
  varchar,
} from "./database-values.js";

type Models = Contract["domain"]["namespaces"]["public"]["models"];
export type ModelName = keyof Models;
type Fields<M extends ModelName> = Models[M]["fields"];
type Relations<M extends ModelName> = Models[M]["relations"];
type FieldCodec<
  M extends ModelName,
  K,
  Key = K extends "type" ? "_type" : K,
> = Key extends keyof Fields<M>
  ? Fields<M>[Key] extends { readonly type: { readonly codecId: infer C } }
    ? C
    : never
  : never;
type ScalarValue<M extends ModelName, K, V> = V extends null | undefined
  ? V
  : FieldCodec<M, K> extends
        | "pg/date-string@1"
        | "pg/timestamp-string@1"
        | "pg/timestamptz-string@1"
    ? Date
    : V extends Varchar<number> | Char<number>
      ? string
      : V;
type RelationModel<M extends ModelName, K extends keyof Relations<M>> = Relations<M>[K] extends {
  readonly to: { readonly model: infer Target extends ModelName };
}
  ? Target
  : never;

/** ORM 표현은 인프라 안에 두고, 기존 port의 Date/string 계약을 유지한다. */
export type ApplicationRecord<M extends ModelName, Row> = Row extends null | undefined
  ? Row
  : Row extends readonly (infer Item)[]
    ? ApplicationRecord<M, Item>[]
    : {
        [K in keyof Row as K extends "_type" ? "type" : K]: K extends keyof Fields<M>
          ? ScalarValue<M, K, Row[K]>
          : K extends keyof Relations<M>
            ? ApplicationRecord<RelationModel<M, K>, Row[K]>
            : Row[K];
      };
export type DatabaseRecord<M extends ModelName> = ApplicationRecord<
  M,
  DefaultModelRow<Contract, M, "public">
>;
type ScalarCreate<M extends ModelName> = Pick<
  CreateInput<Contract, M, "public">,
  keyof CreateInput<Contract, M, "public"> & keyof Fields<M>
>;
type GeneratedIdModel =
  | "User"
  | "UserProfile"
  | "Session"
  | "UserConsent"
  | "UserPreference"
  | "UserLocation"
  | "TodoComment"
  | "Follow"
  | "DailyCompletion"
  | "RetentionExperimentAssignment"
  | "RetentionExperimentStage"
  | "RetentionPushOutbox"
  | "RetentionExperimentResult";
type OptionalId<M extends ModelName, Input> = M extends GeneratedIdModel
  ? Omit<Input, "id"> & { id?: string }
  : Input;
export type DatabaseCreate<M extends ModelName> = OptionalId<
  M,
  ApplicationRecord<M, ScalarCreate<M>>
>;
export type DatabasePatch<M extends ModelName> = Partial<DatabaseRecord<M>>;

const models = new Map(
  Object.entries(contractJson.domain.namespaces.public.models).map(([name, model]) => [
    name,
    {
      fields: new Map(Object.entries(model.fields)),
      relations: new Map(Object.entries(model.relations)),
    },
  ]),
);
const generatedIdModels: ReadonlySet<ModelName> = new Set([
  "User",
  "UserProfile",
  "Session",
  "UserConsent",
  "UserPreference",
  "UserLocation",
  "TodoComment",
  "Follow",
  "DailyCompletion",
  "RetentionExperimentAssignment",
  "RetentionExperimentStage",
  "RetentionPushOutbox",
  "RetentionExperimentResult",
]);

export function decodeRecord<M extends ModelName, Row>(
  model: M,
  row: Row,
): ApplicationRecord<M, Row>;
export function decodeRecord(model: string, row: unknown): unknown {
  if (row === null || row === undefined) return row;
  if (Array.isArray(row)) return row.map((item) => decodeRecordValue(model, item));
  return decodeRecordValue(model, row);
}

function decodeRecordValue(model: string, row: unknown): unknown {
  if (row === null || row === undefined) return row;
  if (Array.isArray(row)) return row.map((item) => decodeRecordValue(model, item));
  if (!isPlainObject(row)) throw new TypeError(`Invalid ${model} database record`);
  const metadata = models.get(model);
  if (metadata === undefined) throw new TypeError(`Unknown database model: ${model}`);
  const fields = metadata.fields;
  const relations = metadata.relations;
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      const codec = fields.get(key)?.type.codecId;
      if (value !== null && value !== undefined) {
        if (codec === "pg/timestamptz-string@1") {
          if (typeof value !== "string") throw new TypeError(`Invalid ${model}.${key} timestamptz`);
          return [key, applicationTimestamptz(value)];
        }
        if (codec === "pg/date-string@1") {
          if (typeof value !== "string") throw new TypeError(`Invalid ${model}.${key} date`);
          return [key === "_type" ? "type" : key, applicationDate(value)];
        }
        if (codec === "pg/timestamp-string@1") {
          if (typeof value !== "string") throw new TypeError(`Invalid ${model}.${key} timestamp`);
          return [key === "_type" ? "type" : key, applicationTimestamp(value)];
        }
      }
      const relation = relations.get(key);
      const nested = relation !== undefined && (Array.isArray(value) || isPlainObject(value));
      return [
        key === "_type" ? "type" : key,
        nested ? decodeRecordValue(relation.to.model, value) : value,
      ];
    }),
  );
}

export function encodeCreate<M extends ModelName>(
  model: M,
  input: DatabaseCreate<M>,
): CreateInput<Contract, M, "public">;
export function encodeCreate(model: ModelName, input: object): unknown {
  const values = encodeValues(model, input);
  if (generatedIdModels.has(model) && !("id" in values)) values.id = createEntityId();
  return values;
}

type EncodedFields<M extends ModelName, Input> = {
  [K in keyof Input as K extends "type" ? "_type" : K]: (
    K extends "type" ? "_type" : K
  ) extends keyof DefaultModelRow<Contract, M, "public">
    ? DefaultModelRow<Contract, M, "public">[Extract<
        K extends "type" ? "_type" : K,
        keyof DefaultModelRow<Contract, M, "public">
      >]
    : never;
};
export function encodePatch<M extends ModelName, Input extends DatabasePatch<M>>(
  model: M,
  input: Input,
): EncodedFields<M, Input>;
export function encodePatch(model: ModelName, input: object): unknown {
  return encodeValues(model, input);
}

/** Omitted fields stay omitted; null explicitly clears a nullable field. JSON is passed through. */
function encodeValues(model: ModelName, input: object): Record<string, unknown> {
  const metadata = models.get(model);
  if (metadata === undefined) throw new TypeError(`Unknown database model: ${model}`);
  const fields = metadata.fields;
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    const databaseKey = key === "type" && fields.has("_type") ? "_type" : key;
    const field = fields.get(databaseKey);
    if (field === undefined) throw new TypeError(`Unknown scalar field: ${model}.${key}`);
    if (value === null) {
      if (!field.nullable) throw new TypeError(`${model}.${key} cannot be null`);
      values[databaseKey] = null;
      continue;
    }
    const codec = field.type.codecId;
    if (
      codec === "pg/date-string@1" ||
      codec === "pg/timestamp-string@1" ||
      codec === "pg/timestamptz-string@1"
    ) {
      if (!(value instanceof Date)) throw new TypeError(`${model}.${key} requires Date`);
      values[databaseKey] =
        codec === "pg/date-string@1"
          ? databaseDate(value)
          : codec === "pg/timestamptz-string@1"
            ? databaseTimestamptz(value)
            : databaseTimestamp(value);
    } else if (codec === "sql/varchar@1" || codec === "sql/char@1") {
      if (
        typeof value !== "string" ||
        !("typeParams" in field.type) ||
        !("length" in field.type.typeParams) ||
        typeof field.type.typeParams.length !== "number"
      ) {
        throw new TypeError(`Invalid ${model}.${key} varchar`);
      }
      values[databaseKey] =
        codec === "sql/char@1"
          ? char(value, field.type.typeParams.length)
          : varchar(value, field.type.typeParams.length);
    } else {
      values[databaseKey] = value;
    }
  }
  return values;
}
