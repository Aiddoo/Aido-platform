import { z } from "zod";

/** Expo Push 서비스 인증 설정. Enhanced Push Security를 사용하지 않으면 선택적이다. */
export const pushSchema = z.object({
	EXPO_ACCESS_TOKEN: z.string().optional(),
});

export type PushConfig = z.infer<typeof pushSchema>;
