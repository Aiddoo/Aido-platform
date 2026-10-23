import type { BusinessError } from '@src/shared/errors';
import { t } from '@src/shared/i18n';

export const NotificationErrorCode = {
  PERMISSION_DENIED: 'NOTIFICATION_PERMISSION_DENIED',
  NOT_PHYSICAL_DEVICE: 'NOTIFICATION_NOT_PHYSICAL_DEVICE',
  VALIDATION_FAILED: 'NOTIFICATION_VALIDATION_FAILED',
} as const;

export type NotificationErrorCode =
  (typeof NotificationErrorCode)[keyof typeof NotificationErrorCode];

export class NotificationError extends Error implements BusinessError {
  override readonly name = 'NotificationError';

  constructor(
    public readonly code: NotificationErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const NotificationErrors = {
  permissionDenied: () =>
    new NotificationError(
      NotificationErrorCode.PERMISSION_DENIED,
      t('notification:errors.permissionDenied'),
    ),
  notPhysicalDevice: () =>
    new NotificationError(
      NotificationErrorCode.NOT_PHYSICAL_DEVICE,
      t('notification:errors.notPhysicalDevice'),
    ),
  validationFailed: () =>
    new NotificationError(
      NotificationErrorCode.VALIDATION_FAILED,
      t('notification:errors.validationFailed'),
    ),
} as const;

export const isNotificationError = (error: unknown): error is NotificationError =>
  error instanceof NotificationError;

export const isPermissionDeniedError = (error: unknown): boolean =>
  error instanceof NotificationError && error.code === NotificationErrorCode.PERMISSION_DENIED;

export const isNotPhysicalDeviceError = (error: unknown): boolean =>
  error instanceof NotificationError && error.code === NotificationErrorCode.NOT_PHYSICAL_DEVICE;
