import type { SupportedLocale } from "@/shared/domain/locale";

export const NOTIFICATION_RECIPIENT_LOCALE_READER = Symbol("NOTIFICATION_RECIPIENT_LOCALE_READER");

/** 알림 카피 생성에 사용할 수신자 로케일 조회 capability. */
export interface NotificationRecipientLocaleReaderPort {
	getLocale(userId: string): Promise<SupportedLocale>;
}
