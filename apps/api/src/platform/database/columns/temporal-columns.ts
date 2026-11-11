import { customType } from "drizzle-orm/pg-core";

// drizzle-kit은 스키마를 dist 없이 읽어 #api 별칭(dist로 풀림)을 못 따라가므로 상대 경로로 둔다
import { toIsoString } from "../../../shared/domain/time/instant.js";

const OFFSET_SUFFIX = /(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/;

// timestamp(3)은 시간대 없이 UTC 벽시계로 저장해 왔고(세션 TimeZone=UTC), timestamptz는 오프셋이 붙어 온다
function parseInstant(text: string): Temporal.Instant {
  if (OFFSET_SUFFIX.test(text)) {
    return Temporal.Instant.from(text);
  }
  return Temporal.PlainDateTime.from(text).toZonedDateTime("UTC").toInstant();
}

interface InstantColumnOptions {
  readonly withTimezone?: boolean;
}

// dataType 문자열은 기존 timestamp({ precision: 3 })·date 컬럼과 같아야 마이그레이션이 생기지 않는다
export const instant = customType<{
  data: Temporal.Instant;
  driverData: string;
  jsonData: string;
  config: InstantColumnOptions;
}>({
  dataType: (options) =>
    options?.withTimezone === true ? "timestamp(3) with time zone" : "timestamp(3)",
  codec: (options) => (options?.withTimezone === true ? "timestamptz:string" : "timestamp:string"),
  toDriver: (value) => toIsoString(value),
  fromDriver: parseInstant,
  fromJson: parseInstant,
});

export const plainDate = customType<{
  data: Temporal.PlainDate;
  driverData: string;
  jsonData: string;
}>({
  dataType: () => "date",
  codec: "date:string",
  toDriver: (value) => value.toString(),
  fromDriver: (text) => Temporal.PlainDate.from(text),
  fromJson: (text) => Temporal.PlainDate.from(text),
});
