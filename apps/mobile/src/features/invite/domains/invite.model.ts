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
