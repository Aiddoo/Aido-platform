import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createCoachmarkRepository } from '@src/features/device/coachmark/apis/coachmark.repository';
import { CoachmarkService } from '@src/features/device/coachmark/apis/coachmark.service';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { UserService } from '@src/features/identity/user/apis/user.service';
import {
  createMemorySyncStorage,
  createAnalyticsStub,
  createHttpClientStub,
} from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
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
  const coachmarkService = new CoachmarkService(
    createCoachmarkRepository(createMemorySyncStorage()),
  );
  if (isSeen) {
    coachmarkService.complete({ accountId, kind: 'voice-note-mark' });
  }
  const analytics = createAnalyticsStub();
  const onPress = jest.fn();

  await renderUi(
    <Suspense>
      <VoiceNoteMarkControl markCount={markCount} isListening={isListening} onPress={onPress} />
    </Suspense>,
    { di: { coachmarkService, analytics, userService: new UserService(httpClient) } },
  );
  await screen.findByTestId('voice-note-mark');

  return { analytics, coachmarkService, onPress };
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
    const { analytics, coachmarkService, onPress } = await renderMarkControl({});
    await waitFor(() => expect(analytics.trackEvent).toHaveBeenCalled());

    // When
    await fireEvent.press(screen.getByTestId('voice-note-mark'));

    // Then
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(analytics.trackEvent).toHaveBeenCalledWith('coachmark_dismissed', {
      kind: 'voice-note-mark',
    });
    expect(coachmarkService.isPending({ accountId, kind: 'voice-note-mark' })).toBe(false);
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
    const { coachmarkService, onPress } = await renderMarkControl({});
    await screen.findByTestId('hint-popover');
    await layoutHint();

    // When
    await fireEvent.press(screen.getByLabelText('닫기'));

    // Then
    await waitFor(() => expect(screen.queryByText('중요한 말이 나오면 눌러보세요')).toBeNull());
    expect(coachmarkService.isPending({ accountId, kind: 'voice-note-mark' })).toBe(false);
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

  it('표시한 문장이 있으면 라벨과 스크린리더가 개수를 말한다', async () => {
    // When
    await renderMarkControl({ isSeen: true, markCount: 2 });

    // Then
    expect(screen.getByText('중요 표시 2')).toBeTruthy();
    expect(screen.getByTestId('voice-note-mark-active')).toBeTruthy();
    expect(screen.getByLabelText('중요 표시, 지금까지 2개')).toBeTruthy();
  });

  it('표시한 문장이 없으면 개수를 숨긴다', async () => {
    // When
    await renderMarkControl({ isSeen: true });

    // Then
    expect(screen.getByText('중요 표시')).toBeTruthy();
    expect(screen.queryByText(/중요 표시 \d/)).toBeNull();
    expect(screen.queryByTestId('voice-note-mark-active')).toBeNull();
  });
});
