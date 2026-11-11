import type { ConfigType } from "@nestjs/config";

import { defineConfig } from "#api/platform/config/define-config";
import { emailSchema } from "#api/platform/config/schemas/email.schema";

/** 문의 메일을 받는 고객센터 주소. Application으로 새지 않게 어댑터만 읽는다. */
export const supportInquiriesConfig = defineConfig(
  "supportInquiries",
  emailSchema
    .pick({ SUPPORT_EMAIL: true })
    .transform((env) => ({ supportEmail: env.SUPPORT_EMAIL })),
  (env) => ({ SUPPORT_EMAIL: env.SUPPORT_EMAIL }),
);

export type SupportInquiriesConfig = ConfigType<typeof supportInquiriesConfig>;
