import { INVITE_CODE, inviteCodeSchema, normalizeInviteCode } from '@aido/api';
import type { z } from 'zod';

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

// 0·O·1·I·L처럼 헷갈려서 뺀 글자가 섞였는지 본다
export function hasUnsupportedCharacter(raw: string) {
  return [...normalizeTypedInviteCode(raw)].some(
    (character) => !INVITE_CODE_CHARACTERS.has(character),
  );
}

export const InviteCodePolicy = {
  isFilled: isFilledInviteCode,

  hasUnsupportedCharacter,
};
