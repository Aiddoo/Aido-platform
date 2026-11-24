import { ValueObject } from "#api/shared/domain/model/value-object";

export interface TodoImportCollectionPrimitives {
  readonly collectionKey: string;
  readonly targetKey: string;
  readonly expectedItemCount: number;
}

/** 기기 캘린더 하나(키는 기기가 해시한 값)와 그 일정을 넣을 대상 */
export class TodoImportCollection extends ValueObject<TodoImportCollectionPrimitives> {
  static create(primitives: TodoImportCollectionPrimitives): TodoImportCollection {
    return new TodoImportCollection(primitives);
  }

  static reconstitute(primitives: TodoImportCollectionPrimitives): TodoImportCollection {
    return new TodoImportCollection(primitives);
  }

  get collectionKey(): string {
    return this.value.collectionKey;
  }

  get targetKey(): string {
    return this.value.targetKey;
  }

  get expectedItemCount(): number {
    return this.value.expectedItemCount;
  }
}
