import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";

export const NOTIFICATION_COPY_REVISION = "1.15.0";

export const withNotificationCopyRevision = (
  data: CreateNotificationData,
): CreateNotificationData =>
  data.variantId
    ? { ...data, metadata: { ...data.metadata, copyRevision: NOTIFICATION_COPY_REVISION } }
    : data;
