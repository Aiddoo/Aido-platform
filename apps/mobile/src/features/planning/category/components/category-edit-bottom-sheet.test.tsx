import '@src/shared/i18n/init';
import {
  createHttpClientStub,
  createTestDi,
  createTestQueryClient,
  deliverQueryNotifications,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { createTodoCategoryWithCount } from '../__tests__/todo-category.fixtures';
import { TODO_CATEGORY_QUERY_KEYS } from '../queries/todo-category-query-keys';
import { CategoryEditBottomSheet } from './category-edit-bottom-sheet';

const CATEGORY_ID = 3;

async function renderEditSheet() {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), {
    categories: [createTodoCategoryWithCount({ id: CATEGORY_ID, name: '운동' })],
  });
  jest.mocked(useLocalSearchParams).mockReturnValue({ categoryId: String(CATEGORY_ID) });

  await renderScreen(<CategoryEditBottomSheet />, {
    di: createTestDi({ ports: { httpClient: createHttpClientStub(), queryClient } }),
    withOverlay: true,
  });

  return { queryClient };
}

describe('CategoryEditBottomSheet', () => {
  it('칸 오류는 고치는 사이 카테고리를 다시 받아도 남는다', async () => {
    // Given
    const { queryClient } = await renderEditSheet();
    fireEvent.changeText(await screen.findByDisplayValue('운동'), '');
    expect(await screen.findByText('카테고리명을 입력해주세요')).toBeTruthy();

    // When
    await act(async () => {
      queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), {
        categories: [
          createTodoCategoryWithCount({ id: CATEGORY_ID, name: '운동', color: '#EF4444' }),
        ],
      });
      await deliverQueryNotifications();
    });

    // Then
    expect(screen.getByText('카테고리명을 입력해주세요')).toBeTruthy();
  });
});
