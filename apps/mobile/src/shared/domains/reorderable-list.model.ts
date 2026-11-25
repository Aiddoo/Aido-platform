const MIN_REORDERABLE_COUNT = 2;

/** 하나뿐인 목록은 옮길 자리가 없다. 순서 바꾸기와 그 안내는 둘 이상일 때만 있다 */
export function canReorderItems(itemCount: number): boolean {
  return itemCount >= MIN_REORDERABLE_COUNT;
}
