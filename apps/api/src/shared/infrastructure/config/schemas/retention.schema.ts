import { z } from "zod";

/** 신규 가입자 리텐션 실험 설정. 환경변수 이름은 기존 운영 계약을 유지한다. */
export const retentionSchema = z.object({
	RETENTION_ONBOARDING_V2_ENABLED: z
		.enum(["true", "false"])
		.default("false")
		.transform((value) => value === "true"),
	RETENTION_ONBOARDING_V2_TREATMENT_PERCENT: z.coerce.number().int().min(0).max(100).default(50),
});

export type RetentionConfig = z.infer<typeof retentionSchema>;
