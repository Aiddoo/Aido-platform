import { renderHook } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useNotificationDirectionParam } from './use-notification-direction-param';

jest.mock('expo-router', () => ({
  router: { setParams: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

const mockedUseLocalSearchParams = jest.mocked(useLocalSearchParams);

describe('useNotificationDirectionParam', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('URL의 direction=sent를 보낸 콕으로 읽는다', async () => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue({ category: 'SOCIAL', direction: 'sent' });

    // When
    const { result } = await renderHook(() => useNotificationDirectionParam());

    // Then
    expect(result.current[0]).toBe('sent');
  });

  it.each([{}, { direction: 'unknown' }, { direction: ['sent', 'received'] }])(
    'direction이 없거나 잘못되면 받은 알림으로 본다: %j',
    async (params) => {
      // Given
      mockedUseLocalSearchParams.mockReturnValue(params);

      // When
      const { result } = await renderHook(() => useNotificationDirectionParam());

      // Then
      expect(result.current[0]).toBe('received');
    },
  );

  it('setter는 URL의 direction param을 바꾼다', async () => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue({});
    const { result } = await renderHook(() => useNotificationDirectionParam());

    // When
    result.current[1]('sent');

    // Then
    expect(router.setParams).toHaveBeenCalledWith({ direction: 'sent' });
  });
});
