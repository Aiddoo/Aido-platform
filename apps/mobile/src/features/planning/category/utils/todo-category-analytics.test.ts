import { getCategoryUpdatedField } from './todo-category-analytics';

describe('카테고리 수정 지표의 field', () => {
  test('색이 그대로면 name이다', () => {
    // Given
    const category = { color: '#3B82F6' };

    // When
    const field = getCategoryUpdatedField(category, { color: '#3B82F6' });

    // Then
    expect(field).toBe('name');
  });

  test('색이 달라졌거나 기존 값을 모르면 color다', () => {
    // Given
    const category = { color: '#3B82F6' };

    // When & Then
    expect(getCategoryUpdatedField(category, { color: '#51CF66' })).toBe('color');
    expect(getCategoryUpdatedField(null, { color: '#51CF66' })).toBe('color');
  });

  test('색을 보내지 않으면 name이다', () => {
    // When & Then
    expect(getCategoryUpdatedField({ color: '#3B82F6' }, {})).toBe('name');
  });
});
