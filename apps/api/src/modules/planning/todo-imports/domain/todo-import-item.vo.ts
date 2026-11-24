import { ValueObject } from "#api/shared/domain/model/value-object";

export interface TodoImportItemPrimitives {
  // 기기가 해시한 일정 회차 키. 같은 사용자의 같은 키는 할 일 하나만 만든다
  readonly sourceKey: string;
  readonly collectionKey: string;
  readonly title: string;
  readonly startDate: Temporal.PlainDate;
  readonly endDate: Temporal.PlainDate | null;
  readonly localTime: string | null;
}

/** 할 일로 만들 때까지 임시로 받아 둔 일정 하나. 제목은 할 일 제목으로만 쓰고 로그에 남기지 않는다 */
export class TodoImportItem extends ValueObject<TodoImportItemPrimitives> {
  static create(primitives: TodoImportItemPrimitives): TodoImportItem {
    return new TodoImportItem(primitives);
  }

  static reconstitute(primitives: TodoImportItemPrimitives): TodoImportItem {
    return new TodoImportItem(primitives);
  }

  get sourceKey(): string {
    return this.value.sourceKey;
  }

  get collectionKey(): string {
    return this.value.collectionKey;
  }

  get startDate(): Temporal.PlainDate {
    return this.value.startDate;
  }
}
