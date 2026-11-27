import { canReorderItems } from './reorderable-list.model';

describe('canReorderItems', () => {
  it.each([
    { title: '할 일이 없으면 순서를 바꿀 수 없다', ids: [], expected: false },
    { title: '할 일이 하나뿐이면 순서를 바꿀 수 없다', ids: [1], expected: false },
    { title: '할 일이 둘이면 순서를 바꿀 수 있다', ids: [1, 2], expected: true },
  ])('$title', ({ ids, expected }) => {
    // When
    const result = canReorderItems(ids.length);

    // Then
    expect(result).toBe(expected);
  });
});
