import type { InvitePreviewResponse } from '@aido/api/contracts/invite/v1';
import { INVITE_LINK_BASE_URL, REDEEM_OUTCOME } from '@aido/api/vocabulary';
import { toInstant, toNullableInstant } from '@src/shared/date/instant';
import { stripQueryAndHash } from '@src/shared/utils/strip-query-and-hash';
import { pick } from 'es-toolkit';
import { match } from 'ts-pattern';

import { type InviteCode, parseInviteCode } from '../domains/invite-code.model';
import type { InvitePreview } from '../domains/invite-preview.model';
import type { RedemptionResult } from '../domains/invite-redemption.model';
import type { InviteReward } from '../domains/invite-reward.model';
import type { Invite } from '../domains/invite.model';
import type { InvitedFriend, InvitedFriendPage } from '../domains/invited-friend.model';
import type { InviteLinkSource } from '../domains/pending-redemption.model';
import type {
  InvitedFriendResponse,
  InvitedFriendsResponse,
  InviteResponse,
  InviteRewardResponse,
  RedeemResponse,
} from '../schemas/invite-response.schema';

function toInviteReward(dto: InviteRewardResponse): InviteReward {
  return pick(dto, ['rewardType', 'quantity']);
}

export function toInvite(dto: InviteResponse): Invite {
  return {
    ...pick(dto, [
      'code',
      'link',
      'waitingCount',
      'qualifiedCount',
      'premiumDaysInWindow',
      'totalPremiumDays',
      'premiumCapState',
    ]),
    nextMilestone:
      dto.nextMilestone == null
        ? null
        : {
            qualifiedCount: dto.nextMilestone.qualifiedCount,
            rewards: dto.nextMilestone.rewards.map(toInviteReward),
          },
    rewardsEarned: dto.rewardsEarned.map(toInviteReward),
    createdAt: toInstant(dto.createdAt),
  };
}

export function toRedemptionResult(dto: RedeemResponse): RedemptionResult {
  const inviter = pick(dto.inviter, ['userId', 'name', 'userTag', 'profileImage']);

  return match(dto)
    .returnType<RedemptionResult>()
    .with({ outcome: REDEEM_OUTCOME.REDEEMED }, (redeemed) => ({
      outcome: redeemed.outcome,
      inviter,
      friendship: redeemed.friendship,
      rewards: redeemed.rewards.map(toInviteReward),
      isReplay: redeemed.isReplay,
    }))
    .with({ outcome: REDEEM_OUTCOME.CONNECTED }, (connected) => ({
      outcome: connected.outcome,
      inviter,
      friendship: connected.friendship,
    }))
    .with({ outcome: REDEEM_OUTCOME.ALREADY_FRIENDS }, (alreadyFriends) => ({
      outcome: alreadyFriends.outcome,
      inviter,
    }))
    .exhaustive();
}

export function toInvitePreview(dto: InvitePreviewResponse): InvitePreview {
  return { inviter: pick(dto.inviter, ['name', 'profileImage']) };
}

function toInvitedFriend(dto: InvitedFriendResponse): InvitedFriend {
  return {
    ...pick(dto, ['userId', 'name', 'userTag', 'profileImage', 'status', 'activeDayCount']),
    joinedAt: toInstant(dto.joinedAt),
    qualifiedAt: toNullableInstant(dto.qualifiedAt),
    rejectionReason: dto.rejectionReason,
  };
}

// 친구 목록과 같이 마지막 userId가 다음 커서다
export function toInvitedFriendsPage(dto: InvitedFriendsResponse): InvitedFriendPage {
  const items = dto.items.map(toInvitedFriend);
  return {
    items,
    nextCursor: dto.hasMore ? (items.at(-1)?.userId ?? null) : null,
    totalCount: dto.totalCount,
  };
}

const INSTALL_REFERRER_INVITE_CODE_PARAM = 'inviteCode';

/** Play 설치 referrer(`inviteCode=K7M2QX&utm_source=…`)에서 초대 코드를 꺼낸다 */
export function parseInstallReferrerInviteCode(referrer: string): InviteCode | null {
  const params = new URLSearchParams(referrer);
  if (params.has(INSTALL_REFERRER_INVITE_CODE_PARAM)) {
    return parseInviteCode(params.get(INSTALL_REFERRER_INVITE_CODE_PARAM));
  }

  // 스토어 링크의 referrer 값 전체가 한 번 더 인코딩된 채로 오면 한 번 풀어서 다시 읽는다
  const decodedReferrer = new URLSearchParams(`referrer=${referrer}`).get('referrer') ?? '';
  return parseInviteCode(
    new URLSearchParams(decodedReferrer).get(INSTALL_REFERRER_INVITE_CODE_PARAM),
  );
}

export interface InviteLinkSchemes {
  /** 이 빌드의 앱 스킴 (aido, aido-preview, aido-dev) */
  appScheme: string;
  /** 카카오톡 공유 버튼이 여는 스킴 (kakao{네이티브 앱 키}). 키가 없는 빌드는 null */
  kakaoScheme: string | null;
}

/** 시스템이 연 초대 링크. 코드 형식이 맞지 않거나 없으면 inviteCode가 null이다 */
interface InviteLink {
  inviteCode: InviteCode | null;
  source: InviteLinkSource;
}

const INVITE_LINK_PREFIX = `${INVITE_LINK_BASE_URL}/`;
const RELATIVE_INVITE_LINK_PREFIX = '/i/';

function toInviteSegment(rawCode: string) {
  return stripQueryAndHash(rawCode).replace(/\/+$/, '');
}

function matchInviteLink(
  path: string,
  schemes: InviteLinkSchemes,
): { rawCode: string | null; source: InviteLinkSource } | null {
  if (path.startsWith(INVITE_LINK_PREFIX)) {
    return {
      rawCode: toInviteSegment(path.slice(INVITE_LINK_PREFIX.length)),
      source: 'universal_link',
    };
  }

  if (path.startsWith(RELATIVE_INVITE_LINK_PREFIX)) {
    return {
      rawCode: toInviteSegment(path.slice(RELATIVE_INVITE_LINK_PREFIX.length)),
      source: 'universal_link',
    };
  }

  const appInvitePrefix = `${schemes.appScheme}://invite`;
  if (path === appInvitePrefix || path.startsWith(`${appInvitePrefix}/`)) {
    const segment = toInviteSegment(path.slice(appInvitePrefix.length + 1));
    return { rawCode: segment === '' ? null : segment, source: 'app_scheme' };
  }

  if (schemes.kakaoScheme != null && path.startsWith(`${schemes.kakaoScheme}://kakaolink`)) {
    // Linking.parse도 안에서 같은 URL 파서를 쓰지만 Expo Go 호스트를 지우려 Constants를 읽어 순수 함수가 아니게 된다
    return { rawCode: new URL(path).searchParams.get('inviteCode'), source: 'kakao' };
  }

  return null;
}

export function parseInviteLink(path: string, schemes: InviteLinkSchemes): InviteLink | null {
  const link = matchInviteLink(path, schemes);
  if (link == null) {
    return null;
  }

  return {
    inviteCode: link.rawCode == null ? null : parseInviteCode(link.rawCode),
    source: link.source,
  };
}
