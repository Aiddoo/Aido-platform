import { z } from "zod";

/**
 * Expo Push 알림 설정 스키마
 * 향후 확장용 - 현재는 선택적
 */
export const pushSchema = z.object({
	EXPO_ACCESS_TOKEN: z.string().optional(),
	RETENTION_ONBOARDING_V2_ENABLED: z
		.enum(["true", "false"])
		.default("false")
		.transform((value) => value === "true"),
	RETENTION_ONBOARDING_V2_TREATMENT_PERCENT: z.coerce.number().int().min(0).max(100).default(50),
});

export type PushConfig = z.infer<typeof pushSchema>;
