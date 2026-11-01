import { z } from "zod";

const TIMESTAMP_TEXT =
  /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)?$/;

/**
 * Raw SQL 결과의 timestamp 텍스트를 Date로 바꾼다.
 * 시간대가 없는 `timestamp`는 UTC로, `timestamptz`는 표기된 오프셋 그대로 해석해 process 시간대와 무관하다.
 */
export const rawTimestampSchema = z
  .union([z.date(), z.string().regex(TIMESTAMP_TEXT)])
  .transform((value) => {
    if (value instanceof Date) {
      return value;
    }
    const iso = value
      .replace(" ", "T")
      .replace(/([+-]\d{2})$/, "$1:00")
      .replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
    return new Date(/(Z|[+-]\d{2}:\d{2})$/.test(iso) ? iso : `${iso}Z`);
  });

export const nullableRawTimestampSchema = rawTimestampSchema.nullable();
