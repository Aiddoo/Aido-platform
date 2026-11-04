import '@src/shared/i18n/init';
import { createCoachmarkRepository } from '@src/features/feature-discovery/apis/coachmark.repository';
import { CoachmarkService } from '@src/features/feature-discovery/apis/coachmark.service';
import { createCurrentUserDto } from '@src/features/user/__tests__/user.factories';
import { UserService } from '@src/features/user/apis/user.service';
import {
  createErrorReporterStub,
  createMemorySyncStorage,
  createMockAnalytics,
  createMockHttpClient,
} from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { ok } from '@src/shared/errors/result';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { View } from 'react-native';

import { createTodoDto, createTodoListResponseDto } from '../../__tests__/todo.factories';
import { TodoService } from '../../apis/todo.service';
import { FeedDateProvider } from '../providers/feed-date-provider';
import { RepeatHorizonHint } from './repeat-horizon-hint';

const accountId = createCurrentUserDto().userId;
const INFO_TITLE = '멀리 있는 날짜는 아직 비어 있어요';

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
  const httpClient = createMockHttpClient();
  httpClient.get.mockResolvedValue(
    ok(
      createTodoListResponseDto({
        items: [createTodoDto({ recurrenceGroupId: hasRepeat ? 'group-1' : null })],
      }),
    ),
  );
  const userHttpClient = createMockHttpClient();
  userHttpClient.get.mockResolvedValue(ok(createCurrentUserDto()));
  const coachmarkService = new CoachmarkService(
    createCoachmarkRepository(createMemorySyncStorage()),
  );
  if (isSeen) {
    coachmarkService.complete({ accountId, kind: 'repeat-horizon' });
  }
  const analytics = createMockAnalytics();

  await renderUi(
    <LocalDateProvider>
      <FeedDateProvider date="2027-03-01" onDateChange={jest.fn()}>
        <RepeatHorizonHint />
      </FeedDateProvider>
    </LocalDateProvider>,
    {
      di: {
        coachmarkService,
        analytics,
        errorReporter: createErrorReporterStub(),
        todoService: new TodoService(httpClient),
        userService: new UserService(userHttpClient),
      },
    },
  );

  return { analytics, coachmarkService, httpClient };
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
    expect(await screen.findByText(INFO_TITLE)).toBeTruthy();
    expect(
      screen.getByText('날짜가 가까워지면 자동으로 이어서 보여요. 반복이 끝난 게 아니에요.'),
    ).toBeTruthy();
  });
});
