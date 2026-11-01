import { textToDate, textToDateWithTz } from "drizzle-orm/pg-core/codecs";
import { z } from "zod";

/** Raw SQL 결과의 timestamp(시간대 없음)를 Drizzle 코덱과 같은 규칙인 UTC로 읽는다. */
export const rawTimestampSchema = z.union([z.date(), z.string().transform(textToDateWithTz)]);

/** Raw SQL 결과의 timestamptz를 표기된 오프셋대로 읽는다. */
export const rawTimestamptzSchema = z.union([z.date(), z.string().transform(textToDate)]);

export const nullableRawTimestampSchema = rawTimestampSchema.nullable();
export const nullableRawTimestamptzSchema = rawTimestamptzSchema.nullable();
