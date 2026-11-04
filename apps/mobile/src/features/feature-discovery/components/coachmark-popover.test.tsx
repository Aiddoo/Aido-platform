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
import { Text } from '@src/shared/ui';
import { screen, waitFor } from '@testing-library/react-native';

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

describe('CoachmarkPopover', () => {
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

  it('이미 본 안내는 열지 않고 대상만 그린다', async () => {
    // When
    const { analytics } = await renderCoachmark({ isSeen: true });

    // Then
    expect(await screen.findByTestId('target')).toBeTruthy();
    expect(analytics.trackEvent).not.toHaveBeenCalled();
  });
});
