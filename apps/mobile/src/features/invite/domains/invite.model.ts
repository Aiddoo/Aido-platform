import {
  INVITE_CODE,
  inviteCodeSchema,
  normalizeInviteCode,
  INVITE_REWARD_CAPS,
  INVITER_REWARD_MILESTONES,
  type InviterRewardMilestone,
  inviteMilestoneSchema,
  myInviteResponseSchema,
} from '@aido/api';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { InviteRewardPolicy, InviteRewardSchema } from './invite-reward.model';

// 서버와 같은 정규화(공백·하이픈 제거, 대문자) 뒤 6자 검증
export const InviteCodeSchema = inviteCodeSchema;

export type InviteCode = z.output<typeof InviteCodeSchema>;

const INVITE_CODE_CHARACTERS = new Set(INVITE_CODE.ALPHABET);

// 한글 키보드의 전각 영숫자·하이픈(ＫＡ－７)을 반각으로 바꾼 뒤 서버 정규화를 적용한다
function normalizeTypedInviteCode(raw: string) {
  return normalizeInviteCode(raw.normalize('NFKC'));
}

/** 입력 중인 값을 서버 형태로 맞추고 코드 길이에서 자른다 */
export function toInviteCodeDraft(raw: string) {
  return normalizeTypedInviteCode(raw).slice(0, INVITE_CODE.LENGTH);
}

export function parseInviteCode(raw: unknown): InviteCode | null {
  const parsed = InviteCodeSchema.safeParse(typeof raw === 'string' ? raw.normalize('NFKC') : raw);
  return parsed.success ? parsed.data : null;
}

export function isFilledInviteCode(raw: string) {
  return normalizeTypedInviteCode(raw).length === INVITE_CODE.LENGTH;
}

// 0·O·1·I·L은 서로 헷갈려서 코드에서 뺐다. 알파벳에 다시 들어가면 이 목록에서도 자동으로 빠진다
const CONFUSABLE_CHARACTERS = new Set(
  ['0', 'O', '1', 'I', 'L'].filter((character) => !INVITE_CODE_CHARACTERS.has(character)),
);

const MAX_LISTED_INVALID_CHARACTERS = 3;

/** 헷갈려서 뺀 글자(confusable)인지, 원래 쓰지 않는 글자(unused: 모음·기호·한글 등)인지 */
export type InvalidCharacterKind = 'confusable' | 'unused';

export interface InvalidInviteCodeCharacter {
  character: string;
  index: number;
  kind: InvalidCharacterKind;
}

export interface InvalidCharacterSummary {
  /** 하나라도 원래 쓰지 않는 글자면 unused, 모두 헷갈리는 글자면 confusable */
  kind: InvalidCharacterKind;
  /** 처음 나온 순서대로 중복 없이 최대 3개 */
  listedCharacters: string[];
  uniqueCount: number;
}

export function classifyInvalidCharacter(character: string): InvalidCharacterKind {
  return CONFUSABLE_CHARACTERS.has(character) ? 'confusable' : 'unused';
}

/** 입력 칸에 보이는 값(정규화·대문자) 기준으로 코드에 없는 글자와 칸 위치를 찾는다 */
export function findInvalidCharacters(raw: string): InvalidInviteCodeCharacter[] {
  return toInviteCodeDraft(raw)
    .split('')
    .flatMap((character, index) =>
      INVITE_CODE_CHARACTERS.has(character)
        ? []
        : [{ character, index, kind: classifyInvalidCharacter(character) }],
    );
}

export function summarizeInvalidCharacters(
  invalidCharacters: readonly InvalidInviteCodeCharacter[],
): InvalidCharacterSummary | null {
  if (invalidCharacters.length === 0) {
    return null;
  }

  const uniqueCharacters = [...new Set(invalidCharacters.map(({ character }) => character))];

  return {
    kind: invalidCharacters.every(({ kind }) => kind === 'confusable') ? 'confusable' : 'unused',
    listedCharacters: uniqueCharacters.slice(0, MAX_LISTED_INVALID_CHARACTERS),
    uniqueCount: uniqueCharacters.length,
  };
}

export const InviteCodePolicy = {
  isFilled: isFilledInviteCode,

  invalidCharacters: findInvalidCharacters,

  invalidCharacterSummary(raw: string) {
    return summarizeInvalidCharacters(findInvalidCharacters(raw));
  },
};

