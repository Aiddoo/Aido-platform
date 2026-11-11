import { z } from "zod";

// https://developers.naver.com/docs/login/api/api.md
export const naverTokenResponseSchema = z.object({ access_token: z.string() });

// https://developers.naver.com/docs/login/profile/profile.md
export const naverUserInfoSchema = z.object({
  resultcode: z.string(),
  response: z
    .object({
      id: z.string(),
      email: z.string().nullish(),
      name: z.string().nullish(),
      nickname: z.string().nullish(),
      profile_image: z.string().nullish(),
    })
    .nullish(),
});
