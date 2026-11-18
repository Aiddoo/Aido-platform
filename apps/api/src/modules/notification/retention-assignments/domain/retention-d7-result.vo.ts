import { ValueObject } from "#api/shared/domain/model/value-object";

interface RetentionD7ResultValue {
  readonly returnedWithinD7: boolean;
  readonly todoActionWithinD7: boolean;
  readonly measuredAt: Temporal.Instant;
}

// 배정마다 하나인 D7 측정값. 다시 재면 덮어쓴다
export class RetentionD7Result extends ValueObject<RetentionD7ResultValue> {
  static create(value: RetentionD7ResultValue): RetentionD7Result {
    return new RetentionD7Result({ ...value });
  }
}
