import { useLogger } from '@src/bootstrap/providers/di-context';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { getErrorMessage } from '@src/shared/errors';
import { useOverlay } from '@src/shared/ui';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { withTimeout } from 'es-toolkit';
import { useRef } from 'react';

import { AiConsentBottomSheet } from '../components/ai-consent-bottom-sheet';
import { CONSENT_LOG_EVENT } from '../constants/consent-log-events';
import { type Consent } from '../domains/consent.model';
import { ConsentPolicy } from '../domains/consent.model';
import { useGetConsentQueryOptions } from '../queries/consent.queries';

/** 마이크를 누른 뒤 아무 표시 없이 기다릴 수 있는 시간. 넘기면 서버 판단에 맡기고 응답은 캐시에 쌓인다 */
export const AI_CONSENT_CHECK_TIMEOUT_MS = 3_000;

export interface AiConsentCheck {
  readonly hasAgreed: boolean;
  readonly wasAsked: boolean;
}

/** 오프라인이면 멈춘 조회의 `ensureQueryData`가 끝나지 않아(`networkMode`로도 못 푼다) 캐시만 보고, 온라인이면 제한 시간까지만 기다린다 */
export async function readWithoutBlocking<T>(
  cached: T | undefined,
  fetch: () => Promise<T>,
  onFailure: (error: unknown) => void,
) {
  if (cached != null) {
    return cached;
  }
  if (!onlineManager.isOnline()) {
    return null;
  }
  return withTimeout(fetch, AI_CONSENT_CHECK_TIMEOUT_MS).catch((error: unknown) => {
    onFailure(error);
    return null;
  });
}

interface UseAiDataSharingConsentGateOptions {
  /** 계정당 한 번 자리를 잡았으면 true다. 위층 기능이라 쓰는 쪽이 넘기고, 없으면 재안내를 띄우지 않는다 */
  claimRenewalPrompt?: (accountId: string) => boolean;
}

/** 시트가 이 훅을 쓴 컴포넌트의 overlay에 뜨므로 답을 기다리는 동안 마운트돼 있는 곳에서 쓴다 */
export function useAiDataSharingConsentGate({
  claimRenewalPrompt,
}: UseAiDataSharingConsentGateOptions = {}) {
  const overlay = useOverlay();
  const queryClient = useQueryClient();
  const logger = useLogger();
  const consentQueryOptions = useGetConsentQueryOptions();
  const meQueryOptions = useGetMeQueryOptions();

  const pendingAgreementRef = useRef<Promise<boolean> | null>(null);

  const logConsentCheckFailure = (error: unknown) =>
    logger.warn(CONSENT_LOG_EVENT.CONSENT_CHECK_FAILED, { error: getErrorMessage(error) });

  const readConsent = () =>
    readWithoutBlocking(
      queryClient.getQueryData(consentQueryOptions.queryKey),
      () => queryClient.query({ ...consentQueryOptions, staleTime: 'static' }),
      logConsentCheckFailure,
    );

  /** [나중에]·바깥 닫기·답 없이 사라짐(unmount, 경로 변경)은 false고, 이미 떠 있으면 같은 답을 기다린다 */
  const requestAgreement = ({ isRenewal = false }: { isRenewal?: boolean } = {}) => {
    if (pendingAgreementRef.current != null) {
      return pendingAgreementRef.current;
    }

    const agreement = overlay.openAsync<boolean>(
      ({ isOpen, close, unmount }) => (
        <AiConsentBottomSheet
          isOpen={isOpen}
          isRenewal={isRenewal}
          onOpenChange={(open) => {
            if (!open) {
              close(false);
            }
          }}
          onExit={unmount}
          onAgree={() => close(true)}
        />
      ),
      { dismissedValue: false },
    );
    pendingAgreementRef.current = agreement;
    agreement.then(() => {
      pendingAgreementRef.current = null;
    });

    return agreement;
  };

  /** [나중에]를 눌러도 서버로 보내지 않아 이전 동의가 남고 하던 일은 이어진다. 철회는 설정 화면에서만 한다 */
  const promptRenewalOnce = async (consent: Consent, accountId?: string): Promise<boolean> => {
    if (accountId == null || !ConsentPolicy.shouldShowAiConsentRenewal(consent)) {
      return false;
    }
    if (claimRenewalPrompt?.(accountId) !== true) {
      return false;
    }
    await requestAgreement({ isRenewal: true });
    return true;
  };

  /** wasAsked는 한 번의 AI 시도에서 안내를 두 번 띄우지 않는 데 쓴다. [나중에]는 미응답을 그대로 둔다 */
  const requestAgreementIfNeeded = async (): Promise<AiConsentCheck> => {
    // 동의 상태를 읽지 못하면 막지 않고 서버 판단에 맡긴다. 동의가 없으면 AI_1311로 다시 안내한다
    const consent = await readConsent();
    if (consent == null) {
      return { hasAgreed: true, wasAsked: false };
    }
    if (ConsentPolicy.hasAgreedToAiDataSharing(consent)) {
      const wasAsked = await promptRenewalOnce(consent, getCachedMe(queryClient)?.id);
      return { hasAgreed: true, wasAsked };
    }
    return { hasAgreed: await requestAgreement(), wasAsked: true };
  };

  /** 다 말한 뒤 막히지 않게 듣기 전에 묻는다. [나중에]면 hasAgreed가 false라 멈추지만 재안내의 [나중에]는 이어 간다 */
  const requestAgreementBeforeListening = async (): Promise<AiConsentCheck> => {
    const [consent, me] = await Promise.all([
      readConsent(),
      // 내 정보를 기다려 마이크 권한처럼 뒤에 오는 단계가 재안내를 앞지르지 않게 한다
      readWithoutBlocking(
        getCachedMe(queryClient),
        () => queryClient.query({ ...meQueryOptions, staleTime: 'static' }),
        logConsentCheckFailure,
      ),
    ]);
    if (consent == null) {
      return { hasAgreed: true, wasAsked: false };
    }
    if (ConsentPolicy.hasAgreedToAiDataSharing(consent)) {
      return { hasAgreed: true, wasAsked: await promptRenewalOnce(consent, me?.id) };
    }
    return { hasAgreed: await requestAgreement(), wasAsked: true };
  };

  /** 캐시 기준으로 동의가 필요한지. 서버가 AI_1311로 거절하면 AI mutation이 캐시를 미응답으로 되돌린다 */
  const isConsentRequired = (): boolean => {
    const consent = queryClient.getQueryData(consentQueryOptions.queryKey);
    return consent != null && !ConsentPolicy.hasAgreedToAiDataSharing(consent);
  };

  return {
    requestAgreementIfNeeded,
    requestAgreementBeforeListening,
    requestAgreement,
    isConsentRequired,
  };
}
