import '@src/shared/i18n/init';
import {
  createErrorReporterStub,
  createMemorySyncStorage,
  createMockAnalytics,
  createMockHttpClient,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import InviteCodeEntryRoute from '../../../../app/invite';
import { createAllDoneBannerRepository } from '../apis/all-done-banner.repository';
import { createInstallReferrerRepository } from '../apis/install-referrer.repository';
import { InviteService } from '../apis/invite.service';
import { createPawPrintCelebrationRepository } from '../apis/paw-print-celebration.repository';
import { createPendingRedemptionRepository } from '../apis/pending-redemption.repository';
import { INVITE_QUERY_KEYS } from '../constants/invite-query-keys';
import { parseInviteCode } from '../domains/invite.model';

const CODE = parseInviteCode('K7M2QX') ?? '';

function createInviteService() {
  const storage = createMemorySyncStorage();
  const inviteService = new InviteService({
    publicHttpClient: createMockHttpClient(),
    authHttpClient: createMockHttpClient(),
    pendingRedemptionRepository: createPendingRedemptionRepository(storage),
    installReferrerRepository: createInstallReferrerRepository(storage, {
      read: () => Promise.resolve(null),
    }),
    pawPrintCelebrationRepository: createPawPrintCelebrationRepository(storage),
    installationIdGateway: { get: () => Promise.resolve(null) },
    allDoneBannerRepository: createAllDoneBannerRepository(storage),
    logger: { warn: () => undefined },
  });
  return { inviteService };
}

describe('초대 코드 입력 화면', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  test('오프라인이면 조회를 시작하지 않아 버튼이 돌며 멈추지 않는다', async () => {
    // Given
    const { inviteService } = createInviteService();
    const queryClient = createTestQueryClient();
    onlineManager.setOnline(false);
    await renderUi(<InviteCodeEntryRoute />, {
      di: {
        analytics: createMockAnalytics(),
        errorReporter: createErrorReporterStub(),
        clipboard: {
          hasContent: () => Promise.resolve(true),
          paste: () => Promise.resolve(CODE),
          copy: () => Promise.resolve(),
        },
        inviteService,
      },
      queryClient,
    });
    await fireEvent.press(await screen.findByText('복사한 코드 붙여넣기'));
    await waitFor(() => expect(screen.getByTestId('invite-code-submit')).toBeEnabled());

    // When
    await fireEvent.press(screen.getByTestId('invite-code-submit'));

    // Then
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(
      queryClient.getQueryState(INVITE_QUERY_KEYS.preview({ inviteCode: CODE })),
    ).toBeUndefined();
  });
});
