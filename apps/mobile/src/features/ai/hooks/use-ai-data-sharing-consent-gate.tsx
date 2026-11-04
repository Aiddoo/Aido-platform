import { useCoachmarkService } from '@src/bootstrap/providers/di-context';
import { type Consent, ConsentPolicy } from '@src/features/auth/domains/auth.model';
import { useGetConsentQueryOptions } from '@src/features/auth/queries/get-consent-query-options';
import { getCachedMe } from '@src/features/user/queries/user-cache';
import { useOverlay } from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';

import { AiConsentBottomSheet } from '../components/ai-consent-bottom-sheet';

export interface AiConsentCheck {
  readonly isAgreed: boolean;
  readonly wasAsked: boolean;
}

/**
 * AI에 내용을 보내기 전에 AI 데이터 제공 동의를 확인한다.
 * 시트는 이 훅을 쓴 컴포넌트의 overlay에 뜨므로, 답을 기다리는 동안 마운트돼 있는 곳에서 쓴다.
 */
export function useAiDataSharingConsentGate() {
  const overlay = useOverlay();
  const queryClient = useQueryClient();
  const coachmarkService = useCoachmarkService();
  const consentQueryOptions = useGetConsentQueryOptions();

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
    const consent = await queryClient.ensureQueryData(consentQueryOptions).catch(() => null);
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
   * 계정마다 한 번만 동의 안내를 띄운다. 이미 한 번 봤거나 [나중에]를 눌렀다면 다시 묻지 않고 isAgreed는 false다.
   * 거절해도 동의를 철회하지 않으므로 호출한 쪽은 기존 동작을 이어 가고, 서버가 AI_1311로 막을 때만 다시 안내한다.
   */
  const ensureAgreedOnce = async (accountId: string): Promise<AiConsentCheck> => {
    const consent = await queryClient.ensureQueryData(consentQueryOptions).catch(() => null);
    if (consent == null) {
      return { isAgreed: true, wasAsked: false };
    }
    if (ConsentPolicy.hasAgreedToAiDataSharing(consent)) {
      return { isAgreed: true, wasAsked: await showRenewalOnce(consent, accountId) };
    }
    if (!coachmarkService.claim({ accountId, kind: 'ai-consent-notice' })) {
      return { isAgreed: false, wasAsked: false };
    }
    return { isAgreed: await requestAgreement(), wasAsked: true };
  };

  /** 캐시 기준으로 동의가 필요한지. 서버가 AI_1311로 거절하면 AI mutation이 캐시를 미응답으로 되돌린다 */
  const isAgreementRequired = (): boolean => {
    const consent = queryClient.getQueryData(consentQueryOptions.queryKey);
    return consent != null && !ConsentPolicy.hasAgreedToAiDataSharing(consent);
  };

  return { ensureAgreed, ensureAgreedOnce, requestAgreement, isAgreementRequired };
}
