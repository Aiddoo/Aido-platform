import { createPlannedMemo, createPlannedTodo } from '../__tests__/voice.fixtures';
import { getPlanActionGroups, sortPlanActionsByGroup } from './plan-action-group.view-model';

const FALLBACK_CATEGORY_ID = 7;

describe('getPlanActionGroups', () => {
  it.each([
    {
      name: '나뉘어 나온 같은 카테고리는 처음 나온 자리로 모은다',
      categories: [1, 2, 1, 1],
      groups: [
        { categoryId: 1, indexes: [0, 2, 3] },
        { categoryId: 2, indexes: [1] },
      ],
    },
    {
      name: '카테고리가 없는 카드는 시트의 현재 카테고리로 묶는다',
      categories: [null, 2, 7],
      groups: [
        { categoryId: 7, indexes: [0, 2] },
        { categoryId: 2, indexes: [1] },
      ],
    },
    {
      name: '숫자가 큰 카테고리가 먼저 나오면 그 순서를 지킨다',
      categories: [9, 3],
      groups: [
        { categoryId: 9, indexes: [0] },
        { categoryId: 3, indexes: [1] },
      ],
    },
  ])('$name', ({ categories, groups }) => {
    // Given
    const actions = categories.map((categoryId) => createPlannedTodo({ categoryId }));

    // When
    const result = getPlanActionGroups(actions, FALLBACK_CATEGORY_ID);

    // Then
    expect(result).toEqual(groups);
  });

  it('메모는 할 일 사이에 있어도 맨 뒤로 모으고 할 일 묶음을 끊지 않는다', () => {
    // Given
    const actions = [
      createPlannedTodo({ categoryId: 1 }),
      createPlannedMemo(),
      createPlannedTodo({ categoryId: 1 }),
    ];

    // When
    const result = getPlanActionGroups(actions, FALLBACK_CATEGORY_ID);

    // Then
    expect(result).toEqual([
      { categoryId: 1, indexes: [0, 2] },
      { categoryId: null, indexes: [1] },
    ]);
  });
});

describe('sortPlanActionsByGroup', () => {
  it('저장할 카드는 묶어 보인 순서대로 늘어놓는다', () => {
    // Given
    const actions = [
      createPlannedTodo({ actionId: 'a', categoryId: 1 }),
      createPlannedTodo({ actionId: 'b', categoryId: 2 }),
      createPlannedMemo(),
      createPlannedTodo({ actionId: 'c', categoryId: 1 }),
    ];

    // When
    const result = sortPlanActionsByGroup(actions, FALLBACK_CATEGORY_ID);

    // Then
    expect(result.map(({ actionId }) => actionId)).toEqual(['a', 'c', 'b', 'm1']);
  });
});
