import { resolveSheetCategoryId } from './todo-sheet-target.view-model';

const CATEGORIES = [{ id: 3 }, { id: 7 }];

describe('시트의 처음 선택 카테고리', () => {
  it('요청한 카테고리가 남아 있으면 그것을 고른다', () => {
    // Given
    const requestedCategoryId = 7;

    // When
    const categoryId = resolveSheetCategoryId(requestedCategoryId, CATEGORIES);

    // Then
    expect(categoryId).toBe(7);
  });

  it('요청한 카테고리가 지워졌거나 없으면 첫 카테고리를 고른다', () => {
    // Given
    const deletedCategoryId = 99;

    // When
    const fromDeleted = resolveSheetCategoryId(deletedCategoryId, CATEGORIES);
    const fromMissing = resolveSheetCategoryId(null, CATEGORIES);

    // Then
    expect(fromDeleted).toBe(3);
    expect(fromMissing).toBe(3);
  });

  it('카테고리가 하나도 없으면 고를 수 없다', () => {
    // Given
    const requestedCategoryId = 7;

    // When
    const categoryId = resolveSheetCategoryId(requestedCategoryId, []);

    // Then
    expect(categoryId).toBeNull();
  });
});
