import { type NotificationRouting, notificationRoutingSchema } from "@aido/validators";

/**
 * 전용 컬럼이 없어 metadata에 실려 있는 이동 재료를 꺼낸다.
 * 알림마다 metadata 모양이 달라 통과하지 못하면 빈 값으로 둔다.
 */
export function toNotificationRouting(metadata: unknown): NotificationRouting | undefined {
	const parsed = notificationRoutingSchema.safeParse(metadata);

	if (!parsed.success) {
		return undefined;
	}

	const hasRouting = Object.values(parsed.data).some((value) => value !== undefined);

	return hasRouting ? parsed.data : undefined;
}
