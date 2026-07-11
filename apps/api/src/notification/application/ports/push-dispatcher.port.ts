import type { SupportedLocale } from "@/shared/presentation/decorators";

import type { NotificationType } from "../../domain/types/notification-type";
import type { CreateNotificationData } from "./notification-data";

export const PUSH_DISPATCHER = Symbol("PUSH_DISPATCHER");

/**
 * 푸시 발송 디스패처 포트.
 *
 * 푸시 전송 메커니즘(토큰 조회·발송·무효토큰 정리·fire-and-forget 추적·종료 대기)과
 * 발송 자격 판단(사용자 설정·야간·마케팅 동의·rate limit)을 캡슐화한다.
 * 알림 생성 use-case가 DB 기록 후 이 포트로 푸시를 위임한다.
 */
export interface PushDispatcherPort {
	/** 단일 사용자 푸시 발송 가능 여부(설정·야간·마케팅·rate limit) */
	shouldSendPush(userId: string, type: NotificationType): Promise<boolean>;

	/** 수신자 푸시 언어(preference 캐시 경유, shouldSendPush와 캐시 공유) */
	getUserLocale(userId: string): Promise<SupportedLocale>;

	/** 단일 사용자 푸시 발송(fire-and-forget) */
	fireAndForgetPush(data: CreateNotificationData, notificationId: number): void;

	/** 다수 사용자 배치 푸시 발송(fire-and-forget, 배치 자격 필터 포함) */
	fireAndForgetBatchPush(dataList: CreateNotificationData[]): void;
}
