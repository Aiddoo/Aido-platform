import { useUpdateMarketingPushConsentMutationOptions } from '@src/features/identity/consent/queries/consent.mutations';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, H4, HStack, NotificationIllustration, Text, VStack } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';

interface MarketingPushOptInActionsProps {
  /** 서버가 동의를 기록한 뒤 불린다 */
  onAgree: () => void;
  onLater: () => void;
}

/** 혜택·소식 알림 제안 시트의 내용. 버튼은 시트 아래에 고정되는 `MarketingPushOptIn.Actions`다 */
export function MarketingPushOptIn() {
  const { t } = useTranslation('notification');

  return (
    <VStack gap={12} align="center">
      <NotificationIllustration size="block" />
      <VStack gap={6} align="center">
        <H4 align="center" lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
          {t('marketingOptIn.title')}
        </H4>
        <Text size="b3" shade={7} align="center">
          {t('marketingOptIn.description')}
        </Text>
      </VStack>
      <Text size="e1" shade={6} align="center">
        {t('marketingOptIn.notice')}
      </Text>
    </VStack>
  );
}

// 정보통신망법 opt-in이라 서버 동의 기록이 성공한 뒤에만 동의로 닫는다. 실패하면 토스트로 알리고 시트를 둔다
MarketingPushOptIn.Actions = function Actions({
  onAgree,
  onLater,
}: MarketingPushOptInActionsProps) {
  const { t } = useTranslation('notification');
  const agree = useMutation(useUpdateMarketingPushConsentMutationOptions());

  return (
    <HStack gap={8}>
      <Box flex={1}>
        <Button
          variant="weak"
          color="dark"
          size="large"
          isDisabled={agree.isPending}
          onPress={onLater}
        >
          {t('marketingOptIn.later')}
        </Button>
      </Box>
      <Box flex={1}>
        <Button
          size="large"
          isLoading={agree.isPending}
          onPress={() => agree.mutate({ agreed: true }, { onSuccess: () => onAgree() })}
        >
          {t('marketingOptIn.agree')}
        </Button>
      </Box>
    </HStack>
  );
};
