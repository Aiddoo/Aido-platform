import { NOTIFICATION_CATEGORY } from '@aido/api/vocabulary';
import { createHttpClientStub, createTestQueryClient, renderUi } from '@src/shared/__tests__';
import { screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import NotificationsScreen from '../../../../app/(app)/notifications/index';
import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';

async function renderScreen(category: string) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ category });
  const httpClient = createHttpClientStub();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), 1);

  await renderUi(<NotificationsScreen />, { queryClient, di: { httpClient } });
}

describe('알림 화면의 안 읽은 알림 줄', () => {
  it('안 읽은 수는 모든 분류를 합친 값이라 전체 탭에서 보인다', async () => {
    // When
    await renderScreen(NOTIFICATION_CATEGORY.ALL);

    // Then
    expect(await screen.findByText('읽지 않은 알림')).toBeOnTheScreen();
    expect(screen.getByText('1건')).toBeOnTheScreen();
  });

  it.each([NOTIFICATION_CATEGORY.NOTICE, NOTIFICATION_CATEGORY.TODO, NOTIFICATION_CATEGORY.SOCIAL])(
    '%s 탭에서는 다른 분류의 안 읽은 수를 보이지 않는다',
    async (category) => {
      // When
      await renderScreen(category);

      // Then
      expect(screen.queryByText('읽지 않은 알림')).toBeNull();
    },
  );
});
