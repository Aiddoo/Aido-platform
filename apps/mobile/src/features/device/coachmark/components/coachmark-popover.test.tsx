import '@src/shared/i18n/init';
import { createCoachmarkRepository } from '@src/features/device/coachmark/apis/coachmark.repository';
import { CoachmarkService } from '@src/features/device/coachmark/apis/coachmark.service';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.factories';
import { UserService } from '@src/features/identity/user/apis/user.service';
import {
  createMemorySyncStorage,
  createMockAnalytics,
  createMockHttpClient,
} from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { ok } from '@src/shared/errors/result';
import { Text } from '@src/shared/ui';
import { act, screen, waitFor } from '@testing-library/react-native';
import { useIsFocused } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { useEffect } from 'react';
import { Keyboard, type KeyboardEvent, View } from 'react-native';

import { CoachmarkPopover } from './coachmark-popover';

async function renderCoachmark({ isSeen }: { isSeen: boolean }) {
  const httpClient = createMockHttpClient();
  httpClient.get.mockResolvedValue(ok(createCurrentUserDto()));
  const coachmarkService = new CoachmarkService(
    createCoachmarkRepository(createMemorySyncStorage()),
  );
  if (isSeen) {
    coachmarkService.complete({
      accountId: createCurrentUserDto().userId,
      kind: 'voice-quick-start',
    });
  }
  const analytics = createMockAnalytics();

  await renderUi(
    <CoachmarkPopover kind="voice-quick-start" title="안내 제목" description="안내 설명">
      <Text testID="target">마이크</Text>
    </CoachmarkPopover>,
    { di: { coachmarkService, analytics, userService: new UserService(httpClient) } },
  );

  return { analytics };
}

const KEYBOARD_DID_SHOW: KeyboardEvent = {
  duration: 250,
  easing: 'keyboard',
  startCoordinates: { screenX: 0, screenY: 800, width: 400, height: 300 },
  endCoordinates: { screenX: 0, screenY: 500, width: 400, height: 300 },
  isEventFromThisApp: true,
};

/** 말풍선은 포커스 뒤 450ms를 기다렸다가 연다 */
const POPOVER_WAIT = { timeout: 2_000 };

async function renderCoachmarkOnHiddenTab() {
  jest.mocked(useIsFocused).mockReturnValue(false);
  const httpClient = createMockHttpClient();
  httpClient.get.mockResolvedValue(ok(createCurrentUserDto()));
  const coachmarkService = new CoachmarkService(
    createCoachmarkRepository(createMemorySyncStorage()),
  );
  const analytics = createMockAnalytics();
  const coachmark = () => (
    <CoachmarkPopover kind="voice-note-start" title="안내 제목" description="안내 설명">
      <PressableFeedback testID="target" />
    </CoachmarkPopover>
  );
  const { rerender } = await renderUi(coachmark(), {
    di: { coachmarkService, analytics, userService: new UserService(httpClient) },
  });

  return {
    analytics,
    isPending: () =>
      coachmarkService.isPending({
        accountId: createCurrentUserDto().userId,
        kind: 'voice-note-start',
      }),
    changeFocus: async (isFocused: boolean) => {
      jest.mocked(useIsFocused).mockReturnValue(isFocused);
      await rerender(coachmark());
    },
  };
}

