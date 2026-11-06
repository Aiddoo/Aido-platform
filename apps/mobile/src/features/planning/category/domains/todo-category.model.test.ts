import { TodoCategoryPolicy } from './todo-category.model';

const CATEGORIES = [{ id: 3 }, { id: 7 }];

describe('시트의 처음 선택 카테고리', () => {
  it('요청한 카테고리가 남아 있으면 그것을 고른다', () => {
    // Given
    const requestedCategoryId = 7;

    // When
    const categoryId = TodoCategoryPolicy.getInitialCategoryId(CATEGORIES, requestedCategoryId);

    // Then
    expect(categoryId).toBe(7);
  });

  it('요청한 카테고리가 지워졌거나 없으면 첫 카테고리를 고른다', () => {
    // Given
    const deletedCategoryId = 99;

    // When
    const fromDeleted = TodoCategoryPolicy.getInitialCategoryId(CATEGORIES, deletedCategoryId);
    const fromMissing = TodoCategoryPolicy.getInitialCategoryId(CATEGORIES, null);

    // Then
    expect(fromDeleted).toBe(3);
    expect(fromMissing).toBe(3);
  });

  it('카테고리가 하나도 없으면 고를 수 없다', () => {
    // When
    const categoryId = TodoCategoryPolicy.getInitialCategoryId([], 7);

    // Then
    expect(categoryId).toBeNull();
  });
});

describe('시트가 가리키는 카테고리', () => {
  it('목록에 있으면 찾고 지워졌으면 null이다', () => {
    // When
    const found = TodoCategoryPolicy.findCategory(CATEGORIES, 7);
    const deleted = TodoCategoryPolicy.findCategory(CATEGORIES, 99);

    // Then
    expect(found).toEqual({ id: 7 });
    expect(deleted).toBeNull();
  });
});

describe('카테고리 수정 저장', () => {
  const category = { name: '업무', color: '#EF4444' };

  it('이름과 색이 그대로면 바뀐 값이 없다', () => {
    // When
    const changed = TodoCategoryPolicy.hasChanges(category, { name: '업무', color: '#EF4444' });

    // Then
    expect(changed).toBe(false);
  });

  it('이름이나 색 하나라도 다르면 바뀐 값이 있다', () => {
    // When
    const renamed = TodoCategoryPolicy.hasChanges(category, { name: '개인', color: '#EF4444' });
    const recolored = TodoCategoryPolicy.hasChanges(category, { name: '업무', color: '#3B82F6' });

    // Then
    expect(renamed).toBe(true);
    expect(recolored).toBe(true);
  });
});
