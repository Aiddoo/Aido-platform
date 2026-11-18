import { z } from "zod";

// https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#request-token
export const kakaoTokenResponseSchema = z.object({ access_token: z.string() });

// https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#req-user-info
export const kakaoUserInfoSchema = z.object({
  id: z.number(),
  kakao_account: z
    .object({
      email: z.string().nullish(),
      is_email_verified: z.boolean().nullish(),
      profile: z
        .object({
          nickname: z.string().nullish(),
          profile_image_url: z.string().nullish(),
        })
        .nullish(),
    })
    .nullish(),
});
