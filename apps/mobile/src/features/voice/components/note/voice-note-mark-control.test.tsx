import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createCoachmarkStorage } from '@src/features/device/coachmark/__tests__/coachmark.fixtures';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createAnalyticsStub, createHttpClientStub } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Suspense } from 'react';
import { View } from 'react-native';

import { VoiceNoteMarkControl } from './voice-note-mark-control';

const accountId = createCurrentUserDto().userId;

/** 말풍선은 자리를 잰 뒤에야 터치를 받는다. 테스트에는 레이아웃이 없어 직접 알린다 */
async function layoutHint() {
  await fireEvent(screen.getByTestId('hint-popover'), 'layout', {
    nativeEvent: { layout: { x: 16, y: 300, width: 300, height: 120 } },
  });
}

async function renderMarkControl({
  isSeen = false,
  isListening = true,
  markCount = 0,
}: {
  isSeen?: boolean;
  isListening?: boolean;
  markCount?: number;
}) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue(ok(createCurrentUserDto()));
  const { syncStorage, repository: coachmarkRepository } = createCoachmarkStorage(
    isSeen ? [{ accountId, kind: 'voice-note-mark' }] : [],
  );
  const analytics = createAnalyticsStub();
  const onPress = jest.fn();

  await renderScreen(
    <Suspense>
      <VoiceNoteMarkControl markCount={markCount} isListening={isListening} onPress={onPress} />
    </Suspense>,
    { di: { httpClient, syncStorage, analytics } },
  );
  await screen.findByTestId('voice-note-mark');

  return { analytics, coachmarkRepository, onPress };
}

describe('VoiceNoteMarkControl', () => {
  beforeEach(() => {
    jest.spyOn(View.prototype, 'measure').mockImplementation((callback) => {
      if (typeof callback === 'function') {
        callback(0, 0, 100, 40, 200, 600);
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('듣기가 시작되면 처음 안내를 한 번 연다', async () => {
    // When
    const { analytics } = await renderMarkControl({});

    // Then
    await waitFor(() =>
      expect(analytics.trackEvent).toHaveBeenCalledWith('coachmark_shown', {
        kind: 'voice-note-mark',
      }),
    );
  });

  it('듣기 전에는 안내를 열지 않고 눌러도 표시하지 않는다', async () => {
    // Given
    const { analytics, onPress } = await renderMarkControl({ isListening: false });

    // When
    await fireEvent.press(screen.getByTestId('voice-note-mark'));

    // Then
    expect(onPress).not.toHaveBeenCalled();
    expect(analytics.trackEvent).not.toHaveBeenCalled();
  });

  it('안내가 떠 있어도 첫 탭이 표시하고 안내를 끝낸다', async () => {
    // Given
    const { analytics, coachmarkRepository, onPress } = await renderMarkControl({});
    await waitFor(() => expect(analytics.trackEvent).toHaveBeenCalled());

    // When
    await fireEvent.press(screen.getByTestId('voice-note-mark'));

    // Then
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(analytics.trackEvent).toHaveBeenCalledWith('coachmark_dismissed', {
      kind: 'voice-note-mark',
    });
    expect(coachmarkRepository.hasSeen({ accountId, kind: 'voice-note-mark' })).toBe(true);
  });

  it('처음 안내가 끝나면 라벨을 눌러 같은 설명을 다시 본다', async () => {
    // Given
    await renderMarkControl({ isSeen: true });

    // When
    await fireEvent.press(screen.getByTestId('voice-note-mark-info'));

    // Then
    expect(await screen.findByText('중요한 말이 나오면 눌러보세요')).toBeTruthy();
    expect(screen.getByLabelText('닫기')).toBeTruthy();
  });

  it('처음 안내를 X로 닫아도 다시 열리지 않는다', async () => {
    // Given
    const { coachmarkRepository, onPress } = await renderMarkControl({});
    await screen.findByTestId('hint-popover');
    await layoutHint();

    // When
    await fireEvent.press(screen.getByLabelText('닫기'));

    // Then
    await waitFor(() => expect(screen.queryByText('중요한 말이 나오면 눌러보세요')).toBeNull());
    expect(coachmarkRepository.hasSeen({ accountId, kind: 'voice-note-mark' })).toBe(true);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('처음 안내는 바깥을 막지 않고, 다시 본 설명은 바깥을 누르면 닫힌다', async () => {
    // Given
    await renderMarkControl({});
    await screen.findByTestId('hint-popover');
    expect(screen.queryByTestId('hint-popover-overlay')).toBeNull();
    await fireEvent.press(screen.getByTestId('voice-note-mark'));

    // When
    await fireEvent.press(screen.getByTestId('voice-note-mark-info'));
    const overlay = await screen.findByTestId('hint-popover-overlay');
    await fireEvent.press(overlay);

    // Then
    await waitFor(() => expect(screen.queryByTestId('hint-popover')).toBeNull());
  });

  it('처음 안내가 떠 있는 동안에는 ⓘ를 열 수 없다', async () => {
    // Given
    await renderMarkControl({});

    // When
    await screen.findByLabelText('닫기');

    // Then
    expect(screen.getByTestId('voice-note-mark-info')).toBeDisabled();
  });
});
