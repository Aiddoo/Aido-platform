import '@src/shared/i18n/init';
import { fail, ok } from '@src/core/errors/result';
import { createEntitlementSnapshotDto } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createTodoCategoryListDto } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import {
  createTodoApiError,
  createTodoDto,
} from '@src/features/planning/todo/__tests__/todo.fixtures';
import {
  countGetRequests,
  layoutSheetRoute,
} from '@src/features/planning/todo/__tests__/todo.test-utils';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createPushNotificationGatewayStub,
  createTestDi,
  respondByPath,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import TodoCreateSheetRoute from '../../../../../app/(app)/todo/new';

const PLACEHOLDER = '무엇을 하고 싶나요?';
const TODAY = '2026-10-27';

async function renderCreateRoute() {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(
    respondByPath({
      'v1/todo-categories': ok(createTodoCategoryListDto()),
      'v1/auth/me': ok(createCurrentUserDto()),
      'v1/entitlements': ok(createEntitlementSnapshotDto()),
      'v1/auth/preference': ok(createPreferenceDto()),
    }),
  );
  httpClient.post.mockResolvedValue(ok({ message: 'ok', todo: createTodoDto({ id: 9 }) }));
  // 아직 알림 권한을 묻지 않은 기기
  const pushNotification = createPushNotificationGatewayStub({
    getPermission: jest.fn(async () => ({
      status: 'undetermined' as const,
      canAskAgain: true,
      iosStatus: null,
    })),
  });
  const analytics = createAnalyticsStub();
  jest.mocked(useLocalSearchParams).mockReturnValue({ date: TODAY });

  await renderScreen(<TodoCreateSheetRoute />, {
    withLocalDate: true,
    di: createTestDi({ ports: { httpClient, pushNotification, analytics } }),
  });
  await layoutSheetRoute();
  await screen.findByPlaceholderText(PLACEHOLDER);
  // 카테고리 칩이 이름을 받은 뒤 고른다
  await screen.findByText('기본');

  return { httpClient, pushNotification, analytics };
}

function countEvents(analytics: ReturnType<typeof createAnalyticsStub>, eventName: string) {
  return analytics.trackEvent.mock.calls.filter(([name]) => name === eventName).length;
}

async function typeTitle(title: string) {
  await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), title);
}

async function save() {
  await fireEvent.press(screen.getByTestId('todo-add-submit'));
}

async function press(text: string) {
  await userEvent.press(await screen.findByText(text));
}

async function openPicker(chipLabel: string) {
  await userEvent.press(await screen.findByRole('button', { name: chipLabel }));
}

describe('TodoCreateSheetRoute', () => {
  setupFakeTimersPerTest({ now: new Date(2026, 9, 27, 9), advanceTimers: true });

  it('제목만 적고 저장하면 고른 날짜의 공개 종일 할 일을 첫 카테고리로 한 번 만들고 한 번 남긴다', async () => {
    // Given
    const { httpClient, analytics } = await renderCreateRoute();
    await typeTitle('우유 사기');

    // When
    await save();
    await act(() => jest.advanceTimersByTimeAsync(1_000));

    // Then
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
    expect(httpClient.post).toHaveBeenCalledWith('v1/todos', {
      title: '우유 사기',
      categoryId: 1,
      startDate: TODAY,
      isAllDay: true,
      visibility: 'PUBLIC',
    });
    expect(countEvents(analytics, 'todo_created')).toBe(1);
  });

  it('제목이 비어 있으면 저장 버튼이 꺼지고 요청을 보내지 않는다', async () => {
    // Given
    const { httpClient } = await renderCreateRoute();
    await typeTitle('   ');

    // When
    await save();
    await act(() => jest.advanceTimersByTimeAsync(1_000));

    // Then
    expect(screen.getByTestId('todo-add-submit')).toBeDisabled();
    expect(httpClient.post).not.toHaveBeenCalled();
  });

  it('날짜를 내일로 고르고 시간을 정하면 그 날짜와 시각으로 보내고, 시간을 정할 때 알림 권한을 묻는다', async () => {
    // Given
    const { httpClient, pushNotification } = await renderCreateRoute();
    await typeTitle('병원 가기');

    // When
    await openPicker('오늘');
    await press('내일');
    await openPicker('종일');
    await press('시간 선택');
    await press('확인');
    await save();

    // Then
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
    expect(httpClient.post.mock.calls[0]?.[1]).toMatchObject({
      title: '병원 가기',
      startDate: '2026-10-28',
      scheduledTime: '09:00',
      isAllDay: false,
    });
    expect(pushNotification.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('반복을 매일 계속으로 고르면 반복 규칙을 실어 보낸다', async () => {
    // Given
    const { httpClient } = await renderCreateRoute();
    httpClient.post.mockResolvedValue(fail(createTodoApiError()));
    await typeTitle('물 마시기');

    // When
    await openPicker('반복');
    await press('매일');
    await press('계속 반복');
    await press('확인');
    await save();

    // Then
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
    expect(httpClient.post.mock.calls[0]?.[1]).toMatchObject({
      title: '물 마시기',
      startDate: TODAY,
      repeat: { frequency: 'DAILY', end: { type: 'NEVER' } },
    });
  });

  it('카테고리 고르기 시트에서 고른 카테고리와 비공개로 바꾼 공개 범위를 보낸다', async () => {
    // Given
    const { httpClient } = await renderCreateRoute();
    await typeTitle('보고서 쓰기');

    // When
    console.log('A');
    await openPicker('기본');
    console.log('B');
    await fireEvent.press(await screen.findByTestId('category-select-option-2'));
    console.log('C');
    await fireEvent.press(screen.getByTestId('category-select-submit'));
    await press('공개');
    await save();

    // Then
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
    expect(httpClient.post.mock.calls[0]?.[1]).toMatchObject({
      title: '보고서 쓰기',
      categoryId: 2,
      visibility: 'PRIVATE',
    });
  });

  it('시트를 열 때 조회는 카테고리·내 정보·요금제·설정을 한 번씩만 부른다', async () => {
    // Given
    const { httpClient } = await renderCreateRoute();

    // When
    await act(() => jest.advanceTimersByTimeAsync(1_000));

    // Then
    expect(countGetRequests(httpClient)).toEqual({
      'v1/todo-categories': 1,
      'v1/auth/me': 1,
      'v1/entitlements': 1,
      'v1/auth/preference': 1,
    });
  });
});
