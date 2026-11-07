import { INVITE_CODE } from '@aido/api/vocabulary';

import { type InviteCode, inviteCodeSchema, normalizeInviteCode } from '../schemas/invite.schema';

const INVITE_CODE_CHARACTERS = new Set(INVITE_CODE.ALPHABET);

// 0·O·1·I·L은 서로 헷갈려서 코드에서 뺐다. 알파벳에 다시 들어가면 이 목록에서도 자동으로 빠진다
const CONFUSABLE_CHARACTERS = new Set(
  ['0', 'O', '1', 'I', 'L'].filter((character) => !INVITE_CODE_CHARACTERS.has(character)),
);

/** 헷갈려서 뺀 글자(confusable)인지, 원래 쓰지 않는 글자(unused: 모음·기호·한글 등)인지 */
export type InvalidCharacterKind = 'confusable' | 'unused';

export interface InvalidInviteCodeCharacter {
  character: string;
  index: number;
  kind: InvalidCharacterKind;
}

// 한글 키보드의 전각 영숫자·하이픈(ＫＡ－７)을 반각으로 바꾼 뒤 서버 정규화를 적용한다
function normalizeTypedInviteCode(raw: string) {
  return normalizeInviteCode(raw.normalize('NFKC'));
}

/** 입력 중인 값을 서버 형태로 맞추고 코드 길이에서 자른다 */
function normalizeInviteCodeInput(raw: string) {
  return normalizeTypedInviteCode(raw).slice(0, INVITE_CODE.LENGTH);
}

function parseInviteCode(raw: unknown): InviteCode | null {
  const parsed = inviteCodeSchema.safeParse(typeof raw === 'string' ? raw.normalize('NFKC') : raw);
  return parsed.success ? parsed.data : null;
}

function isFilledInviteCode(raw: string) {
  return normalizeTypedInviteCode(raw).length === INVITE_CODE.LENGTH;
}

function classifyInvalidCharacter(character: string): InvalidCharacterKind {
  return CONFUSABLE_CHARACTERS.has(character) ? 'confusable' : 'unused';
}

/** 입력 칸에 보이는 값(정규화·대문자) 기준으로 코드에 없는 글자와 칸 위치를 찾는다 */
function findInvalidCharacters(raw: string): InvalidInviteCodeCharacter[] {
  return normalizeInviteCodeInput(raw)
    .split('')
    .flatMap((character, index) =>
      INVITE_CODE_CHARACTERS.has(character)
        ? []
        : [{ character, index, kind: classifyInvalidCharacter(character) }],
    );
}

export const InviteCodePolicy = {
  normalizeInviteCodeInput,
  parseInviteCode,
  isFilledInviteCode,
  findInvalidCharacters,
} as const;
