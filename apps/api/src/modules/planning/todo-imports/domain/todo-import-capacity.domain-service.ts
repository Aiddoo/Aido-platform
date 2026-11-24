import { groupBy, sumBy } from "es-toolkit";

export interface TodoImportCapacityShortage {
  readonly targetKey: string;
  readonly current: number;
  readonly expected: number;
  readonly limit: number;
}

/**
 * 대상 카테고리마다 지금 할 일 수와 기기가 센 일정 수를 더해 한도를 넘는 대상을 고른다.
 * 새 카테고리(categoryId null)는 비어 있다고 본다. 실제 생성은 남는 자리만큼 받고 나머지는 건너뛴다
 */
export function planTargetCapacity(params: {
  readonly targets: readonly { readonly targetKey: string; readonly categoryId: number | null }[];
  readonly collections: readonly {
    readonly targetKey: string;
    readonly expectedItemCount: number;
  }[];
  readonly usageByCategory: ReadonlyMap<number, number>;
  readonly limitPerCategory: number;
}): TodoImportCapacityShortage[] {
  const { targets, usageByCategory, limitPerCategory } = params;
  const collectionsByTarget = groupBy(params.collections, (collection) => collection.targetKey);
  return targets.flatMap((target) => {
    const current = target.categoryId == null ? 0 : (usageByCategory.get(target.categoryId) ?? 0);
    const expected = sumBy(
      collectionsByTarget[target.targetKey] ?? [],
      (collection) => collection.expectedItemCount,
    );
    if (current + expected <= limitPerCategory) {
      return [];
    }
    return [{ targetKey: target.targetKey, current, expected, limit: limitPerCategory }];
  });
}
