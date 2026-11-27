import { renderRouteHook } from '@src/testing/render-route-hook';
import { act } from '@testing-library/react-native';
import { router } from 'expo-router';
import { z } from 'zod';

import { useView } from './use-view';

jest.unmock('expo-router');

const viewSchema = z.enum(['friends', 'receiver']).catch('friends');

describe('useView', () => {
  it('URL 값을 읽는다', async () => {
    // Given
    const url = '/friends?view=receiver';

    // When
    const route = await renderRouteHook(() => useView('view', viewSchema), { url });

    // Then
    expect(route.hook()[0]).toBe('receiver');
  });

  it.each(['/friends', '/friends?view=unknown', '/friends?view=receiver&view=friends'])(
    '없거나 잘못된 값은 .catch의 기본값으로 읽는다: %s',
    async (url) => {
      // When
      const route = await renderRouteHook(() => useView('view', viewSchema), { url });

      // Then
      expect(route.hook()[0]).toBe('friends');
    },
  );

  it('setView는 그 키만 바꾸고 다른 URL 값을 남긴다', async () => {
    // Given
    const route = await renderRouteHook(() => useView('view', viewSchema), {
      url: '/friends?isEditing=true',
    });

    // When
    await route.run(([_view, setView]) => setView('receiver'));

    // Then
    expect(route.url()).toBe('/friends?isEditing=true&view=receiver');
    expect(route.hook()[0]).toBe('receiver');
  });

  it('다른 화면이 위에 열린 뒤 부른 setView는 그 화면이 아니라 훅을 부른 화면에 쓴다', async () => {
    // Given
    const route = await renderRouteHook(() => useView('view', viewSchema), {
      url: '/friends',
      routes: ['notifications'],
    });
    const [, setView] = route.hook();
    await act(async () => router.push('/notifications'));

    // When
    await act(async () => setView('receiver'));

    // Then
    expect(route.url()).toBe('/notifications');

    // When
    await act(async () => router.back());

    // Then
    expect(route.url()).toBe('/friends?view=receiver');
    expect(route.hook()[0]).toBe('receiver');
  });
});
