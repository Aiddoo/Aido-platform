import '@src/shared/i18n/init';
import { createTestQueryClient, renderUi } from '@src/shared/__tests__';
import { screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Suspense } from 'react';

import { MEMO_QUERY_KEYS } from '../queries/memo-query-keys';
import { MemoCreateButton } from './memo-create-button';

describe('MemoCreateButton', () => {
  it('메모 한도에 닿으면 새 메모를 열지 않고 한도와 지우면 다시 쓸 수 있다는 안내를 보여 준다', async () => {
    // Given
    const user = userEvent.setup();
    const queryClient = createTestQueryClient({
      defaultOptions: { queries: { staleTime: Infinity } },
    });
    queryClient.setQueryData(MEMO_QUERY_KEYS.resourceLimit(), { currentCount: 20, maxPerUser: 20 });
    await renderUi(
      <Suspense fallback={null}>
        <MemoCreateButton />
      </Suspense>,
      { queryClient },
    );

    // When
    await user.press(await screen.findByRole('button', { name: '새 메모' }));

    // Then
    expect(await screen.findAllByText('메모는 20개까지 쓸 수 있어요')).not.toHaveLength(0);
    expect(screen.getAllByText('안 쓰는 메모를 지우면 새로 쓸 수 있어요')).not.toHaveLength(0);
    expect(router.push).not.toHaveBeenCalled();
  });
});
