import '@src/shared/i18n/init';
import { createCoachmarkRepository } from '@src/features/feature-discovery/apis/coachmark.repository';
import { CoachmarkService } from '@src/features/feature-discovery/apis/coachmark.service';
import { createCurrentUserDto } from '@src/features/user/__tests__/user.factories';
import { UserService } from '@src/features/user/apis/user.service';
import {
  createMemorySyncStorage,
  createMockAnalytics,
  createMockHttpClient,
} from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { ok } from '@src/shared/errors/result';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createVoiceNoteDigest } from '../../__tests__/voice-note.factories';
import { KeyPointList } from './key-point-list';

describe('KeyPointList', () => {
  it('시간 안내를 붙여도 첫 포인트를 누르면 그 지점부터 듣는다', async () => {
    // Given
    const { keyPoints } = createVoiceNoteDigest();
    const httpClient = createMockHttpClient();
    httpClient.get.mockResolvedValue(ok(createCurrentUserDto()));
    const analytics = createMockAnalytics();
    const onPressKeyPoint = jest.fn();
    await renderUi(
      <KeyPointList hasTimeCoachmark keyPoints={keyPoints} onPressKeyPoint={onPressKeyPoint} />,
      {
        di: {
          analytics,
          userService: new UserService(httpClient),
          coachmarkService: new CoachmarkService(
            createCoachmarkRepository(createMemorySyncStorage()),
          ),
        },
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

  it('핵심 포인트를 누르면 그 포인트를 알려 그 지점부터 듣게 한다', async () => {
    // Given
    const { keyPoints } = createVoiceNoteDigest();
    const onPressKeyPoint = jest.fn();
    await renderUi(<KeyPointList keyPoints={keyPoints} onPressKeyPoint={onPressKeyPoint} />);

    // When
    fireEvent.press(screen.getByLabelText('0:41부터 듣기'));

    // Then
    expect(onPressKeyPoint).toHaveBeenCalledWith(keyPoints[1]);
  });

  it('들을 녹음이 없으면 시간 안내를 띄우지 않고 소비하지도 않는다', async () => {
    // Given
    const { keyPoints } = createVoiceNoteDigest();
    const httpClient = createMockHttpClient();
    httpClient.get.mockResolvedValue(ok(createCurrentUserDto()));
    const analytics = createMockAnalytics();
    const coachmarkService = new CoachmarkService(
      createCoachmarkRepository(createMemorySyncStorage()),
    );

    // When
    await renderUi(<KeyPointList hasTimeCoachmark keyPoints={keyPoints} />, {
      di: { analytics, coachmarkService, userService: new UserService(httpClient) },
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 600);
    });

    // Then
    expect(analytics.trackEvent).not.toHaveBeenCalled();
    expect(
      coachmarkService.isPending({
        accountId: createCurrentUserDto().userId,
        kind: 'voice-key-point',
      }),
    ).toBe(true);
  });

  it('재생 중인 포인트만 선택된 상태로 알린다', async () => {
    // Given
    const { keyPoints } = createVoiceNoteDigest();

    // When
    await renderUi(
      <KeyPointList
        keyPoints={keyPoints}
        activeKeyPointId="key-point-2"
        onPressKeyPoint={jest.fn()}
      />,
    );

    // Then
    expect(screen.getByLabelText('0:41부터 듣기')).toBeSelected();
    expect(screen.getByLabelText('0:12부터 듣기')).not.toBeSelected();
  });

  it('들을 녹음이 없으면 포인트를 눌러 재생할 수 없다', async () => {
    // Given
    const { keyPoints } = createVoiceNoteDigest();

    // When
    await renderUi(<KeyPointList keyPoints={keyPoints} />);

    // Then
    expect(screen.queryByLabelText('0:41부터 듣기')).toBeNull();
    expect(screen.getByText('디자인 시안 2개')).toBeTruthy();
  });
});
