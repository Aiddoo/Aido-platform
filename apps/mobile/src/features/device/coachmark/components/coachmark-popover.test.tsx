import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { Text } from '@src/shared/ui';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createPendingResponse,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, screen, waitFor } from '@testing-library/react-native';
import { useIsFocused } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { useEffect } from 'react';
import { Keyboard, type KeyboardEvent, View } from 'react-native';

import { createCoachmarkStorage } from '../__tests__/coachmark.fixtures';
import { CoachmarkPopover } from './coachmark-popover';

async function renderCoachmark({ isSeen }: { isSeen: boolean }) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue(ok(createCurrentUserDto()));
  const { syncStorage } = createCoachmarkStorage(
    isSeen ? [{ accountId: createCurrentUserDto().userId, kind: 'voice-quick-start' }] : [],
  );
  const analytics = createAnalyticsStub();

  await renderScreen(
    <CoachmarkPopover kind="voice-quick-start" title="안내 제목" description="안내 설명">
      <Text testID="target">마이크</Text>
    </CoachmarkPopover>,
    { di: createTestDi({ ports: { httpClient, syncStorage, analytics } }) },
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
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue(ok(createCurrentUserDto()));
  const { syncStorage, records: coachmarkRecords } = createCoachmarkStorage();
  const analytics = createAnalyticsStub();
  const coachmark = () => (
    <CoachmarkPopover kind="voice-note-start" title="안내 제목" description="안내 설명">
      <PressableFeedback testID="target" />
    </CoachmarkPopover>
  );
  const { rerender } = await renderScreen(coachmark(), {
    di: createTestDi({ ports: { httpClient, syncStorage, analytics } }),
  });

  return {
    analytics,
    isPending: () =>
      !coachmarkRecords.hasSeen({
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
  // RN의 measure는 이미 jest.fn이라 restoreMocks가 구현을 되돌리지 못한다. 쓰고 나면 직접 비운다
  beforeEach(() => {
    jest.spyOn(View.prototype, 'measure').mockImplementation((callback) => {
      if (typeof callback === 'function') {
        callback(0, 0, 44, 44, 16, 300);
      }
    });
  });

  afterEach(() => {
    jest.mocked(View.prototype.measure).mockReset();
  });

  it('내 정보를 읽은 뒤에도 대상을 다시 마운트하지 않아 누르던 탭을 잃지 않는다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    const me = createPendingResponse(ok(createCurrentUserDto()));
    httpClient.get.mockReturnValue(me.response);
    const onMount = jest.fn();
    const onUnmount = jest.fn();
    const Target = () => {
      useEffect(() => {
        onMount();
        return onUnmount;
      }, []);

      return <Text testID="target">마이크</Text>;
    };
    await renderScreen(
      <CoachmarkPopover kind="voice-note-start" title="안내 제목" description="안내 설명">
        <Target />
      </CoachmarkPopover>,
      { di: createTestDi({ ports: { httpClient, analytics: createAnalyticsStub() } }) },
    );
    expect(onMount).toHaveBeenCalledTimes(1);

    // When
    await act(async () => me.settle());

    // Then
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onUnmount).not.toHaveBeenCalled();
  });

  describe('내 정보를 읽는 중', () => {
    setupFakeTimersPerTest();

    it('내 정보를 읽기 전에는 기능 소개에서 왔어도 열지 않는다', async () => {
      // Given
      const httpClient = createHttpClientStub();
      httpClient.get.mockReturnValue(new Promise(() => undefined));
      const analytics = createAnalyticsStub();

      // When
      await renderScreen(
        <CoachmarkPopover
          kind="voice-quick-start"
          title="안내 제목"
          description="안내 설명"
          isForced
        >
          <Text testID="target">마이크</Text>
        </CoachmarkPopover>,
        { di: createTestDi({ ports: { httpClient, analytics } }) },
      );
      await act(() => jest.advanceTimersByTimeAsync(600));

      // Then
      expect(screen.getByTestId('target')).toBeTruthy();
      expect(screen.queryByTestId('hint-popover')).toBeNull();
      expect(analytics.trackEvent).not.toHaveBeenCalledWith('coachmark_shown', expect.anything());
    });
  });

  describe('탭이나 화면의 포커스', () => {
    afterEach(() => {
      jest.mocked(useIsFocused).mockReturnValue(true);
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
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(createCurrentUserDto()));
    const { syncStorage } = createCoachmarkStorage([
      { accountId: createCurrentUserDto().userId, kind: 'voice-quick-start' },
    ]);
    const analytics = createAnalyticsStub();

    // When
    await renderScreen(
      <CoachmarkPopover kind="voice-quick-start" title="안내 제목" description="안내 설명" isForced>
        <Text testID="target">마이크</Text>
      </CoachmarkPopover>,
      { di: createTestDi({ ports: { httpClient, syncStorage, analytics } }) },
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
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(createCurrentUserDto()));
    const { syncStorage, records: coachmarkRecords } = createCoachmarkStorage();
    const analytics = createAnalyticsStub();
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
    const { rerender } = await renderScreen(renderHint(false), {
      di: createTestDi({ ports: { httpClient, syncStorage, analytics } }),
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
    expect(coachmarkRecords.hasSeen({ accountId, kind: 'voice-quick-start' })).toBe(true);
  });

  it('이미 본 안내는 열지 않고 대상만 그린다', async () => {
    // When
    const { analytics } = await renderCoachmark({ isSeen: true });

    // Then
    expect(await screen.findByTestId('target')).toBeTruthy();
    expect(analytics.trackEvent).not.toHaveBeenCalled();
  });
});
