import { uniq } from 'es-toolkit';

import type {
  InvalidCharacterKind,
  InvalidInviteCodeCharacter,
} from '../domains/invite-code.model';

const MAX_LISTED_INVALID_CHARACTERS = 3;

export interface InvalidCharacterSummary {
  /** 하나라도 원래 쓰지 않는 글자면 unused, 모두 헷갈리는 글자면 confusable */
  kind: InvalidCharacterKind;
  /** 처음 나온 순서대로 중복 없이 최대 3개 */
  listedCharacters: string[];
  uniqueCount: number;
}

/** 오류 문구에 나열할 글자를 추린다 */
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