describe('CoachmarkPopover', () => {
  it('내 정보를 읽은 뒤에도 대상을 다시 마운트하지 않아 누르던 탭을 잃지 않는다', async () => {
    // Given
    const httpClient = createMockHttpClient();
    let resolveMe: (value: ReturnType<typeof ok>) => void = jest.fn();
    httpClient.get.mockReturnValue(
      new Promise((resolve) => {
        resolveMe = resolve;
      }),
    );
    const onMount = jest.fn();
    const onUnmount = jest.fn();
    const Target = () => {
      useEffect(() => {
        onMount();
        return onUnmount;
      }, []);

      return <Text testID="target">마이크</Text>;
    };
    await renderUi(
      <CoachmarkPopover kind="voice-note-start" title="안내 제목" description="안내 설명">
        <Target />
      </CoachmarkPopover>,
      {
        di: {
          coachmarkService: new CoachmarkService(
            createCoachmarkRepository(createMemorySyncStorage()),
          ),
          analytics: createMockAnalytics(),
          userService: new UserService(httpClient),
        },
      },
    );
    expect(onMount).toHaveBeenCalledTimes(1);

    // When
    await act(async () => resolveMe(ok(createCurrentUserDto())));

    // Then
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onUnmount).not.toHaveBeenCalled();
  });

  it('내 정보를 읽기 전에는 기능 소개에서 왔어도 열지 않는다', async () => {
    // Given
    const httpClient = createMockHttpClient();
    httpClient.get.mockReturnValue(new Promise(() => undefined));
    const analytics = createMockAnalytics();

    // When
    await renderUi(
      <CoachmarkPopover kind="voice-quick-start" title="안내 제목" description="안내 설명" isForced>
        <Text testID="target">마이크</Text>
      </CoachmarkPopover>,
      {
        di: {
          coachmarkService: new CoachmarkService(
            createCoachmarkRepository(createMemorySyncStorage()),
          ),
          analytics,
          userService: new UserService(httpClient),
        },
      },
    );
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 600);
      });
    });

    // Then
    expect(screen.getByTestId('target')).toBeTruthy();
    expect(screen.queryByTestId('hint-popover')).toBeNull();
    expect(analytics.trackEvent).not.toHaveBeenCalledWith('coachmark_shown', expect.anything());
  });

  describe('탭이나 화면의 포커스', () => {
    beforeEach(() => {
      jest.spyOn(View.prototype, 'measure').mockImplementation((callback) => {
        if (typeof callback === 'function') {
          callback(0, 0, 44, 44, 16, 300);
        }
      });
    });

    afterEach(() => {
      jest.mocked(useIsFocused).mockReturnValue(true);
    });

    it('포커스가 없는 탭에서는 열지 않고 소비하지 않는다', async () => {
      // Given
      const { analytics, isPending } = await renderCoachmarkOnHiddenTab();

      // When
      await act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 600);
        });
      });

      // Then
      expect(screen.queryByTestId('hint-popover')).toBeNull();
      expect(analytics.trackEvent).not.toHaveBeenCalledWith('coachmark_shown', expect.anything());
      expect(isPending()).toBe(true);
    });

    it('포커스를 얻으면 자리를 잰 뒤에 연다', async () => {
      // Given
      const { analytics, changeFocus } = await renderCoachmarkOnHiddenTab();

      // When
      await changeFocus(true);

      // Then
      expect(analytics.trackEvent).not.toHaveBeenCalledWith('coachmark_shown', expect.anything());
      expect(await screen.findByTestId('hint-popover', {}, POPOVER_WAIT)).toBeTruthy();
      expect(analytics.trackEvent).toHaveBeenCalledWith('coachmark_shown', {
        kind: 'voice-note-start',
      });
    });

    it('열린 뒤 포커스를 잃으면 닫히지만 끝난 것으로 남기지 않는다', async () => {
      // Given
      const { analytics, changeFocus, isPending } = await renderCoachmarkOnHiddenTab();
      await changeFocus(true);
      await screen.findByTestId('hint-popover', {}, POPOVER_WAIT);

      // When
      await changeFocus(false);

      // Then
      await waitFor(() => expect(screen.queryByTestId('hint-popover')).toBeNull());
      expect(analytics.trackEvent).not.toHaveBeenCalledWith(
        'coachmark_dismissed',
        expect.anything(),
      );
      expect(isPending()).toBe(true);
    });

    it('키보드가 올라와 대상이 움직이면 닫았다가 자리를 다시 재서 열고 노출은 한 번만 남긴다', async () => {
      // Given
      const addKeyboardListener = jest.spyOn(Keyboard, 'addListener');
      const measure = jest.mocked(View.prototype.measure);
      const { analytics, changeFocus, isPending } = await renderCoachmarkOnHiddenTab();
      await changeFocus(true);
      await screen.findByTestId('hint-popover', {}, POPOVER_WAIT);
      measure.mockClear();

      // When
      await act(async () => {
        addKeyboardListener.mock.calls
          .filter(([event]) => event === 'keyboardDidShow')
          .forEach(([_event, listener]) => listener(KEYBOARD_DID_SHOW));
      });

      // Then
      await waitFor(() => expect(screen.queryByTestId('hint-popover')).toBeNull());
      expect(await screen.findByTestId('hint-popover', {}, POPOVER_WAIT)).toBeTruthy();
      expect(measure).toHaveBeenCalled();
      expect(isPending()).toBe(true);
      expect(
        analytics.trackEvent.mock.calls.filter(([name]) => name === 'coachmark_shown'),
      ).toHaveLength(1);
    });

    it('닫아서 소비하지 않았으면 탭으로 돌아왔을 때 다시 연다', async () => {
      // Given
      const { changeFocus } = await renderCoachmarkOnHiddenTab();
      await changeFocus(true);
      await screen.findByTestId('hint-popover', {}, POPOVER_WAIT);
      await changeFocus(false);
      await waitFor(() => expect(screen.queryByTestId('hint-popover')).toBeNull());

      // When
      await changeFocus(true);

      // Then
      expect(await screen.findByTestId('hint-popover', {}, POPOVER_WAIT)).toBeTruthy();
    });
  });

  it('이미 본 안내도 기능 소개에서 왔으면 다시 열고 노출을 남긴다', async () => {
    // Given
    const httpClient = createMockHttpClient();
    httpClient.get.mockResolvedValue(ok(createCurrentUserDto()));
    const coachmarkService = new CoachmarkService(
      createCoachmarkRepository(createMemorySyncStorage()),
    );
    coachmarkService.complete({
      accountId: createCurrentUserDto().userId,
      kind: 'voice-quick-start',
    });
    const analytics = createMockAnalytics();

    // When
    await renderUi(
      <CoachmarkPopover kind="voice-quick-start" title="안내 제목" description="안내 설명" isForced>
        <Text testID="target">마이크</Text>
      </CoachmarkPopover>,
      { di: { coachmarkService, analytics, userService: new UserService(httpClient) } },
    );

    // Then
    await waitFor(() =>
      expect(analytics.trackEvent).toHaveBeenCalledWith('coachmark_shown', {
        kind: 'voice-quick-start',
      }),
    );
  });

  it('아직 못 본 안내는 자동으로 열고 노출을 한 번 남긴다', async () => {
    // When
    const { analytics } = await renderCoachmark({ isSeen: false });

    // Then
    await waitFor(() =>
      expect(analytics.trackEvent).toHaveBeenCalledWith('coachmark_shown', {
        kind: 'voice-quick-start',
      }),
    );
  });

  it('사용자가 다른 일을 시작하면(isDismissed) 안내를 끝내 다시 열지 않는다', async () => {
    // Given
    const httpClient = createMockHttpClient();
    httpClient.get.mockResolvedValue(ok(createCurrentUserDto()));
    const coachmarkService = new CoachmarkService(
      createCoachmarkRepository(createMemorySyncStorage()),
    );
    const analytics = createMockAnalytics();
    const accountId = createCurrentUserDto().userId;
    const renderHint = (isDismissed: boolean) => (
      <CoachmarkPopover
        kind="voice-quick-start"
        title="안내 제목"
        description="안내 설명"
        isPassThrough
        isDismissed={isDismissed}
      >
        <Text testID="target">마이크</Text>
      </CoachmarkPopover>
    );
    const { rerender } = await renderUi(renderHint(false), {
      di: { coachmarkService, analytics, userService: new UserService(httpClient) },
    });
    await waitFor(() =>
      expect(analytics.trackEvent).toHaveBeenCalledWith('coachmark_shown', {
        kind: 'voice-quick-start',
      }),
    );

    // When
    rerender(renderHint(true));

    // Then
    await waitFor(() =>
      expect(analytics.trackEvent).toHaveBeenCalledWith('coachmark_dismissed', {
        kind: 'voice-quick-start',
      }),
    );
    expect(coachmarkService.isPending({ accountId, kind: 'voice-quick-start' })).toBe(false);
  });

  describe('가리키던 자리를 옮기면', () => {
    const OPENED_AT = 1_000_000;

    async function renderMovableCoachmark() {
      const httpClient = createMockHttpClient();
      httpClient.get.mockResolvedValue(ok(createCurrentUserDto()));
      const coachmarkService = new CoachmarkService(
        createCoachmarkRepository(createMemorySyncStorage()),
      );
      const analytics = createMockAnalytics();
      const coachmark = (dismissKey: string) => (
        <CoachmarkPopover
          kind="repeat-horizon"
          title="안내 제목"
          description="안내 설명"
          dismissKey={dismissKey}
        >
          <Text testID="target">대상</Text>
        </CoachmarkPopover>
      );
      const { rerender } = await renderUi(coachmark('2027-03-01'), {
        di: { coachmarkService, analytics, userService: new UserService(httpClient) },
      });
      await waitFor(() =>
        expect(analytics.trackEvent).toHaveBeenCalledWith('coachmark_shown', {
          kind: 'repeat-horizon',
        }),
      );

      return {
        analytics,
        move: (dismissKey: string) => rerender(coachmark(dismissKey)),
        isPending: () =>
          coachmarkService.isPending({
            accountId: createCurrentUserDto().userId,
            kind: 'repeat-horizon',
          }),
      };
    }

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('충분히 본 뒤에는 닫고 끝난 것으로 남긴다', async () => {
      // Given
      const dateNow = jest.spyOn(Date, 'now').mockReturnValue(OPENED_AT);
      const { analytics, move, isPending } = await renderMovableCoachmark();
      dateNow.mockReturnValue(OPENED_AT + 2_000);

      // When
      await move('2027-03-02');

      // Then
      await waitFor(() =>
        expect(analytics.trackEvent).toHaveBeenCalledWith('coachmark_dismissed', {
          kind: 'repeat-horizon',
        }),
      );
      expect(isPending()).toBe(false);
    });

    it('스쳐 지나가면 끝난 것으로 남기지 않고 멈춘 뒤 다시 연다', async () => {
      // Given
      const dateNow = jest.spyOn(Date, 'now').mockReturnValue(OPENED_AT);
      const { analytics, move, isPending } = await renderMovableCoachmark();
      dateNow.mockReturnValue(OPENED_AT + 300);

      // When
      await move('2027-04-01');

      // Then
      expect(analytics.trackEvent).not.toHaveBeenCalledWith('coachmark_dismissed', {
        kind: 'repeat-horizon',
      });
      expect(isPending()).toBe(true);
      await waitFor(() => expect(screen.queryByTestId('hint-popover')).toBeNull());
      expect(await screen.findByTestId('hint-popover', {}, POPOVER_WAIT)).toBeTruthy();
    });
  });

  it('이미 본 안내는 열지 않고 대상만 그린다', async () => {
    // When
    const { analytics } = await renderCoachmark({ isSeen: true });

    // Then
    expect(await screen.findByTestId('target')).toBeTruthy();
    expect(analytics.trackEvent).not.toHaveBeenCalled();
  });
});
