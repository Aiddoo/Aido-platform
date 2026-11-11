import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createCoachmarkStorage } from '@src/features/device/coachmark/__tests__/coachmark.fixtures';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createAnalyticsStub, createHttpClientStub } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createVoiceNoteDigest } from '../../__tests__/voice-note.fixtures';
import { KeyPointList } from './key-point-list';

function createSameTimeKeyPoints() {
  return [
    { id: 'first', text: '첫 포인트', startMs: 1_200, isBookmarked: false },
    { id: 'second', text: '둘째 포인트', startMs: 1_900, isBookmarked: false },
  ];
}

describe('KeyPointList', () => {
  it('시간 안내를 붙여도 첫 포인트를 누르면 그 지점부터 듣는다', async () => {
    // Given
    const { keyPoints } = createVoiceNoteDigest();
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(createCurrentUserDto()));
    const analytics = createAnalyticsStub();
    const onPressKeyPoint = jest.fn();
    await renderScreen(
      <KeyPointList hasTimeCoachmark keyPoints={keyPoints} onPressKeyPoint={onPressKeyPoint} />,
      {
        di: { httpClient, analytics },
      },
    );
    await waitFor(() =>
      expect(analytics.trackEvent).toHaveBeenCalledWith('coachmark_shown', {
        kind: 'voice-key-point',
      }),
    );

    // When
    await fireEvent.press(screen.getByLabelText('0:12부터 듣기'));

    // Then
    expect(onPressKeyPoint).toHaveBeenCalledWith(keyPoints[0]);
  });

  it('같은 초의 포인트가 이어지면 시간 칩은 첫 포인트에만 보이고 둘 다 눌러서 들을 수 있다', async () => {
    // Given
    const onPressKeyPoint = jest.fn();
    await renderScreen(
      <KeyPointList keyPoints={createSameTimeKeyPoints()} onPressKeyPoint={onPressKeyPoint} />,
    );

    // When
    fireEvent.press(screen.getByText('둘째 포인트'));

    // Then
    expect(screen.getAllByText('0:01')).toHaveLength(1);
    expect(onPressKeyPoint).toHaveBeenCalledWith(expect.objectContaining({ id: 'second' }));
  });

  it('들을 녹음이 없으면 시간 안내를 띄우지 않고 소비하지도 않는다', async () => {
    // Given
    const { keyPoints } = createVoiceNoteDigest();
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(createCurrentUserDto()));
    const analytics = createAnalyticsStub();
    const { syncStorage, repository: coachmarkRepository } = createCoachmarkStorage();

    // When
    await renderScreen(<KeyPointList hasTimeCoachmark keyPoints={keyPoints} />, {
      di: { httpClient, analytics, syncStorage },
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 600);
    });

    // Then
    expect(analytics.trackEvent).not.toHaveBeenCalled();
    expect(
      coachmarkRepository.hasSeen({
        accountId: createCurrentUserDto().userId,
        kind: 'voice-key-point',
      }),
    ).toBe(false);
  });

  it('들을 녹음이 없으면 포인트를 눌러 재생할 수 없다', async () => {
    // Given
    const { keyPoints } = createVoiceNoteDigest();

    // When
    await renderScreen(<KeyPointList keyPoints={keyPoints} />);

    // Then
    expect(screen.queryByLabelText('0:41부터 듣기')).toBeNull();
    expect(screen.getByText('디자인 시안 2개')).toBeTruthy();
  });
});
