import { INVITE_CODE, INVITE_CODE_PATTERN } from '@aido/api/vocabulary';
import { z } from 'zod';

const INVITE_CODE_CHARACTERS = new Set(INVITE_CODE.ALPHABET);

// 0·O·1·I·L은 서로 헷갈려서 코드에서 뺐다. 알파벳에 다시 들어가면 이 목록에서도 자동으로 빠진다
const CONFUSABLE_CHARACTERS = new Set(
  ['0', 'O', '1', 'I', 'L'].filter((character) => !INVITE_CODE_CHARACTERS.has(character)),
);

// 서버와 같은 정규화(공백·하이픈 제거, 대문자) 뒤 6자 검증
export const inviteCodeSchema = z
  .string()
  .transform(normalizeInviteCode)
  .pipe(z.string().length(INVITE_CODE.LENGTH).regex(new RegExp(INVITE_CODE_PATTERN, 'u')));
export type InviteCode = z.output<typeof inviteCodeSchema>;

/** 헷갈려서 뺀 글자(confusable)인지, 원래 쓰지 않는 글자(unused: 모음·기호·한글 등)인지 */
export type InvalidCharacterKind = 'confusable' | 'unused';

export interface InvalidInviteCodeCharacter {
  character: string;
  index: number;
  kind: InvalidCharacterKind;
}

export function normalizeInviteCode(raw: string) {
  return raw.replaceAll(/[\s-]/gu, '').toUpperCase();
}

// 한글 키보드의 전각 영숫자·하이픈(ＫＡ－７)을 반각으로 바꾼 뒤 서버와 같이 검증한다. 코드가 아니면 null
export function parseInviteCode(raw: unknown): InviteCode | null {
  const parsed = inviteCodeSchema.safeParse(typeof raw === 'string' ? raw.normalize('NFKC') : raw);
  return parsed.success ? parsed.data : null;
}

function classifyInvalidCharacter(character: string): InvalidCharacterKind {
  return CONFUSABLE_CHARACTERS.has(character) ? 'confusable' : 'unused';
}

// 입력 칸에 보이는 값(정규화·대문자) 기준으로 찾는다. 입력 정규화는 폼 스키마(normalizeInviteCodeInput)가 한다
export function getInvalidCharacters(typedCode: string): InvalidInviteCodeCharacter[] {
  return typedCode
    .split('')
    .flatMap((character, index) =>
      INVITE_CODE_CHARACTERS.has(character)
        ? []
        : [{ character, index, kind: classifyInvalidCharacter(character) }],
    );
}
