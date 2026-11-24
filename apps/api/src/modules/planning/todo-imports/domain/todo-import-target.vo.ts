import type { TodoImportTargetKind } from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

export type TodoImportTargetPrimitives =
  | {
      readonly kind: Extract<TodoImportTargetKind, "NEW_CATEGORY">;
      readonly targetKey: string;
      readonly name: string;
      readonly color: string;
      // 확정할 때 만든 카테고리 id. 그 전에는 null이다
      readonly categoryId: number | null;
    }
  | {
      readonly kind: Extract<TodoImportTargetKind, "EXISTING_CATEGORY">;
      readonly targetKey: string;
      readonly categoryId: number;
    };

/** 가져온 할 일을 넣을 카테고리 하나. 새 카테고리는 확정 때 만들어 id를 받는다 */
export class TodoImportTarget extends ValueObject<TodoImportTargetPrimitives> {
  static create(primitives: TodoImportTargetPrimitives): TodoImportTarget {
    return new TodoImportTarget(primitives);
  }

  static reconstitute(primitives: TodoImportTargetPrimitives): TodoImportTarget {
    return new TodoImportTarget(primitives);
  }

  get targetKey(): string {
    return this.value.targetKey;
  }

  get categoryId(): number | null {
    return this.value.categoryId;
  }

  withCreatedCategory(categoryId: number): TodoImportTarget {
    if (this.value.kind !== "NEW_CATEGORY") {
      return this;
    }
    return new TodoImportTarget({ ...this.value, categoryId });
  }
}
