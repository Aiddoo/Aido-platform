import { z } from 'zod';

const authTokensSchema = z.object({
  userId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  userName: z.string().nullable(),
  userProfileImage: z.string().nullable(),
  accountRestored: z.boolean(),
  /** 소셜 로그인 응답에만 실린다. 이메일 로그인과 인증은 싣지 않아 null이다 */
  isNewUser: z.boolean().nullable(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const AuthTokensPolicy = {
  /** 서버가 새 계정이라고 알린 로그인만 가입이다. 알리지 않은 응답은 기존 계정의 로그인이다 */
  isSignUp(tokens: AuthTokens): boolean {
    return tokens.isNewUser === true;
  },
};
