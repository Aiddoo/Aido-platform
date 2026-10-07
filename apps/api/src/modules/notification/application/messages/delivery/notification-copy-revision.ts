import type { CreateNotificationData } from "../../ports/delivery/notification-data.js";

export const NOTIFICATION_COPY_REVISION = "1.11.0";

export const withNotificationCopyRevision = (
  data: CreateNotificationData,
): CreateNotificationData =>
  data.variantId
    ? { ...data, metadata: { ...data.metadata, copyRevision: NOTIFICATION_COPY_REVISION } }
    : data;
