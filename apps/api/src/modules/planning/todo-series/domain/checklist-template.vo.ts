import { TODO_ITEM_LIMITS } from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

import { checklistLimitReached } from "../../shared/domain/planning.errors.js";

export interface ChecklistTemplateItem {
  readonly title: string;
}

function copyItems(items: readonly ChecklistTemplateItem[]): ChecklistTemplateItem[] {
  return items.map((item) => ({ title: item.title }));
}

// 반복이 새로 만드는 회차마다 복사하는 체크리스트다. 이미 만든 회차의 항목은 바꾸지 않는다
export class ChecklistTemplate extends ValueObject<readonly ChecklistTemplateItem[]> {
  static create(items: readonly ChecklistTemplateItem[]): ChecklistTemplate {
    if (items.length > TODO_ITEM_LIMITS.MAX_PER_TODO) {
      throw checklistLimitReached(items.length);
    }
    return new ChecklistTemplate(copyItems(items));
  }

  static reconstitute(items: readonly ChecklistTemplateItem[]): ChecklistTemplate {
    return new ChecklistTemplate(copyItems(items));
  }

  toPrimitives(): ChecklistTemplateItem[] {
    return copyItems(this.value);
  }
}
