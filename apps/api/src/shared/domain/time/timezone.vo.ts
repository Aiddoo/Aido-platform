import { invalidTimezone } from "#api/shared/domain/exceptions/shared-domain.errors";
import { ValueObject } from "#api/shared/domain/model/value-object";

import { parseTimezoneName } from "./timezone-name.js";

export class Timezone extends ValueObject<string> {
  // UTC 그 자체(UTC 달력으로 세는 집계). 날짜 경계를 모를 때의 대체값과는 뜻이 다르다
  static readonly UTC: Timezone = new Timezone("UTC");

  static create(raw: string): Timezone {
    const timezoneId = parseTimezoneName(raw);
    if (timezoneId == null) {
      throw invalidTimezone();
    }
    return new Timezone(timezoneId);
  }

  static reconstitute(raw: string): Timezone {
    return new Timezone(raw);
  }
}
