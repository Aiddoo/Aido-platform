import { useLogger } from '@src/bootstrap/providers/di-context';
import { ensureMe, getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useTrack } from '@src/shared/analytics';
import { getLegalUrl } from '@src/shared/constants/legal-urls';
import { getErrorMessage } from '@src/shared/errors';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useOpenInAppBrowser } from '@src/shared/hooks/use-open-in-app-browser';
import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { useLanguage } from '@src/shared/providers/language-provider';
import { readWithoutBlocking } from '@src/shared/query/read-without-blocking';
import {
  Box,
  Button,
  CheckmarkIcon,
  H4,
  HStack,
  RobotIcon,
  SendIcon,
  Text,
  TextButton,
  useOpenSheet,
  VStack,
  WordWrapText,
  Mascot,
} from '@src/shared/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useRef } from 'react';

import { CONSENT_LOG_EVENT } from '../constants/consent-log-events';
import { type Consent } from '../domains/consent.model';
import { ConsentPolicy } from '../domains/consent.model';
import { ensureConsent, getCachedConsent } from '../queries/consent-cache';
import { useUpdateAiDataSharingConsentMutationOptions } from '../queries/consent.mutations';
import { useGetConsentQueryOptions } from '../queries/consent.queries';

const ITEM_ICON_SIZE = 16;
const PRIVACY_LINK_MIN_HEIGHT = 44;

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
  const openSheet = useOpenSheet();
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
    // undefined는 답 없이 사라졌을 때라 닫은 것으로 세지 않는다
    const agreement = openSheet<boolean>(() => <AiConsentPrompt isRenewal={isRenewal} />, {
      footer: (close) => (
        <AiConsentPrompt.Actions onAgree={() => close(true)} onLater={() => close(false)} />
      ),
      dismissValue: false,
    }).then((answer) => {
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

interface AiConsentPromptProps {
  /** 이전 안내에 동의한 사람에게 바뀐 내용을 다시 알린다. 답하지 않아도 이전 동의는 그대로다 */
  isRenewal?: boolean;
}

/** AI 데이터 제공 안내 시트의 내용. 버튼은 시트 아래에 고정되는 `AiConsentPrompt.Actions`다 */
function AiConsentPrompt({ isRenewal = false }: AiConsentPromptProps) {
  const { t } = useTranslation('ai');
  const fontScaledSize = useFontScaledSize();
  const openUrl = useOpenInAppBrowser();
  const { resolvedLanguage } = useLanguage();

  return (
    <VStack gap={20} testID="ai-consent-sheet">
      <VStack gap={12} align="center">
        <Mascot name="catSuggestion" size={72} />
        <VStack gap={6} align="center">
          <H4 align="center" lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
            {t('consent.title')}
          </H4>
          <Text size="b3" shade={7} align="center">
            {isRenewal ? t('consent.renewal.subtitle') : t('consent.subtitle')}
          </Text>
        </VStack>
      </VStack>

      <VStack gap={14}>
        <ConsentItem
          icon={
            <SendIcon
              width={fontScaledSize(ITEM_ICON_SIZE)}
              height={fontScaledSize(ITEM_ICON_SIZE)}
              colorClassName="text-main"
            />
          }
          title={t('consent.items.sentData.title')}
          description={t('consent.items.sentData.description')}
        />
        <ConsentItem
          icon={
            <RobotIcon
              width={fontScaledSize(ITEM_ICON_SIZE)}
              height={fontScaledSize(ITEM_ICON_SIZE)}
              colorClassName="text-main"
            />
          }
          title={t('consent.items.processor.title')}
          description={t('consent.items.processor.description')}
        />
        <ConsentItem
          icon={
            <CheckmarkIcon
              width={fontScaledSize(ITEM_ICON_SIZE)}
              height={fontScaledSize(ITEM_ICON_SIZE)}
              colorClassName="text-main"
            />
          }
          title={t('consent.items.usage.title')}
          description={t('consent.items.usage.description')}
        />
      </VStack>

      <TextButton
        size="medium"
        variant="underline"
        accessibilityRole="link"
        style={{ minHeight: PRIVACY_LINK_MIN_HEIGHT }}
        className="justify-center self-center"
        onPress={() => openUrl(getLegalUrl('privacy', resolvedLanguage, 'overseas-transfer'))}
      >
        {t('consent.privacyLink')}
      </TextButton>

      <Text size="e1" shade={6} align="center">
        {isRenewal ? t('consent.renewal.declineNotice') : t('consent.declineNotice')}
      </Text>
    </VStack>
  );
}

interface AiConsentPromptActionsProps {
  /** 동의를 저장한 뒤 불린다. 시트를 닫고 원래 하려던 AI 동작을 잇는다 */
  onAgree: () => void;
  onLater: () => void;
}

/** 동의 저장은 버튼이 맡고, 실패하면 토스트로 알리고 시트를 그대로 둔다 */
AiConsentPrompt.Actions = function Actions({ onAgree, onLater }: AiConsentPromptActionsProps) {
  const { t } = useTranslation('ai');
  const { fontScale } = useFontScale();
  const updateConsent = useMutation(useUpdateAiDataSharingConsentMutationOptions());

  const later = (
    <Button
      variant="weak"
      color="dark"
      size="large"
      display="full"
      onPress={onLater}
      isDisabled={updateConsent.isPending}
      testID="ai-consent-later"
    >
      {t('consent.later')}
    </Button>
  );
  const agree = (
    <Button
      color="primary"
      size="large"
      display="full"
      onPress={() => updateConsent.mutate({ agreed: true }, { onSuccess: () => onAgree() })}
      isLoading={updateConsent.isPending}
      testID="ai-consent-agree"
    >
      {t('consent.agree')}
    </Button>
  );

  // 가장 큰 글자 크기에서는 두 버튼을 나란히 두면 라벨이 잘려 세로로 쌓고 동의를 위에 둔다
  if (fontScale === 'xlarge') {
    return (
      <VStack gap={8}>
        {agree}
        {later}
      </VStack>
    );
  }

  return (
    <HStack gap={8}>
      <Box className="flex-1">{later}</Box>
      <Box className="flex-1">{agree}</Box>
    </HStack>
  );
};

interface ConsentItemProps {
  icon: ReactNode;
  title: string;
  description: string;
}

function ConsentItem({ icon, title, description }: ConsentItemProps) {
  return (
    <HStack gap={12} align="start">
      <Box className="size-7 items-center justify-center rounded-full bg-main/10">{icon}</Box>
      <VStack gap={2} className="flex-1">
        <Text size="b3" weight="semibold" shade={9}>
          {title}
        </Text>
        <WordWrapText size="b4" shade={7}>
          {description}
        </WordWrapText>
      </VStack>
    </HStack>
  );
}
