import '@src/shared/i18n/init';
import { ClipboardCopyError } from '@src/core/ports/clipboard-gateway';
import {
  createClipboardGatewayStub,
  createErrorReporterStub,
  createHapticsGatewayStub,
  createSocialShareGatewayStub,
  createSystemShareGatewayStub,
  renderUiHook,
} from '@src/shared/__tests__';
import { i18n } from '@src/shared/i18n';
import { useMutation } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react-native';

import { useShareInviteMutationOptions } from './invite.mutations';

const content = {
  inviteCode: 'K7M2QX',
  link: 'https://aido.kr/i/K7M2QX',
  copy: {
    kakaoTitle: '민지님이 초대했어요',
    kakaoDescription: '가입하면 프리미엄 7일',
    kakaoButton: '받으러 가기',
    message: '프리미엄 7일을 받아요',
    dialogTitle: '초대 링크 공유',
  },
};

describe('useShareInviteMutationOptions', () => {
  it('공유 시트와 복사가 모두 실패하면 SDK 영문 문구 대신 다시 시도 안내를 한 번 보이고 예측 못한 실패로 보고한다', async () => {
    // Given
    const socialShareGateway = createSocialShareGatewayStub();
    socialShareGateway.isAvailable.mockReturnValue(false);
    const systemShare = createSystemShareGatewayStub();
    systemShare.share.mockRejectedValue(new Error('share sheet unavailable'));
    const sdkError = Object.assign(new Error('ExpoClipboard.setStringAsync has been rejected'), {
      code: 'ERR_CLIPBOARD_UNAVAILABLE',
    });
    const clipboard = createClipboardGatewayStub();
    clipboard.copy.mockRejectedValue(new ClipboardCopyError(sdkError));
    const haptics = createHapticsGatewayStub();
    const errorReporter = createErrorReporterStub();
    const { result } = await renderUiHook(() => useMutation(useShareInviteMutationOptions()), {
      di: { socialShareGateway, systemShare, clipboard, haptics, errorReporter },
    });

    // When
    await act(async () => {
      result.current.mutate({ channel: 'system', content });
    });

    // Then
    expect(await screen.findAllByText(i18n.t('invite:toast.shareFailed'))).not.toHaveLength(0);
    expect(screen.queryByText(sdkError.message)).toBeNull();
    expect(haptics.notify).toHaveBeenCalledTimes(1);
    expect(errorReporter.captureException).toHaveBeenCalledWith(
      expect.any(ClipboardCopyError),
      expect.objectContaining({ feature: 'invite' }),
    );
  });
});
