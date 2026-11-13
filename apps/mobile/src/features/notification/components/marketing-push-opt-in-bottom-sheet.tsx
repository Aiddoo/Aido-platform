import { useUpdateMarketingPushConsentMutationOptions } from '@src/features/identity/consent/queries/consent.mutations';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  H4,
  HStack,
  ModalBottomSheet,
  NotificationIllustration,
  Text,
  VStack,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

type MarketingPushOptInBottomSheetProps = Omit<
  ComponentProps<typeof ModalBottomSheet>,
  'children' | 'footer'
> & {
  /** 서버가 동의를 기록한 뒤 불린다 */
  onAgree: () => void;
};

// 정보통신망법 opt-in이라 서버 동의 기록이 성공한 뒤에만 닫는다. 실패하면 토스트로 알리고 시트를 둔다
export function MarketingPushOptInBottomSheet({
  onAgree,
  onOpenChange,
  ...sheetProps
}: MarketingPushOptInBottomSheetProps) {
  const { t } = useTranslation('notification');
  const agree = useMutation(useUpdateMarketingPushConsentMutationOptions());

  return (
    <ModalBottomSheet
      {...sheetProps}
      onOpenChange={(isOpen) => {
        // 동의를 기록하는 동안 닫으면 결과를 알 수 없어 막는다
        if (!agree.isPending) {
          onOpenChange(isOpen);
        }
      }}
      footer={
        <HStack gap={8}>
          <Box flex={1}>
            <Button
              variant="weak"
              color="dark"
              size="large"
              isDisabled={agree.isPending}
              onPress={() => onOpenChange(false)}
            >
              {t('marketingOptIn.later')}
            </Button>
          </Box>
          <Box flex={1}>
            <Button
              size="large"
              isLoading={agree.isPending}
              onPress={() =>
                agree.mutate(
                  { agreed: true, source: 'completion_sheet' },
                  { onSuccess: () => onAgree() },
                )
              }
            >
              {t('marketingOptIn.agree')}
            </Button>
          </Box>
        </HStack>
      }
    >
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
    </ModalBottomSheet>
  );
}
