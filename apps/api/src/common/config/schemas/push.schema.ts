import { z } from "zod";

/**
 * Expo Push 알림 설정 스키마
 * 향후 확장용 - 현재는 선택적
 */
export const pushSchema = z.object({
	EXPO_ACCESS_TOKEN: z.string().optional(),
});

export type PushConfig = z.infer<typeof pushSchema>;
