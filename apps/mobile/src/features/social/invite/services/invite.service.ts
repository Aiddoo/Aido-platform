import type { ApiError } from '@src/core/errors/api-error';
import { err, type Result } from '@src/core/errors/result';
import type { AppLogger } from '@src/core/ports/app-logger';
import type { InstallationIdGateway } from '@src/core/ports/installation-id-gateway';
import { BusinessError, getErrorMessage } from '@src/shared/errors';

import type { InviteApi } from '../apis/invite.api';
import { INVITE_LOG_EVENT } from '../constants/invite-log-events';
import { parseInviteCode } from '../domains/invite-code.model';
import type { InvitePreview } from '../domains/invite-preview.model';
import type { RedemptionResult } from '../domains/invite-redemption.model';
import { INVITE_ERROR_CODE, type InviteErrorCode } from '../domains/invite.error';
import type { PendingRedemptionService } from './pending-redemption.service';

type InviteServiceError = ApiError | BusinessError<InviteErrorCode>;

interface InviteServicePorts {
  inviteApi: Pick<InviteApi, 'getPreview' | 'redeem'>;
  /** 미리보기가 더는 쓸 수 없는 초대라고 알려 주면 남겨 둔 초대를 지운다 */
  pendingRedemptionService: Pick<PendingRedemptionService, 'clearPendingRedemptionIfTerminal'>;
  installationId: InstallationIdGateway;
  logger: Pick<AppLogger, 'warn'>;
}

/** 사용자가 적거나 링크로 받은 코드를 확인하고, 기기에 남긴 초대·설치 식별자와 엮어 서버에 묻는다 */
export class InviteService {
  readonly #inviteApi: InviteServicePorts['inviteApi'];
  readonly #pendingRedemptionService: InviteServicePorts['pendingRedemptionService'];
  readonly #installationId: InstallationIdGateway;
  readonly #logger: Pick<AppLogger, 'warn'>;

  constructor({ inviteApi, pendingRedemptionService, installationId, logger }: InviteServicePorts) {
    this.#inviteApi = inviteApi;
    this.#pendingRedemptionService = pendingRedemptionService;
    this.#installationId = installationId;
    this.#logger = logger;
  }

  /** 이어서 열려던 초대가 없어졌거나 바뀌어 미리보기를 받지 못했으면 기기에 남긴 초대도 지워 다음 실행 때 다시 열지 않는다 */
  getPreview = async (
    rawCode: string,
    signal?: AbortSignal,
  ): Promise<Result<InvitePreview, InviteServiceError>> => {
    const inviteCode = parseInviteCode(rawCode);
    if (inviteCode == null) {
      return err(new BusinessError(INVITE_ERROR_CODE.INVALID_CODE));
    }

    const result = await this.#inviteApi.getPreview(inviteCode, signal);
    if (!result.ok) {
      this.#pendingRedemptionService.clearPendingRedemptionIfTerminal(inviteCode, result.error);
    }
    return result;
  };

  /** 초대를 수락한다. 같은 기기에서 보상을 두 번 받지 않게 설치 식별자를 함께 보낸다 */
  redeem = async (rawCode: string): Promise<Result<RedemptionResult, InviteServiceError>> => {
    const inviteCode = parseInviteCode(rawCode);
    if (inviteCode == null) {
      return err(new BusinessError(INVITE_ERROR_CODE.INVALID_CODE));
    }

    const installationId = await this.#installationId.get().catch((error: unknown) => {
      this.#logger.warn(INVITE_LOG_EVENT.INSTALLATION_ID_READ_FAILED, {
        error: getErrorMessage(error),
      });
      return null;
    });
    return this.#inviteApi.redeem(inviteCode, installationId);
  };
}
