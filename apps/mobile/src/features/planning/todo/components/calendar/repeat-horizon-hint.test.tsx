import { TODO_SERIES_LIMITS } from '@aido/api/vocabulary';
import '@src/shared/i18n/init';
import { createCoachmarkRepository } from '@src/features/device/coachmark/apis/coachmark.repository';
import { CoachmarkService } from '@src/features/device/coachmark/apis/coachmark.service';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.factories';
import { UserService } from '@src/features/identity/user/apis/user.service';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import {
  createErrorReporterStub,
  createMemorySyncStorage,
  createAnalyticsStub,
  createHttpClientStub,
} from '@src/shared/__tests__';
import { createTestQueryClient, renderUi } from '@src/shared/__tests__/render-ui';
import { addDaysToDateKey } from '@src/shared/date/date-key';
import { ok, unwrap } from '@src/shared/errors/result';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { View } from 'react-native';

import { createTodoDto, createTodoListResponseDto } from '../../__tests__/todo.factories';
import { TodoService } from '../../apis/todo.service';
import { FeedDateProvider } from '../providers/feed-date-provider';
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
    ok(
      createTodoListResponseDto({
        items: [createTodoDto({ recurrenceGroupId: hasRepeat ? 'group-1' : null })],
      }),
    ),
  );
  const userHttpClient = createHttpClientStub();
  userHttpClient.get.mockResolvedValue(ok(createCurrentUserDto()));
  const userService = new UserService(userHttpClient);
  // 내 정보가 오면 CoachmarkPopover가 대상을 Popover 안으로 옮겨 다시 마운트한다.
  // 그 전에 찾은 줄은 떨어져 나가 눌러도 아무 일이 없으므로, 앱처럼 캐시에 넣고 시작한다.
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(USER_QUERY_KEYS.me(), unwrap(await userService.getCurrentUser()));
  const coachmarkService = new CoachmarkService(
    createCoachmarkRepository(createMemorySyncStorage()),
  );
  if (isSeen) {
    coachmarkService.complete({ accountId, kind: 'repeat-horizon' });
  }
  const analytics = createAnalyticsStub();

  const hint = (date: string) => (
    <LocalDateProvider>
      <FeedDateProvider date={date} onDateChange={jest.fn()}>
        <RepeatHorizonHint />
      </FeedDateProvider>
    </LocalDateProvider>
  );
  const { rerender } = await renderUi(hint('2027-03-01'), {
    di: {
      coachmarkService,
      analytics,
      errorReporter: createErrorReporterStub(),
      todoService: new TodoService(httpClient),
      userService,
    },
    queryClient,
  });

  return {
    analytics,
    coachmarkService,
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

  afterEach(() => {
    jest.restoreAllMocks();
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

  it('매월처럼 먼 규칙이나 다음 달에 시작하는 규칙도 찾도록 미리 만드는 범위 전체를 묻는다', async () => {
    // Given
    const today = '2026-11-05';
    jest.useFakeTimers({ now: new Date(2026, 10, 5, 9), advanceTimers: true });

    // When
    const { httpClient } = await renderHint({});

    // Then
    await waitFor(() => expect(httpClient.get).toHaveBeenCalled());
    const [, options] = httpClient.get.mock.lastCall ?? [];
    expect(options).toMatchObject({
      params: {
        startDate: today,
        endDate: addDaysToDateKey(today, TODO_SERIES_LIMITS.VISIBLE_AHEAD_DAYS),
      },
    });
    jest.useRealTimers();
  });

  it.each([
    { name: '연달아 넘기는 간격', visibleMs: 300, isConsumed: false },
    { name: '읽기 전에 넘긴 경우', visibleMs: 1_900, isConsumed: false },
    { name: '읽을 시간을 준 뒤 넘긴 경우', visibleMs: 2_000, isConsumed: true },
  ])('달을 넘길 때 $name: 안내를 끝냈는지 $isConsumed', async ({ visibleMs, isConsumed }) => {
    // Given
    const openedAt = Date.now();
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(openedAt);
    const { analytics, coachmarkService, moveTo } = await renderHint({});
    await screen.findByText(INFO_TITLE, {}, { timeout: 2_000 });
    dateNow.mockReturnValue(openedAt + visibleMs);

    // When
    await moveTo('2027-04-01');

    // Then
    expect(coachmarkService.isPending({ accountId, kind: 'repeat-horizon' })).toBe(!isConsumed);
    expect(analytics.trackEvent).toHaveBeenCalledTimes(isConsumed ? 2 : 1);
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

  it('반복 할 일이 없으면 자동으로 열지 않고 안내를 남겨 둔다', async () => {
    // Given
    const { analytics, coachmarkService, httpClient } = await renderHint({ hasRepeat: false });

    // When
    await waitFor(() => expect(httpClient.get).toHaveBeenCalled());
    await new Promise((resolve) => {
      setTimeout(resolve, 600);
    });

    // Then
    expect(screen.queryByText(INFO_TITLE)).toBeNull();
    expect(analytics.trackEvent).not.toHaveBeenCalled();
    expect(coachmarkService.isPending({ accountId, kind: 'repeat-horizon' })).toBe(true);
  });

  it('X로 닫으면 안내가 끝나고 줄을 눌러 다시 본다', async () => {
    // Given
    const { coachmarkService } = await renderHint({});
    await screen.findByTestId('hint-popover', {}, { timeout: 2_000 });
    await layoutHint();
    await fireEvent.press(screen.getByLabelText('닫기'));
    await waitFor(() => expect(screen.queryByText(INFO_TITLE)).toBeNull());
    expect(coachmarkService.isPending({ accountId, kind: 'repeat-horizon' })).toBe(false);

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
