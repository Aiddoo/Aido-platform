import { z } from 'zod';

export const FriendUserSchema = z.object({
  id: z.string(),
  userTag: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  followId: z.string(),
  friendsSince: z.date(),
});
export type FriendUser = z.infer<typeof FriendUserSchema>;

export const FriendRequestSchema = z.object({
  id: z.string(),
  userTag: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  requestedAt: z.date(),
});
export type FriendRequest = z.infer<typeof FriendRequestSchema>;

export interface SendRequestResult {
  autoAccepted: boolean;
}

/** userTag: 8자리 영문 대문자·숫자만 허용 (@aido/validators userTagParamSchema와 동일) */
export const FriendPolicy = {
  isValidTag(tag: string): boolean {
    return /^[A-Z0-9]{8}$/.test(tag.trim());
  },
} as const;
