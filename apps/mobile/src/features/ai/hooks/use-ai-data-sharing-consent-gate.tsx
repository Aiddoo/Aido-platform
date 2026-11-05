import { useCoachmarkService, useLogger } from '@src/bootstrap/providers/di-context';
import { type Consent, ConsentPolicy } from '@src/features/auth/domains/auth.model';
import { useGetConsentQueryOptions } from '@src/features/auth/queries/get-consent-query-options';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { getCachedMe } from '@src/features/user/queries/user-cache';
import { getErrorMessage } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useTranslation } from '@src/shared/i18n';
import { useOverlay } from '@src/shared/ui';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { withTimeout } from 'es-toolkit';

import { AiConsentBottomSheet } from '../components/ai-consent-bottom-sheet';
import { AI_LOG_EVENT } from '../constants/ai-log-events';

/** 마이크를 누른 뒤 아무 표시 없이 기다릴 수 있는 시간. 넘기면 서버 판단에 맡기고 응답은 캐시에 쌓인다 */
export const AI_CONSENT_CHECK_TIMEOUT_MS = 3_000;

export interface AiConsentCheck {
  readonly isAgreed: boolean;
  readonly wasAsked: boolean;
}

/**
 * 시작을 막지 않고 값을 읽는다. 오프라인이면 TanStack Query가 요청을 멈춰 두어 `ensureQueryData`가 연결될 때까지
 * 끝나지 않으므로(`networkMode`를 바꿔도 이미 멈춘 조회의 약속을 받는다) 캐시만 보고, 온라인이면 제한 시간까지만 기다린다.
 */
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

/**
 * AI에 내용을 보내기 전에 AI 데이터 제공 동의를 확인한다.
 * 시트는 이 훅을 쓴 컴포넌트의 overlay에 뜨므로, 답을 기다리는 동안 마운트돼 있는 곳에서 쓴다.
 */
export function useAiDataSharingConsentGate() {
  const { t } = useTranslation('ai');
  const toast = useAppToast();
  const overlay = useOverlay();
  const queryClient = useQueryClient();
  const coachmarkService = useCoachmarkService();
  const logger = useLogger();
  const consentQueryOptions = useGetConsentQueryOptions();
  const meQueryOptions = useGetMeQueryOptions();

  const logConsentCheckFailure = (error: unknown) =>
    logger.warn(AI_LOG_EVENT.CONSENT_CHECK_FAILED, { error: getErrorMessage(error) });

  const readConsent = () =>
    readWithoutBlocking(
      queryClient.getQueryData(consentQueryOptions.queryKey),
      () => queryClient.ensureQueryData(consentQueryOptions),
      logConsentCheckFailure,
    );

  /** 동의 안내를 띄우고 동의했는지 돌려준다. [나중에]나 바깥을 눌러 닫으면 false다 */
  const requestAgreement = ({ isRenewal = false }: { isRenewal?: boolean } = {}) =>
    overlay.open<boolean>(({ isOpen, close, exit }) => (
      <AiConsentBottomSheet
        isOpen={isOpen}
        isRenewal={isRenewal}
        onOpenChange={(open) => {
          if (!open) {
            close(false);
          }
        }}
        onExit={exit}
        onAgree={() => close(true)}
      />
    ));

  /**
   * 이전 안내에 동의한 사람에게 바뀐 안내를 계정마다 한 번 보여 준다. 나중에를 눌러도 서버로 보내지 않아
   * 이전 동의가 그대로 남고, 하던 일은 이어진다. 철회는 설정 화면에서만 한다.
   */
  const showRenewalOnce = async (consent: Consent, accountId?: string): Promise<boolean> => {
    if (accountId == null || !ConsentPolicy.shouldShowAiConsentRenewal(consent)) {
      return false;
    }
    if (!coachmarkService.claim({ accountId, kind: 'ai-consent-renewal' })) {
      return false;
    }
    await requestAgreement({ isRenewal: true });
    return true;
  };

  /**
   * 이미 동의했으면 바로, 아니면 안내를 띄워 답을 받는다. wasAsked는 이번에 안내를 띄웠는지로,
   * 한 번의 AI 시도에서 안내를 두 번 띄우지 않는 데 쓴다. [나중에]는 미응답을 그대로 둔다.
   */
  const ensureAgreed = async (): Promise<AiConsentCheck> => {
    // 동의 상태를 읽지 못하면 막지 않고 서버 판단에 맡긴다. 동의가 없으면 AI_1311로 다시 안내한다
    const consent = await readConsent();
    if (consent == null) {
      return { isAgreed: true, wasAsked: false };
    }
    if (ConsentPolicy.hasAgreedToAiDataSharing(consent)) {
      const wasAsked = await showRenewalOnce(consent, getCachedMe(queryClient)?.id);
      return { isAgreed: true, wasAsked };
    }
    return { isAgreed: await requestAgreement(), wasAsked: true };
  };

  /**
   * 듣기 전에 동의를 받는다. 다 말한 뒤에 막히지 않게, 미응답이면 시작할 때마다 안내를 띄우고 [나중에]면 isAgreed는 false다.
   * 호출한 쪽은 그 자리에서 멈춘다. 이전 안내에 동의한 사람은 재안내에서 [나중에]를 눌러도 이어 간다.
   * 내 정보를 아직 못 받았으면 제한 시간까지 기다려, 마이크 권한처럼 뒤에 오는 단계가 안내를 앞지르지 않게 한다.
   */
  const ensureAgreedBeforeListening = async (): Promise<AiConsentCheck> => {
    const [consent, me] = await Promise.all([
      readConsent(),
      readWithoutBlocking(
        getCachedMe(queryClient),
        () => queryClient.ensureQueryData(meQueryOptions),
        logConsentCheckFailure,
      ),
    ]);
    if (consent == null) {
      return { isAgreed: true, wasAsked: false };
    }
    if (ConsentPolicy.hasAgreedToAiDataSharing(consent)) {
      return { isAgreed: true, wasAsked: await showRenewalOnce(consent, me?.id) };
    }
    const isAgreed = await requestAgreement();
    if (!isAgreed) {
      toast.toast(t('consent.notice.voice'));
    }
    return { isAgreed, wasAsked: true };
  };

  /** 캐시 기준으로 동의가 필요한지. 서버가 AI_1311로 거절하면 AI mutation이 캐시를 미응답으로 되돌린다 */
  const isAgreementRequired = (): boolean => {
    const consent = queryClient.getQueryData(consentQueryOptions.queryKey);
    return consent != null && !ConsentPolicy.hasAgreedToAiDataSharing(consent);
  };

  return { ensureAgreed, ensureAgreedBeforeListening, requestAgreement, isAgreementRequired };
}
