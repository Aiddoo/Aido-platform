import { invalidTimezone } from "#api/shared/domain/exceptions/shared-domain.errors";
import { ValueObject } from "#api/shared/domain/model/value-object";

function toCanonicalTimezoneId(raw: string): string | null {
  try {
    const timezoneId = new Temporal.ZonedDateTime(0n, raw).timeZoneId;
    // Temporal은 "+09:00" 같은 고정 오프셋도 받지만 오프셋은 서머타임에서 틀려 IANA 이름만 받는다
    const isOffset = timezoneId.startsWith("+") || timezoneId.startsWith("-");
    return isOffset ? null : timezoneId;
  } catch {
    return null;
  }
}

export class Timezone extends ValueObject<string> {
  static readonly UTC: Timezone = new Timezone("UTC");
  // 시간대를 모르는 사용자의 기존 기본값
  static readonly SEOUL: Timezone = new Timezone("Asia/Seoul");

  static create(raw: string): Timezone {
    const timezoneId = toCanonicalTimezoneId(raw);
    if (timezoneId == null) {
      throw invalidTimezone();
    }
    return new Timezone(timezoneId);
  }

  static reconstitute(raw: string): Timezone {
    return new Timezone(raw);
  }
}
