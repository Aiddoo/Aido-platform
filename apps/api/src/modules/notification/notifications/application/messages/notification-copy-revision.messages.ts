import type { CreateNotificationData } from "../../../shared/domain/notification-draft.constants.js";

// 서버는 버전 번호가 없어 문구를 바꾼 날짜로 이전 문구와 성과를 나눈다
export const NOTIFICATION_COPY_REVISION = "2026-11-18";

export const withNotificationCopyRevision = (
  data: CreateNotificationData,
): CreateNotificationData =>
  data.variantId
    ? { ...data, metadata: { ...data.metadata, copyRevision: NOTIFICATION_COPY_REVISION } }
    : data;
