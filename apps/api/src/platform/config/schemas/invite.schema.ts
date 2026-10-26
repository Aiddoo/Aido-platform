import { z } from "zod";

const INVITE_CLAIM_HASH_SECRET_MIN_LENGTH = 32;

/**
 * 친구 초대 롤아웃 설정.
 *
 * 꺼진 상태가 안전한 기본값이다. 기기·신원 해시 비밀은 운영에서 켤 때만 필수로 확인한다.
 */
export const inviteSchema = z.object({
  INVITE_ENABLED: z.stringbool().default(false),
  INVITE_CLAIM_HASH_SECRET: z.string().optional(),
});

export type InviteConfig = z.infer<typeof inviteSchema>;

export function validateInviteConfig({
  value: config,
  issues,
}: z.core.ParsePayload<InviteConfig & { readonly NODE_ENV: string }>): void {
  if (!config.INVITE_ENABLED || config.NODE_ENV !== "production") {
    return;
  }

  if ((config.INVITE_CLAIM_HASH_SECRET?.length ?? 0) < INVITE_CLAIM_HASH_SECRET_MIN_LENGTH) {
    issues.push({
      code: "custom",
      input: config,
      path: ["INVITE_CLAIM_HASH_SECRET"],
      message: `INVITE_CLAIM_HASH_SECRET must be at least ${INVITE_CLAIM_HASH_SECRET_MIN_LENGTH} characters when INVITE_ENABLED is true in production`,
    });
  }
}
