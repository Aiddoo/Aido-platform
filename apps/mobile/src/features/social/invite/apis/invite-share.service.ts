import type { ClipboardGateway } from '@src/core/ports/clipboard';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import type { SocialShareGateway } from '@src/core/ports/social-share';
import type { SystemShareGateway } from '@src/core/ports/system-share';

import { INVITE_SHARE_IMAGE } from '../constants/invite.constants';
import type { InviteShareContent, InviteShareResult } from '../schemas/invite-share.schema';
import type { InviteShareChannel } from '../schemas/invite-share.schema';

interface InviteShareServicePorts {
  socialShare: SocialShareGateway;
  systemShare: Pick<SystemShareGateway, 'share'>;
  clipboard: ClipboardGateway;
  errorReporter: ErrorReporter;
}

/**
 * 초대 링크를 카카오톡·OS 공유·복사로 보낸다. 방법을 하나 더하려면 `#channels`에 한 줄만 추가한다.
 * 카카오톡을 못 쓰면 OS 공유로, 그것도 안 되면 링크 복사로 이어서 사용자가 빈손으로 끝나지 않게 한다.
 */
export class InviteShareService {
  readonly #socialShare: SocialShareGateway;
  readonly #systemShare: Pick<SystemShareGateway, 'share'>;
  readonly #clipboard: ClipboardGateway;
  readonly #errorReporter: ErrorReporter;

  readonly #channels: Record<
    InviteShareChannel,
    (content: InviteShareContent) => Promise<InviteShareResult>
  > = {
    kakao: (content) => this.#shareToKakao(content),
    copy_link: (content) => this.#copyLink(content),
    system: (content) => this.#shareToSystem(content),
  };

  constructor({ socialShare, systemShare, clipboard, errorReporter }: InviteShareServicePorts) {
    this.#socialShare = socialShare;
    this.#systemShare = systemShare;
    this.#clipboard = clipboard;
    this.#errorReporter = errorReporter;
  }

  share = (channel: InviteShareChannel, content: InviteShareContent) =>
    this.#channels[channel](content);

  #shareToKakao = async (content: InviteShareContent): Promise<InviteShareResult> => {
    if (!this.#socialShare.isAvailable()) {
      return this.#shareToSystem(content);
    }

    try {
      await this.#socialShare.shareFeed({
        title: content.copy.kakaoTitle,
        description: content.copy.kakaoDescription,
        imageUrl: INVITE_SHARE_IMAGE.url,
        imageWidth: INVITE_SHARE_IMAGE.width,
        imageHeight: INVITE_SHARE_IMAGE.height,
        webUrl: content.link,
        buttonTitle: content.copy.kakaoButton,
        appLinkParams: { inviteCode: content.inviteCode },
      });
      return { channel: 'kakao', outcome: 'shared' };
    } catch (error) {
      // 카카오톡 미설치·SDK 오류는 OS 공유로 넘기므로 예외 대신 행적만 남긴다
      this.#errorReporter.addBreadcrumb({
        category: 'invite',
        message: 'kakao share failed, falling back to system share',
        level: 'warning',
        data: { reason: error instanceof Error ? error.name : 'unknown' },
      });
      return this.#shareToSystem(content);
    }
  };

  #shareToSystem = async (content: InviteShareContent): Promise<InviteShareResult> => {
    try {
      const isShared = await this.#systemShare.share({
        message: content.copy.message,
        url: content.link,
        dialogTitle: content.copy.dialogTitle,
      });
      return { channel: 'system', outcome: isShared ? 'shared' : 'dismissed' };
    } catch {
      return this.#copyLink(content);
    }
  };

  #copyLink = async (content: InviteShareContent): Promise<InviteShareResult> => {
    await this.#clipboard.copy(content.link);
    return { channel: 'copy_link', outcome: 'copied' };
  };
}
