import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import {
  createTodoDto,
  createTodoListResponseDto,
} from '@src/features/planning/todo/__tests__/todo.fixtures';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createPushNotificationGatewayStub,
  createTestDi,
  respondByPath,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, screen } from '@testing-library/react-native';
import { Suspense } from 'react';

import { createPushPermissionResponse } from '../__tests__/notification.fixtures';
import { PushPermissionNotice } from './push-permission-notice';

describe('PushPermissionNotice', () => {
  // 오늘(서울) 09:00. 18:00 할 일이 아직 남아 거절한 사용자에게 카드가 보인다
  setupFakeTimersPerTest({ now: new Date('2026-03-08T00:00:00.000Z') });

  it('알림이 갈 할 일이 없어져 숨었다 다시 생겨 보여도 같은 단계는 한 번만 센다', async () => {
    // Given
    const todos = { current: createTodoListResponseDto() };
    const httpClient = createHttpClientStub();
    httpClient.get.mockImplementation(
      respondByPath({
        'v1/auth/me': ok(createCurrentUserDto()),
        'v1/auth/preference': ok(createPreferenceDto()),
        'v1/todos': async () => ok(todos.current),
      }),
    );
    const pushNotification = createPushNotificationGatewayStub();
    pushNotification.getPermission.mockResolvedValue(
      createPushPermissionResponse({ status: 'denied', canAskAgain: true }),
    );
    const analytics = createAnalyticsStub();
    const { queryClient } = await renderScreen(
      <Suspense fallback={null}>
        <PushPermissionNotice />
      </Suspense>,
      {
        di: createTestDi({ ports: { httpClient, pushNotification, analytics } }),
        withLocalDate: true,
      },
    );
    await screen.findByRole('button', { name: '계속' });
    const setTodoCompleted = async (completed: boolean) => {
      todos.current = createTodoListResponseDto({ items: [createTodoDto({ completed })] });
      await act(async () => {
        await queryClient.refetchQueries();
        // fake timer라 TanStack이 미룬 구독자 알림(setTimeout 0)을 직접 흘린다
        await jest.advanceTimersByTimeAsync(0);
      });
    };

    // When
    await setTodoCompleted(true);
    await setTodoCompleted(false);

    // Then
    expect(await screen.findByRole('button', { name: '계속' })).toBeOnTheScreen();
    expect(analytics.trackEvent.mock.calls).toEqual([
      ['push_permission_prompt_shown', { source: 'feed_card', step: 'REQUEST_SYSTEM' }],
    ]);
  });
});
