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

// 넘기면 서버 판단에 맡기고 응답은 캐시에 쌓인다
export const AI_CONSENT_CHECK_TIMEOUT_MS = 3_000;

export interface AiConsentCheck {
  readonly hasAgreed: boolean;
  readonly wasAsked: boolean;
}

// 오프라인이면 TanStack Query가 조회를 멈춰 ensureQueryData가 끝나지 않아 캐시만 보고, 온라인이면 제한 시간까지만 기다린다
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
  // 위층 기능(기기 안내)이 필요해 쓰는 쪽이 넘기고, 없으면 재안내를 띄우지 않는다
  claimRenewalPrompt?: (accountId: string) => boolean;
}

// 시트는 이 훅을 쓴 컴포넌트의 overlay에 뜨므로 답을 기다리는 동안 마운트된 곳에서 쓴다
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
      () => queryClient.ensureQueryData(consentQueryOptions),
      logConsentCheckFailure,
    );

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

  // 나중에를 눌러도 서버로 보내지 않아 이전 동의가 남고, 철회는 설정 화면에서만 한다
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

  // wasAsked는 한 번의 AI 시도에서 안내를 두 번 띄우지 않는 데 쓴다
  const requestAgreementIfNeeded = async (): Promise<AiConsentCheck> => {
    // 동의 상태를 읽지 못하면 막지 않고 서버에 맡긴다. 동의가 없으면 AI_1311로 다시 안내한다
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

  // 다 말한 뒤에 막히지 않게 듣기 전에 받고, 권한 요청 같은 뒤 단계가 안내를 앞지르지 않게 제한 시간까지 기다린다
  const requestAgreementBeforeListening = async (): Promise<AiConsentCheck> => {
    const [consent, me] = await Promise.all([
      readConsent(),
      readWithoutBlocking(
        getCachedMe(queryClient),
        () => queryClient.ensureQueryData(meQueryOptions),
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