const InviteMilestoneSchema = inviteMilestoneSchema.extend({
  rewards: z.array(InviteRewardSchema),
});

export const InviteSchema = myInviteResponseSchema.extend({
  nextMilestone: InviteMilestoneSchema.nullable(),
  rewardsEarned: z.array(InviteRewardSchema),
  createdAt: z.coerce.date(),
});

export type Invite = z.output<typeof InviteSchema>;

export function calculateRemainingInvites(qualifiedCount: number, targetCount: number) {
  return Math.max(targetCount - qualifiedCount, 0);
}

// 반복하지 않는 단계(3·5·10명 등)만 발자국 판에 생선 칸으로 미리 보여 준다
export function findOneTimeMilestoneCounts(milestones: readonly InviterRewardMilestone[]) {
  return milestones
    .filter((milestone) => milestone.repeatEvery == null)
    .map((milestone) => milestone.qualifiedCount);
}

function calculateInvitedCount(qualifiedCount: number, waitingCount: number) {
  return qualifiedCount + waitingCount;
}

export function hasReachedPremiumCap(grantedDays: number, capDays: number) {
  return grantedDays >= capDays;
}

export function toDisplayLink(link: string) {
  return link.replace(/^https?:\/\//, '');
}

export const InvitePolicy = {
  nextMilestone(myInvite: Invite) {
    return myInvite.nextMilestone;
  },

  remainingToNextMilestone(myInvite: Invite) {
    const next = this.nextMilestone(myInvite);
    return next == null
      ? null
      : calculateRemainingInvites(myInvite.qualifiedCount, next.qualifiedCount);
  },

  /** 다음 발자국에서 받는 프리미엄 일수(없으면 0) */
  nextPremiumDays(myInvite: Invite) {
    return InviteRewardPolicy.premiumDays(this.nextMilestone(myInvite)?.rewards ?? []);
  },

  nextFriendSlots(myInvite: Invite) {
    return InviteRewardPolicy.friendSlots(this.nextMilestone(myInvite)?.rewards ?? []);
  },

  earnedPremiumDays(myInvite: Invite) {
    return InviteRewardPolicy.premiumDays(myInvite.rewardsEarned);
  },

  earnedFriendSlots(myInvite: Invite) {
    return InviteRewardPolicy.friendSlots(myInvite.rewardsEarned);
  },

  /** 최근 premiumCapWindowDays일 동안 초대로 받을 수 있는 프리미엄 일수 */
  monthlyPremiumCapDays() {
    return INVITE_REWARD_CAPS.PREMIUM_DAYS_PER_30_DAYS;
  },

  /** monthlyPremiumCapDays를 세는 기간(일) */
  premiumCapWindowDays() {
    return INVITE_REWARD_CAPS.WINDOW_DAYS;
  },

  /** 지금까지 초대로 받을 수 있는 프리미엄 일수 */
  totalPremiumCapDays() {
    return INVITE_REWARD_CAPS.PREMIUM_DAYS_TOTAL;
  },

  isMonthlyCapReached(myInvite: Invite) {
    return hasReachedPremiumCap(myInvite.premiumDaysInWindow, this.monthlyPremiumCapDays());
  },

  milestoneQualifiedCounts() {
    return findOneTimeMilestoneCounts(INVITER_REWARD_MILESTONES);
  },

  /** 가입까지 마친 초대 친구가 한 명이라도 있는지(시작 체크리스트 완료 기준) */
  hasInvitedAnyone(invite: Invite) {
    return calculateInvitedCount(invite.qualifiedCount, invite.waitingCount) > 0;
  },

  /** 발자국 판 아래 진행 안내가 어떤 상황을 말할지 정한다(문구는 화면이 고른다) */
  progress(myInvite: Invite) {
    return match({
      isMonthlyCapReached: this.isMonthlyCapReached(myInvite),
      hasPawPrint: myInvite.qualifiedCount > 0,
    })
      .with({ isMonthlyCapReached: true }, () => 'monthly-cap-reached' as const)
      .with({ hasPawPrint: false }, () => 'not-started' as const)
      .with({ hasPawPrint: true }, () => 'in-progress' as const)
      .exhaustive();
  },

  /** 화면에 보여 줄 링크. 스킴을 빼서 짧게 읽힌다(복사·공유는 전체 링크를 쓴다) */
  displayLink(myInvite: Invite) {
    return toDisplayLink(myInvite.link);
  },
};
