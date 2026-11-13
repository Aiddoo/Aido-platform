import { invalidTimeZone } from "#api/shared/domain/exceptions/shared-domain.errors";
import { ValueObject } from "#api/shared/domain/model/value-object";

function toCanonicalTimeZoneId(raw: string): string | null {
  try {
    const timeZoneId = new Temporal.ZonedDateTime(0n, raw).timeZoneId;
    // Temporal은 "+09:00" 같은 고정 오프셋도 받지만 오프셋은 서머타임에서 틀려 IANA 이름만 받는다
    const isOffset = timeZoneId.startsWith("+") || timeZoneId.startsWith("-");
    return isOffset ? null : timeZoneId;
  } catch {
    return null;
  }
}

export class TimeZone extends ValueObject<string> {
  static readonly UTC: TimeZone = new TimeZone("UTC");
  // 시간대를 모르는 사용자의 기존 기본값
  static readonly SEOUL: TimeZone = new TimeZone("Asia/Seoul");

  static create(raw: string): TimeZone {
    const timeZoneId = toCanonicalTimeZoneId(raw);
    if (timeZoneId == null) {
      throw invalidTimeZone();
    }
    return new TimeZone(timeZoneId);
  }

  static reconstitute(raw: string): TimeZone {
    return new TimeZone(raw);
  }
}
