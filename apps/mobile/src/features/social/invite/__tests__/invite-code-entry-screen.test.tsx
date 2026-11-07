import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import {
  createAnalyticsStub,
  createClipboardGatewayStub,
  createErrorReporterStub,
  createHttpClientStub,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import InviteCodeEntryRoute from '../../../../../app/invite';
import { INVITE_QUERY_KEYS } from '../constants/invite-query-keys';
import { InviteCodePolicy } from '../domains/invite-code.model';
import { createInvitePreviewDto } from './invite.fixtures';

const CODE = InviteCodePolicy.parseInviteCode('K7M2QX') ?? '';

function createPasteableClipboard() {
  const clipboard = createClipboardGatewayStub();
  clipboard.hasContent.mockResolvedValue(true);
  clipboard.paste.mockResolvedValue(CODE);
  return clipboard;
}

describe('초대 코드 입력 화면', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('오프라인이면 조회를 시작하지 않아 버튼이 돌며 멈추지 않는다', async () => {
    // Given
    const queryClient = createTestQueryClient();
    onlineManager.setOnline(false);
    await renderUi(<InviteCodeEntryRoute />, {
      di: {
        analytics: createAnalyticsStub(),
        errorReporter: createErrorReporterStub(),
        clipboard: createPasteableClipboard(),
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

  it('유효한 코드를 확인하면 미리보기를 캐시에 두고 초대 카드로 이동한다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(createInvitePreviewDto()));
    const queryClient = createTestQueryClient();
    await renderUi(<InviteCodeEntryRoute />, {
      di: {
        httpClient,
        analytics: createAnalyticsStub(),
        errorReporter: createErrorReporterStub(),
        clipboard: createPasteableClipboard(),
      },
      queryClient,
    });
    await fireEvent.press(await screen.findByText('복사한 코드 붙여넣기'));
    await waitFor(() => expect(screen.getByTestId('invite-code-submit')).toBeEnabled());

    // When
    await fireEvent.press(screen.getByTestId('invite-code-submit'));

    // Then
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/invite/[inviteCode]',
        params: { inviteCode: CODE, source: 'code_entry' },
      }),
    );
    expect(queryClient.getQueryData(INVITE_QUERY_KEYS.preview({ inviteCode: CODE }))).toBeDefined();
  });
});
