import { ConsentPolicy } from '@src/features/auth/domains/auth.model';
import { useGetConsentQueryOptions } from '@src/features/auth/queries/get-consent-query-options';
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
  const consentQueryOptions = useGetConsentQueryOptions();

  /** 동의 안내를 띄우고 동의했는지 돌려준다. [나중에]나 바깥을 눌러 닫으면 false다 */
  const requestAgreement = () =>
    overlay.open<boolean>(({ isOpen, close, exit }) => (
      <AiConsentBottomSheet
        isOpen={isOpen}
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
   * 이미 동의했으면 바로, 아니면 안내를 띄워 답을 받는다. wasAsked는 이번에 안내를 띄웠는지로,
   * 한 번의 AI 시도에서 안내를 두 번 띄우지 않는 데 쓴다. [나중에]는 미응답을 그대로 둔다.
   */
  const ensureAgreed = async (): Promise<AiConsentCheck> => {
    // 동의 상태를 읽지 못하면 막지 않고 서버 판단에 맡긴다. 동의가 없으면 AI_1311로 다시 안내한다
    const consent = await queryClient.ensureQueryData(consentQueryOptions).catch(() => null);
    if (consent == null || ConsentPolicy.hasAgreedToAiDataSharing(consent)) {
      return { isAgreed: true, wasAsked: false };
    }
    return { isAgreed: await requestAgreement(), wasAsked: true };
  };

  /** 캐시 기준으로 동의가 필요한지. 서버가 AI_1311로 거절하면 AI mutation이 캐시를 미응답으로 되돌린다 */
  const isAgreementRequired = (): boolean => {
    const consent = queryClient.getQueryData(consentQueryOptions.queryKey);
    return consent != null && !ConsentPolicy.hasAgreedToAiDataSharing(consent);
  };

  return { ensureAgreed, requestAgreement, isAgreementRequired };
}
