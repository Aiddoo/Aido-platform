import type { ConfigType } from "@nestjs/config";

import { defineConfig } from "#api/platform/config/define-config";
import { appSchema } from "#api/platform/config/schemas/app.schema";
import { emailSchema } from "#api/platform/config/schemas/email.schema";

/** 신고 접수 메일을 받는 고객센터 주소와 관리자 문서 링크의 기준 주소(끝의 / 는 뗀다). */
export const socialReportsConfig = defineConfig(
  "socialReports",
  emailSchema
    .pick({ SUPPORT_EMAIL: true })
    .extend(appSchema.pick({ API_PUBLIC_URL: true }).shape)
    .transform((env) => ({
      supportEmail: env.SUPPORT_EMAIL,
      apiPublicUrl: env.API_PUBLIC_URL?.replace(/\/+$/, ""),
    })),
  (env) => ({ SUPPORT_EMAIL: env.SUPPORT_EMAIL, API_PUBLIC_URL: env.API_PUBLIC_URL }),
);

export type SocialReportsConfig = ConfigType<typeof socialReportsConfig>;
