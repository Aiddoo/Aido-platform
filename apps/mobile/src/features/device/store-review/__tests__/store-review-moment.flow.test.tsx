/**
 * @jest-environment <rootDir>/jest.time-zone-environment.cjs
 * @time-zone Asia/Seoul
 */
import '@src/shared/i18n/init';
import { useRunTodoReminderAction } from '@src/features/notification/hooks/use-run-todo-reminder-action';
import {
  createRouteParamsFake,
  setupFakeTimersPerTest,
  stubWindowDimensions,
} from '@src/testing/core';
import { renderScreen, renderScreenHook } from '@src/testing/render';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { KeyboardController } from 'react-native-keyboard-controller';

import FeedScreen from '../../../../../app/(app)/(tabs)/(todos)/feed/index';
import TodoDetailRoute from '../../../../../app/(app)/todo/[todoId]';
import {
  createReviewReadyApp,
  LAST_OPEN_TODO,
  REVIEW_NOW,
  REVIEW_TODAY,
} from './store-review.test-utils';

// 할 일 완료가 일어나는 곳마다 OS 리뷰 창을 묻는지 고정한다. 날씨 브리핑은 실제 라우터가 필요해 store-review-weather.flow.test.tsx에 있다
describe('오늘의 마지막 할 일을 끝낸 곳마다 리뷰를 묻는가', () => {
  setupFakeTimersPerTest({ now: REVIEW_NOW, advanceTimers: true });

  beforeEach(() => {
    stubWindowDimensions(390);
  });

  // 공식 mock의 jest.fn이라 restoreMocks가 되돌리지 않는다
  afterEach(() => {
    jest.mocked(KeyboardController.isVisible).mockReturnValue(false);
  });

  it('피드의 할 일 줄 체크로 끝내면 묻는다', async () => {
    // Given
    createRouteParamsFake({});
    const app = createReviewReadyApp();
    await renderScreen(<FeedScreen />, { di: app.di, withLocalDate: true, withOverlay: true });

    // When
    await fireEvent.press(await screen.findByTestId(`todo-checkbox-${LAST_OPEN_TODO.id}`));
    await waitFor(() => expect(app.completedTodoRequests()).toHaveLength(1));
    await app.settleReviewWait();

    // Then
    expect(app.completedTodoRequests()).toEqual([['v1/todos/7/complete', { completed: true }]]);
    expect(app.appStoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('피드에서 끝냈어도 기다리는 사이 키보드가 올라와 있으면 묻지 않는다', async () => {
    // Given
    createRouteParamsFake({});
    const app = createReviewReadyApp();
    await renderScreen(<FeedScreen />, { di: app.di, withLocalDate: true, withOverlay: true });
    jest.mocked(KeyboardController.isVisible).mockReturnValue(true);

    // When
    await fireEvent.press(await screen.findByTestId(`todo-checkbox-${LAST_OPEN_TODO.id}`));
    await waitFor(() => expect(app.completedTodoRequests()).toHaveLength(1));
    await app.settleReviewWait();

    // Then
    expect(app.appStoreReview.requestReview).not.toHaveBeenCalled();
  });

  it('할 일 상세의 체크로 끝내면 묻는다', async () => {
    // Given
    jest.mocked(useLocalSearchParams).mockReturnValue({ todoId: String(LAST_OPEN_TODO.id) });
    const app = createReviewReadyApp();
    await renderScreen(<TodoDetailRoute />, { di: app.di, withLocalDate: true, withOverlay: true });

    // When
    await fireEvent.press(await screen.findByTestId('todo-detail-checkbox'));
    await waitFor(() => expect(app.completedTodoRequests()).toHaveLength(1));
    await app.settleReviewWait();

    // Then
    expect(app.completedTodoRequests()).toEqual([['v1/todos/7/complete', { completed: true }]]);
    expect(app.appStoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('리마인드 알림의 [완료]로 끝내면 묻는다', async () => {
    // Given
    const app = createReviewReadyApp();
    const { result } = await renderScreenHook(() => useRunTodoReminderAction(), {
      di: app.di,
      withLocalDate: true,
    });

    // When
    await act(() =>
      result.current({ type: 'complete', todoId: LAST_OPEN_TODO.id, dateKey: REVIEW_TODAY }),
    );
    await app.settleReviewWait();

    // Then
    expect(app.completedTodoRequests()).toEqual([['v1/todos/7/complete', { completed: true }]]);
    expect(app.appStoreReview.requestReview).toHaveBeenCalledTimes(1);
  });
});
