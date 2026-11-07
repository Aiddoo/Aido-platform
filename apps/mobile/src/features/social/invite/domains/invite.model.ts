import { INVITE_CODE, INVITER_REWARD_MILESTONES, PREMIUM_CAP_STATE } from '@aido/api/vocabulary';
import { uniq } from 'es-toolkit';
import { match } from 'ts-pattern';

import {
  type Invite,
  type InviteCode,
  InviteCodeSchema,
  type InviterRewardMilestone,
  normalizeInviteCode,
} from '../schemas/invite.schema';
import { InviteRewardPolicy } from './invite-reward.model';

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

  const uniqueCharacters = uniq(invalidCharacters.map(({ character }) => character));

  return {
    kind: invalidCharacters.every(({ kind }) => kind === 'confusable') ? 'confusable' : 'unused',
    listedCharacters: uniqueCharacters.slice(0, MAX_LISTED_INVALID_CHARACTERS),
    uniqueCount: uniqueCharacters.length,
  };
}

export const InviteCodePolicy = {
  isFilledInviteCode,
  findInvalidCharacters,
} as const;

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

function getRemainingToNextMilestone(invite: Pick<Invite, 'qualifiedCount' | 'nextMilestone'>) {
  return invite.nextMilestone == null
    ? null
    : calculateRemainingInvites(invite.qualifiedCount, invite.nextMilestone.qualifiedCount);
}

/** 다음 발자국에서 받는 프리미엄 일수(없으면 0) */
function getNextPremiumDays(invite: Pick<Invite, 'nextMilestone'>) {
  return InviteRewardPolicy.getPremiumDays(invite.nextMilestone?.rewards ?? []);
}

function getNextFriendSlots(invite: Pick<Invite, 'nextMilestone'>) {
  return InviteRewardPolicy.getFriendSlots(invite.nextMilestone?.rewards ?? []);
}

function getEarnedPremiumDays(invite: Pick<Invite, 'rewardsEarned'>) {
  return InviteRewardPolicy.getPremiumDays(invite.rewardsEarned);
}

function getEarnedFriendSlots(invite: Pick<Invite, 'rewardsEarned'>) {
  return InviteRewardPolicy.getFriendSlots(invite.rewardsEarned);
}

function getMilestoneQualifiedCounts() {
  return findOneTimeMilestoneCounts(INVITER_REWARD_MILESTONES);
}

/** 가입까지 마친 초대 친구가 한 명이라도 있는지(시작 체크리스트 완료 기준) */
function hasInvitedAnyone(invite: Pick<Invite, 'qualifiedCount' | 'waitingCount'>) {
  return calculateInvitedCount(invite.qualifiedCount, invite.waitingCount) > 0;
}

/**
 * 발자국 판 아래 진행 안내가 어떤 상황을 말할지 정한다(문구는 화면이 고른다).
 * 프리미엄 상한은 서버가 정한 premiumCapState를 그대로 따른다
 */
function getProgress(invite: Pick<Invite, 'premiumCapState' | 'qualifiedCount'>) {
  return match({
    premiumCapState: invite.premiumCapState,
    hasPawPrint: invite.qualifiedCount > 0,
  })
    .with({ premiumCapState: PREMIUM_CAP_STATE.TOTAL_REACHED }, () => 'total-cap-reached' as const)
    .with(
      { premiumCapState: PREMIUM_CAP_STATE.WINDOW_REACHED },
      () => 'monthly-cap-reached' as const,
    )
    .with({ hasPawPrint: false }, () => 'not-started' as const)
    .with({ hasPawPrint: true }, () => 'in-progress' as const)
    .exhaustive();
}

export const InvitePolicy = {
  getRemainingToNextMilestone,
  getNextPremiumDays,
  getNextFriendSlots,
  getEarnedPremiumDays,
  getEarnedFriendSlots,
  getMilestoneQualifiedCounts,
  hasInvitedAnyone,
  getProgress,
} as const;
