import '@src/shared/i18n/init';
import { createTestQueryClient, createTestDi } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { screen, userEvent } from '@testing-library/react-native';
import { type ComponentProps, Suspense } from 'react';

import { createTodoCategoryWithCount } from '../__tests__/todo-category.fixtures';
import { TodoCategoryPolicy } from '../domains/todo-category.model';
import { TODO_CATEGORY_QUERY_KEYS } from '../queries/todo-category-query-keys';
import { CategoryPickForm } from './category-pick-form';

async function renderSelect(
  onSubmit: (categoryId: number) => void,
  { filters }: Pick<ComponentProps<typeof CategoryPickForm>, 'filters'> = {},
) {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), {
    categories: [
      createTodoCategoryWithCount({ id: 1, name: '개인', sortOrder: 0 }),
      createTodoCategoryWithCount({ id: 2, name: '운동', sortOrder: 1 }),
      createTodoCategoryWithCount({ id: -1, name: '저장 중', sortOrder: 2 }),
    ],
  });
  await renderScreen(
    <Suspense fallback={null}>
      <CategoryPickForm defaultValue={1} onSubmit={onSubmit} submitLabel="확인" filters={filters} />
    </Suspense>,
    { di: createTestDi({ ports: { queryClient } }) },
  );
}

describe('CategoryPickForm', () => {
  it('카테고리를 라디오로 알리고 고른 카테고리를 제출한다', async () => {
    // Given
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    await renderSelect(onSubmit);

    // When
    await user.press(await screen.findByRole('radio', { name: '운동' }));
    await user.press(screen.getByRole('button', { name: '확인' }));

    // Then
    expect(screen.getByRole('radio', { name: '운동' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByRole('radio', { name: '개인' }).props.accessibilityState).toMatchObject({
      checked: false,
    });
    expect(onSubmit).toHaveBeenCalledWith(2);
  });

  it('지우는 카테고리의 옮길 곳을 고를 때는 그 카테고리와 저장 중인 임시 행을 보이지 않는다', async () => {
    // Given
    const deleting = createTodoCategoryWithCount({ id: 2, name: '운동', sortOrder: 1 });

    // When
    await renderSelect(jest.fn(), {
      filters: (category) => TodoCategoryPolicy.isMoveTarget(category, deleting),
    });

    // Then
    expect(await screen.findByRole('radio', { name: '개인' })).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { name: '운동' })).toBeNull();
    expect(screen.queryByRole('radio', { name: '저장 중' })).toBeNull();
  });
});
