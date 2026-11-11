import '@src/shared/i18n/init';
import { createTestQueryClient } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { screen, userEvent } from '@testing-library/react-native';
import { Suspense } from 'react';

import { createTodoCategoryWithCount } from '../__tests__/todo-category.fixtures';
import { TODO_CATEGORY_QUERY_KEYS } from '../queries/todo-category-query-keys';
import { CategorySelectInput } from './category-select-input';

async function renderSelect(onSubmit: (categoryId: number) => void) {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), {
    categories: [
      createTodoCategoryWithCount({ id: 1, name: '개인', sortOrder: 0 }),
      createTodoCategoryWithCount({ id: 2, name: '운동', sortOrder: 1 }),
    ],
  });
  await renderScreen(
    <Suspense fallback={null}>
      <CategorySelectInput defaultValue={1} onSubmit={onSubmit} submitLabel="확인" />
    </Suspense>,
    { queryClient },
  );
}

describe('CategorySelectInput', () => {
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
});
