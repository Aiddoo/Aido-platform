import type { ConfigType } from "@nestjs/config";

import { defineConfig } from "#api/platform/config/define-config";
import { inviteSchema } from "#api/platform/config/schemas/invite.schema";

/** 친구 초대 롤아웃 스위치와 기기·신원 해시 비밀(운영에서 켤 때만 시작 검증이 요구한다). */
export const socialInvitesConfig = defineConfig(
  "socialInvites",
  inviteSchema.transform((env) => ({
    enabled: env.INVITE_ENABLED,
    claimHashSecret: env.INVITE_CLAIM_HASH_SECRET,
  })),
  (env) => ({
    INVITE_ENABLED: env.INVITE_ENABLED,
    INVITE_CLAIM_HASH_SECRET: env.INVITE_CLAIM_HASH_SECRET,
  }),
);

export type SocialInvitesConfig = ConfigType<typeof socialInvitesConfig>;
