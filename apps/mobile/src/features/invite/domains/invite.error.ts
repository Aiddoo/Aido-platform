import type { BusinessError } from '@src/shared/errors';
import { t } from '@src/shared/i18n';

export const InviteErrorCode = {
  INVALID_CODE: 'INVITE_INVALID_CODE',
} as const;

export type InviteErrorCode = (typeof InviteErrorCode)[keyof typeof InviteErrorCode];

export class InviteError extends Error implements BusinessError {
  override readonly name = 'InviteError';

  constructor(
    public readonly code: InviteErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const InviteErrors = {
  invalidCode: () => new InviteError(InviteErrorCode.INVALID_CODE, t('invite:errors.invalidCode')),
} as const;

export const isInviteError = (error: unknown): error is InviteError => error instanceof InviteError;
