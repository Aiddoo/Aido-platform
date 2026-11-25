import { INVITE_CODE } from '@aido/api/vocabulary';
import { z } from 'zod';

import {
  getInvalidCharacters,
  inviteCodeSchema,
  normalizeInviteCode,
} from '../domains/invite-code.model';

function normalizeTypedInviteCode(raw: string) {
  return normalizeInviteCode(raw.normalize('NFKC'));
}

// 입력 중인 값을 서버 형태로 맞추고 코드 길이에서 자른다
export function normalizeInviteCodeInput(raw: string) {
  return normalizeTypedInviteCode(raw).slice(0, INVITE_CODE.LENGTH);
}

// 바뀌기 전후로 같은 앞뒤를 덜어 낸 가운데가 이번에 붙여 넣은 글자다
function extractInsertedText(previous: string, next: string) {
  let start = 0;
  while (start < previous.length && previous[start] === next[start]) {
    start += 1;
  }

  let end = 0;
  while (end < previous.length - start && previous.at(-1 - end) === next.at(-1 - end)) {
    end += 1;
  }

  return next.slice(start, next.length - end);
}

// 칸이 찬 뒤에 붙여 넣어도 붙여 넣은 코드로 바꾼다. 코드 하나에 못 미치면 쓰던 코드에 이어 붙인 것으로 본다
export function normalizePastedInviteCode(previous: string, next: string) {
  const pasted = normalizeInviteCodeInput(extractInsertedText(previous, next));
  return pasted.length === INVITE_CODE.LENGTH ? pasted : normalizeInviteCodeInput(next);
}

/**
 * 입력 칸은 서버 모양(대문자·공백 없음)으로 맞춘 값을 둔다. 코드에 없는 글자는 적는 즉시 `custom`으로,
 * 덜 채운 코드는 `too_small`로 알려 화면이 앞의 것만 보인다. 제출 값은 서버가 받는 코드다
 */
export const inviteCodeFormSchema = z.object({
  inviteCode: z
    .string()
    .refine((raw) => getInvalidCharacters(normalizeInviteCodeInput(raw)).length === 0, {
      error: 'invalid characters',
    })
    .min(INVITE_CODE.LENGTH)
    .pipe(inviteCodeSchema),
});
