import {
  createAppLoggerStub,
  createClipboardGatewayStub,
  createSocialShareGatewayStub,
  createSystemShareGatewayStub,
} from '@src/testing/core';

import { INVITE_LOG_EVENT } from '../constants/invite-log-events';
import { InviteShareService } from './invite-share.service';

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

function setup() {
  const socialShare = createSocialShareGatewayStub();
  const systemShare = createSystemShareGatewayStub();
  const clipboard = createClipboardGatewayStub();
  const logger = createAppLoggerStub();
  const service = new InviteShareService({ socialShare, systemShare, clipboard, logger });
  return { service, socialShare, systemShare, clipboard, logger };
}

describe('InviteShareService', () => {
  describe('share', () => {
    it('카카오톡으로 보내면 2:1 썸네일 크기와 앱에서 열 초대 코드를 넘기고 shared를 반환한다', async () => {
      // Given
      const { service, socialShare } = setup();

      // When
      const result = await service.share('kakao', content);

      // Then
      expect(socialShare.shareFeed).toHaveBeenCalledWith(
        expect.objectContaining({
          webUrl: 'https://aido.kr/i/K7M2QX',
          imageWidth: 1600,
          imageHeight: 800,
          appLinkParams: { inviteCode: 'K7M2QX' },
        }),
      );
      expect(result).toEqual({ channel: 'kakao', outcome: 'shared' });
    });

    it('카카오 키가 없는 빌드는 OS 공유로 보낸 결과를 반환한다', async () => {
      // Given
      const { service, socialShare, systemShare } = setup();
      socialShare.isAvailable.mockReturnValue(false);

      // When
      const result = await service.share('kakao', content);

      // Then
      expect(socialShare.shareFeed).not.toHaveBeenCalled();
      expect(systemShare.share).toHaveBeenCalled();
      expect(result).toEqual({ channel: 'system', outcome: 'shared' });
    });

    it('카카오 공유가 실패하면 경고를 남기고 OS 공유로 보낸 결과를 반환한다', async () => {
      // Given
      const { service, socialShare, systemShare, logger } = setup();
      socialShare.shareFeed.mockRejectedValue(new Error('kakao'));

      // When
      const result = await service.share('kakao', content);

      // Then
      expect(logger.warn).toHaveBeenCalledWith(INVITE_LOG_EVENT.KAKAO_SHARE_FAILED, {
        reason: 'Error',
      });
      expect(systemShare.share).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://aido.kr/i/K7M2QX' }),
      );
      expect(result).toEqual({ channel: 'system', outcome: 'shared' });
    });

    it('카카오 공유와 OS 공유가 모두 실패하면 링크를 복사하고 copied를 반환한다', async () => {
      // Given
      const { service, socialShare, systemShare, clipboard } = setup();
      socialShare.shareFeed.mockRejectedValue(new Error('kakao'));
      systemShare.share.mockRejectedValue(new Error('share'));

      // When
      const result = await service.share('kakao', content);

      // Then
      expect(clipboard.copy).toHaveBeenCalledWith('https://aido.kr/i/K7M2QX');
      expect(result).toEqual({ channel: 'copy_link', outcome: 'copied' });
    });

    it('OS 공유 시트를 닫으면 dismissed를 반환한다', async () => {
      // Given
      const { service, systemShare } = setup();
      systemShare.share.mockResolvedValue(false);

      // When
      const result = await service.share('system', content);

      // Then
      expect(result).toEqual({ channel: 'system', outcome: 'dismissed' });
    });
  });
});
