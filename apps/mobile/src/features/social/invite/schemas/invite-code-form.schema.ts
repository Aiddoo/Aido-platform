import { INVITE_CODE } from '@aido/api/vocabulary';
import { z } from 'zod';

import { findInvalidCharacters, inviteCodeSchema } from '../domains/invite-code.model';

/**
 * 입력 칸은 서버 모양(대문자·공백 없음)으로 맞춘 값을 둔다. 코드에 없는 글자는 적는 즉시 `custom`으로,
 * 덜 채운 코드는 `too_small`로 알려 화면이 앞의 것만 보인다. 제출 값은 서버가 받는 코드다
 */
export const inviteCodeFormSchema = z.object({
  inviteCode: z
    .string()
    .superRefine((raw, context) => {
      if (findInvalidCharacters(raw).length > 0) {
        context.addIssue({ code: 'custom', message: 'invalid characters' });
      }
    })
    .min(INVITE_CODE.LENGTH)
    .pipe(inviteCodeSchema),
});
