import { useLogger } from '@src/bootstrap/providers/di-context';
import { ensureMe, getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useTrack } from '@src/shared/analytics';
import { getErrorMessage } from '@src/shared/errors';
import { readWithoutBlocking } from '@src/shared/query/read-without-blocking';
import { useOverlay } from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { AiConsentBottomSheet } from '../components/ai-consent-bottom-sheet';
import { CONSENT_LOG_EVENT } from '../constants/consent-log-events';
import { type Consent } from '../domains/consent.model';
import { ConsentPolicy } from '../domains/consent.model';
import { ensureConsent, getCachedConsent } from '../queries/consent-cache';
import { useGetConsentQueryOptions } from '../queries/consent.queries';

export interface AiConsentCheck {
  readonly hasAgreed: boolean;
  readonly wasAsked: boolean;
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
  const { trackEvent } = useTrack();
  const consentQueryOptions = useGetConsentQueryOptions();
  const meQueryOptions = useGetMeQueryOptions();

  const pendingAgreementRef = useRef<Promise<boolean> | null>(null);

  const logConsentCheckFailure = (error: unknown) =>
    logger.warn(CONSENT_LOG_EVENT.CONSENT_CHECK_FAILED, { error: getErrorMessage(error) });

  const readConsent = () =>
    readWithoutBlocking(
      getCachedConsent(queryClient),
      () => ensureConsent(queryClient, consentQueryOptions),
      logConsentCheckFailure,
    );

  /** [나중에]·바깥 닫기·답 없이 사라짐(unmount, 경로 변경)은 false고, 이미 떠 있으면 같은 답을 기다린다 */
  const requestAgreement = ({ isRenewal = false }: { isRenewal?: boolean } = {}) => {
    if (pendingAgreementRef.current != null) {
      return pendingAgreementRef.current;
    }

    trackEvent('ai_consent_prompt_shown', { is_renewal: isRenewal });
    // null은 답 없이 사라졌을 때라 닫은 것으로 세지 않는다. 동의 뒤 닫힘 애니메이션의 알림은 처음 답이 이긴다
    const agreement = overlay
      .openAsync<boolean | null>(
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
        { dismissedValue: null },
      )
      .then((answer) => {
        pendingAgreementRef.current = null;
        if (answer === false) {
          trackEvent('ai_consent_prompt_dismissed', { is_renewal: isRenewal });
        }
        return answer === true;
      });
    pendingAgreementRef.current = agreement;

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
        () => ensureMe(queryClient, meQueryOptions),
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
    const consent = getCachedConsent(queryClient);
    return consent != null && !ConsentPolicy.hasAgreedToAiDataSharing(consent);
  };

  return {
    requestAgreementIfNeeded,
    requestAgreementBeforeListening,
    requestAgreement,
    isConsentRequired,
  };
}
