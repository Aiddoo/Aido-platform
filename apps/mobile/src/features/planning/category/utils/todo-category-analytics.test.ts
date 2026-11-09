import { getCategoryUpdatedField } from './todo-category-analytics';

describe('카테고리 수정 지표의 field', () => {
  it('색이 그대로면 name이다', () => {
    // Given
    const category = { color: '#3B82F6' };

    // When
    const field = getCategoryUpdatedField(category, { color: '#3B82F6' });

    // Then
    expect(field).toBe('name');
  });

  it('색이 달라졌거나 기존 값을 모르면 color다', () => {
    // Given
    const category = { color: '#3B82F6' };

    // When
    const changed = getCategoryUpdatedField(category, { color: '#51CF66' });
    const unknown = getCategoryUpdatedField(null, { color: '#51CF66' });

    // Then
    expect(changed).toBe('color');
    expect(unknown).toBe('color');
  });

  it('색을 보내지 않으면 name이다', () => {
    // Given
    const category = { color: '#3B82F6' };

    // When
    const field = getCategoryUpdatedField(category, {});

    // Then
    expect(field).toBe('name');
  });
});
