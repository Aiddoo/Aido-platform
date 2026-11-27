/**
 * @jest-environment <rootDir>/jest.time-zone-environment.cjs
 * @time-zone Asia/Seoul
 */
import '@src/shared/i18n/init';
import { setupFakeTimersPerTest, stubWindowDimensions } from '@src/testing/core';
import { renderAppRoute } from '@src/testing/render-route-hook';
import { Stack } from 'expo-router';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import WeatherScreen from '../../../../../app/(app)/weather/index';
import { createReviewReadyApp, LAST_OPEN_TODO, REVIEW_NOW } from './store-review.test-utils';

// 날씨 화면은 네이티브 헤더 높이를 읽어 실제 라우터 위에 올린다
jest.unmock('expo-router');

describe('날씨 브리핑에서 오늘의 마지막 할 일을 끝내면', () => {
  setupFakeTimersPerTest({ now: REVIEW_NOW, advanceTimers: true });

  it('할 일 체크로 끝내면 리뷰를 묻는다', async () => {
    // Given
    stubWindowDimensions(390);
    const app = createReviewReadyApp();
    await renderAppRoute(
      {
        _layout: () => <Stack screenOptions={{ animation: 'none' }} />,
        'weather/index': WeatherScreen,
        'weather/reschedule': () => null,
        'todo/new': () => null,
        'todo/[todoId]/actions': () => null,
      },
      { url: '/weather', di: app.di, withLocalDate: true, withOverlay: true },
    );

    // When
    await fireEvent.press(await screen.findByRole('checkbox', { name: LAST_OPEN_TODO.title }));
    await waitFor(() => expect(app.completedTodoRequests()).toHaveLength(1));
    await app.settleReviewWait();

    // Then
    expect(app.completedTodoRequests()).toEqual([['v1/todos/7/complete', { completed: true }]]);
    expect(app.appStoreReview.requestReview).toHaveBeenCalledTimes(1);
  });
});
