import type { ClipboardGateway } from '@src/core/ports/clipboard';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import type { KakaoShareGateway } from '@src/core/ports/kakao-share';
import type { SystemShareGateway } from '@src/core/ports/system-share';

import { InviteShareService } from './invite-share.service';

const content = { inviteCode: 'K7M2QX', link: 'https://aido.kr/i/K7M2QX', inviterName: '민지' };

function createService({
  isKakaoAvailable = true,
  kakaoShareFeed = jest.fn().mockResolvedValue(undefined),
  systemShare = jest.fn().mockResolvedValue(true),
}: {
  isKakaoAvailable?: boolean;
  kakaoShareFeed?: jest.Mock;
  systemShare?: jest.Mock;
} = {}) {
  const kakaoShare: KakaoShareGateway = {
    isAvailable: () => isKakaoAvailable,
    shareFeed: kakaoShareFeed,
  };
  const systemShareGateway: SystemShareGateway = { share: systemShare };
  const setString = jest.fn().mockResolvedValue(undefined);
  const clipboard: ClipboardGateway = {
    hasString: jest.fn(),
    getString: jest.fn(),
    setString,
  };
  const addBreadcrumb = jest.fn();
  const errorReporter: ErrorReporter = {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb,
    setUserId: jest.fn(),
  };

  return {
    service: new InviteShareService({
      kakaoShare,
      systemShare: systemShareGateway,
      clipboard,
      errorReporter,
    }),
    kakaoShareFeed,
    systemShare,
    setString,
    addBreadcrumb,
  };
}

describe('InviteShareService', () => {
  describe('share', () => {
    it('카카오톡으로 보내면 2:1 썸네일 크기와 앱에서 열 초대 코드를 넘기고 shared를 반환한다', async () => {
      // Given
      const { service, kakaoShareFeed } = createService();

      // When
      const result = await service.share('kakao', content);

      // Then
      expect(kakaoShareFeed).toHaveBeenCalledWith(
        expect.objectContaining({
          webUrl: 'https://aido.kr/i/K7M2QX',
          imageWidth: 1600,
          imageHeight: 800,
          executionParams: { inviteCode: 'K7M2QX' },
        }),
      );
      expect(result).toEqual({ channel: 'kakao', outcome: 'shared' });
    });

    it('카카오 키가 없는 빌드는 OS 공유로 보낸 결과를 반환한다', async () => {
      // Given
      const { service, kakaoShareFeed, systemShare } = createService({ isKakaoAvailable: false });

      // When
      const result = await service.share('kakao', content);

      // Then
      expect(kakaoShareFeed).not.toHaveBeenCalled();
      expect(systemShare).toHaveBeenCalled();
      expect(result).toEqual({ channel: 'system', outcome: 'shared' });
    });

    it('카카오 공유가 실패하면 invite 행적을 남기고 OS 공유로 보낸 결과를 반환한다', async () => {
      // Given
      const { service, systemShare, addBreadcrumb } = createService({
        kakaoShareFeed: jest.fn().mockRejectedValue(new Error('kakao')),
      });

      // When
      const result = await service.share('kakao', content);

      // Then
      expect(addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'invite', level: 'warning' }),
      );
      expect(systemShare).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://aido.kr/i/K7M2QX' }),
      );
      expect(result).toEqual({ channel: 'system', outcome: 'shared' });
    });

    it('카카오 공유와 OS 공유가 모두 실패하면 링크를 복사하고 copied를 반환한다', async () => {
      // Given
      const { service, setString } = createService({
        kakaoShareFeed: jest.fn().mockRejectedValue(new Error('kakao')),
        systemShare: jest.fn().mockRejectedValue(new Error('share')),
      });

      // When
      const result = await service.share('kakao', content);

      // Then
      expect(setString).toHaveBeenCalledWith('https://aido.kr/i/K7M2QX');
      expect(result).toEqual({ channel: 'copy_link', outcome: 'copied' });
    });

    it('OS 공유 시트를 닫으면 dismissed를 반환한다', async () => {
      // Given
      const { service } = createService({ systemShare: jest.fn().mockResolvedValue(false) });

      // When
      const result = await service.share('system', content);

      // Then
      expect(result).toEqual({ channel: 'system', outcome: 'dismissed' });
    });
  });
});
