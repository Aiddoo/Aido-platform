import '@src/shared/i18n/init';
import { ok, unwrap } from '@src/core/errors/result';
import { createCoachmarkRecords } from '@src/features/device/coachmark/__tests__/coachmark.fixtures';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createMemoryObservableSyncStorage,
  createTestDi,
} from '@src/testing/core';
import { createTestQueryClient } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { RepeatHorizonHint } from './repeat-horizon-hint';

const accountId = createCurrentUserDto().userId;
const INFO_TITLE = '3개월 뒤 할 일은 아직 안 보여요';

/** 말풍선은 자리를 잰 뒤에야 터치를 받는다. 테스트에는 레이아웃이 없어 직접 알린다 */
async function layoutHint() {
  await fireEvent(screen.getByTestId('hint-popover'), 'layout', {
    nativeEvent: { layout: { x: 16, y: 340, width: 300, height: 120 } },
  });
}

async function renderHint({
  hasRepeat = true,
  isSeen = false,
}: {
  hasRepeat?: boolean;
  isSeen?: boolean;
}) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue(
    ok({ hasTodo: true, hasCompletedTodo: false, hasActiveRepeat: hasRepeat }),
  );
  const userHttpClient = createHttpClientStub();
  userHttpClient.get.mockResolvedValue(ok(createCurrentUserDto()));
  // 내 정보가 오면 CoachmarkPopover가 대상을 Popover 안으로 옮겨 다시 마운트한다.
  // 그 전에 찾은 줄은 떨어져 나가 눌러도 아무 일이 없으므로, 앱처럼 캐시에 넣고 시작한다.
  const queryClient = createTestQueryClient();
  const { userApi } = createTestDi({ ports: { httpClient: userHttpClient } });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), unwrap(await userApi.getCurrentUser()));
  const syncStorage = createMemoryObservableSyncStorage();
  const coachmarkRepository = createCoachmarkRecords(syncStorage);
  if (isSeen) {
    coachmarkRepository.markSeen({ accountId, kind: 'repeat-horizon' });
  }
  const analytics = createAnalyticsStub();

  const hint = (date: string) => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ date });
    return <RepeatHorizonHint />;
  };
  const { rerender } = await renderScreen(hint('2027-03-01'), {
    di: createTestDi({ ports: { httpClient, syncStorage, analytics, queryClient } }),
    withLocalDate: true,
  });

  return {
    analytics,
    isCoachmarkPending: () => !coachmarkRepository.hasSeen({ accountId, kind: 'repeat-horizon' }),
    httpClient,
    moveTo: (date: string) => rerender(hint(date)),
  };
}

describe('RepeatHorizonHint', () => {
  beforeEach(() => {
    jest.spyOn(View.prototype, 'measure').mockImplementation((callback) => {
      if (typeof callback === 'function') {
        callback(0, 0, 200, 20, 16, 300);
      }
    });
  });

  // measure는 이미 jest.fn이라 restoreMocks가 되돌리지 못한다
  afterEach(() => {
    jest.mocked(View.prototype.measure).mockReset();
  });

  it('반복 할 일이 있으면 설명을 처음 한 번 자동으로 연다', async () => {
    // When
    const { analytics } = await renderHint({});

    // Then
    expect(await screen.findByText(INFO_TITLE, {}, { timeout: 2_000 })).toBeTruthy();
    expect(analytics.trackEvent).toHaveBeenCalledWith('coachmark_shown', {
      kind: 'repeat-horizon',
    });
  });

  it('진행 중 반복은 90일 치 목록을 받지 않고 서버 개요 한 번으로 묻는다', async () => {
    // When
    const { httpClient } = await renderHint({});
    await screen.findByText(INFO_TITLE, {}, { timeout: 2_000 });

    // Then
    const todoRequests = httpClient.get.mock.calls
      .map(([url]) => url)
      .filter((url) => url.startsWith('v1/todos'));
    expect(todoRequests).toEqual(['v1/todos/overview']);
  });

  it('달을 빠르게 넘겨도 멈춘 달에서 다시 연다', async () => {
    // Given
    const { moveTo } = await renderHint({});
    await screen.findByText(INFO_TITLE, {}, { timeout: 2_000 });

    // When
    await moveTo('2027-04-01');
    await moveTo('2027-05-01');

    // Then
    await waitFor(() => expect(screen.queryByText(INFO_TITLE)).toBeNull());
    expect(await screen.findByText(INFO_TITLE, {}, { timeout: 2_000 })).toBeTruthy();
  });

  describe('반복 할 일이 없을 때', () => {
    setupFakeTimersPerTest({ advanceTimers: true });

    it('반복 할 일이 없으면 자동으로 열지 않고 안내를 남겨 둔다', async () => {
      // Given
      const { analytics, isCoachmarkPending, httpClient } = await renderHint({ hasRepeat: false });

      // When
      await waitFor(() => expect(httpClient.get).toHaveBeenCalled());
      await act(() => jest.advanceTimersByTimeAsync(600));

      // Then
      expect(screen.queryByText(INFO_TITLE)).toBeNull();
      expect(analytics.trackEvent).not.toHaveBeenCalled();
      expect(isCoachmarkPending()).toBe(true);
    });
  });

  it('X로 닫으면 안내가 끝나고 줄을 눌러 다시 본다', async () => {
    // Given
    const { isCoachmarkPending } = await renderHint({});
    await screen.findByTestId('hint-popover', {}, { timeout: 2_000 });
    await layoutHint();
    await fireEvent.press(screen.getByLabelText('닫기'));
    await waitFor(() => expect(screen.queryByText(INFO_TITLE)).toBeNull());
    expect(isCoachmarkPending()).toBe(false);

    // When
    await fireEvent.press(screen.getByTestId('repeat-horizon-hint'));

    // Then
    expect(await screen.findByText(INFO_TITLE)).toBeTruthy();
  });

  it('이미 본 계정은 자동으로 열지 않지만 줄을 눌러 볼 수 있다', async () => {
    // Given
    await renderHint({ isSeen: true });
    expect(screen.queryByText(INFO_TITLE)).toBeNull();

    // When
    await fireEvent.press(await screen.findByTestId('repeat-horizon-hint'));

    // Then
    expect(await screen.findByText(INFO_TITLE, {}, { timeout: 2_000 })).toBeTruthy();
    expect(
      screen.getByText('반복이 끝난 건 아니에요. 날짜가 가까워지면 자동으로 생겨요.'),
    ).toBeTruthy();
  });
});
