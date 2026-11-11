import { isEqualWith } from "es-toolkit";

type TemporalValue =
  | Temporal.Instant
  | Temporal.ZonedDateTime
  | Temporal.PlainDate
  | Temporal.PlainTime
  | Temporal.PlainDateTime
  | Temporal.PlainYearMonth
  | Temporal.PlainMonthDay
  | Temporal.Duration;

function isTemporalValue(value: unknown): value is TemporalValue {
  return (
    value instanceof Temporal.Instant ||
    value instanceof Temporal.ZonedDateTime ||
    value instanceof Temporal.PlainDate ||
    value instanceof Temporal.PlainTime ||
    value instanceof Temporal.PlainDateTime ||
    value instanceof Temporal.PlainYearMonth ||
    value instanceof Temporal.PlainMonthDay ||
    value instanceof Temporal.Duration
  );
}

function equalsTemporal(left: TemporalValue, right: TemporalValue): boolean {
  if (left instanceof Temporal.Instant) {
    return right instanceof Temporal.Instant && left.equals(right);
  }
  if (left instanceof Temporal.ZonedDateTime) {
    return right instanceof Temporal.ZonedDateTime && left.equals(right);
  }
  if (left instanceof Temporal.PlainDate) {
    return right instanceof Temporal.PlainDate && left.equals(right);
  }
  if (left instanceof Temporal.PlainTime) {
    return right instanceof Temporal.PlainTime && left.equals(right);
  }
  if (left instanceof Temporal.PlainDateTime) {
    return right instanceof Temporal.PlainDateTime && left.equals(right);
  }
  if (left instanceof Temporal.PlainYearMonth) {
    return right instanceof Temporal.PlainYearMonth && left.equals(right);
  }
  if (left instanceof Temporal.PlainMonthDay) {
    return right instanceof Temporal.PlainMonthDay && left.equals(right);
  }
  // Duration에는 equals가 없고 compare는 달력 단위에 기준 날짜가 필요해 필드 표기로 비교한다
  return right instanceof Temporal.Duration && left.toString() === right.toString();
}

export function compareTemporal(left: unknown, right: unknown): boolean | undefined {
  if (isTemporalValue(left)) {
    return isTemporalValue(right) && equalsTemporal(left, right);
  }
  if (isTemporalValue(right)) {
    return false;
  }
  return undefined;
}

export abstract class ValueObject<TValue> {
  readonly value: TValue;

  protected constructor(value: TValue) {
    if (typeof value === "object" && value != null) {
      Object.freeze(value);
    }
    this.value = value;
  }

  equals(other: ValueObject<TValue>): boolean {
    // es-toolkit isEqual은 같은 값의 서로 다른 Temporal 객체를 구분하지 못해 Temporal 자체 equals로 비교한다
    return (
      other.constructor === this.constructor &&
      isEqualWith(other.value, this.value, compareTemporal)
    );
  }
}
