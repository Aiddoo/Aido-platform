import { authTokensSchema, registerResponseSchema } from '@aido/api';
import type { z } from 'zod';

/** 지금 서버는 복구 여부를 항상 싣는다. 계약의 선택 칸을 앱에서는 필수로 읽는다 */
export const authTokensEnvelopeSchema = authTokensSchema.required({
  accountRestored: true,
});
export type AuthTokensEnvelope = z.infer<typeof authTokensEnvelopeSchema>;

/** 지금 서버는 인증 메일을 담았는지를 항상 싣는다. 계약의 선택 칸을 앱에서는 필수로 읽는다 */
export const registerEnvelopeSchema = registerResponseSchema.required({ emailSent: true });
export type RegisterEnvelope = z.infer<typeof registerEnvelopeSchema>;
