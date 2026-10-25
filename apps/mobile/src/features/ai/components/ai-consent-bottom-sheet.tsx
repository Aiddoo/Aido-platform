import { useUpdateAiDataSharingConsentMutationOptions } from '@src/features/auth/queries/use-update-ai-data-sharing-consent-mutation-options';
import { LEGAL_URLS } from '@src/shared/constants/legal-urls';
import { useOpenUrl } from '@src/shared/hooks/use-open-url';
import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import {
  Box,
  Button,
  CheckboxIcon,
  H4,
  HStack,
  LockIcon,
  ModalBottomSheet,
  RobotIcon,
  SendIcon,
  Text,
  TextButton,
  VStack,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import type { ComponentProps, ReactNode } from 'react';
import { Image } from 'react-native';

const ITEM_ICON_SIZE = 16;
const PRIVACY_LINK_MIN_HEIGHT = 44;

type AiConsentBottomSheetProps = Omit<ComponentProps<typeof ModalBottomSheet>, 'children'> & {
  /** 동의를 저장한 뒤 호출된다. 시트를 닫고 원래 하려던 AI 동작을 잇는다 */
  onAgree: () => void;
};

/**
 * AI에 내용을 처음 보내기 전에 무엇을 어디로 보내는지 알리고 동의를 받는다.
 * 동의 저장은 시트가 맡고, 저장에 실패하면 토스트로 알리고 시트를 그대로 둔다.
 */
export function AiConsentBottomSheet({
  onAgree,
  onOpenChange,
  ...sheetProps
}: AiConsentBottomSheetProps) {
  const { t } = useTranslation('ai');
  const openUrl = useOpenUrl();
  const updateConsent = useMutation(useUpdateAiDataSharingConsentMutationOptions());

  const handleAgree = () => updateConsent.mutate({ agreed: true }, { onSuccess: () => onAgree() });

  return (
    <ModalBottomSheet
      {...sheetProps}
      onOpenChange={onOpenChange}
      footer={
        <ConsentActions
          later={
            <Button
              variant="weak"
              color="dark"
              size="large"
              display="full"
              onPress={() => onOpenChange(false)}
              isDisabled={updateConsent.isPending}
            >
              {t('consent.later')}
            </Button>
          }
          agree={
            <Button
              color="primary"
              size="large"
              display="full"
              onPress={handleAgree}
              isLoading={updateConsent.isPending}
            >
              {t('consent.agree')}
            </Button>
          }
        />
      }
    >
      <VStack gap={20}>
        <VStack gap={12} align="center">
          <Image
            source={require('@assets/images/ido_cat_suggestion.webp')}
            style={{ width: 72, height: 72 }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <VStack gap={6} align="center">
            <H4 align="center" lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
              {t('consent.title')}
            </H4>
            <Text size="b3" shade={7} align="center">
              {t('consent.subtitle')}
            </Text>
          </VStack>
        </VStack>

        <VStack gap={14}>
          <ConsentItem
            icon={
              <SendIcon
                width={ITEM_ICON_SIZE}
                height={ITEM_ICON_SIZE}
                colorClassName="text-gray-7"
              />
            }
            title={t('consent.items.sentData.title')}
            description={t('consent.items.sentData.description')}
          />
          <ConsentItem
            icon={
              <RobotIcon
                width={ITEM_ICON_SIZE}
                height={ITEM_ICON_SIZE}
                colorClassName="text-gray-7"
              />
            }
            title={t('consent.items.processor.title')}
            description={t('consent.items.processor.description')}
          />
          <ConsentItem
            icon={
              <CheckboxIcon
                width={ITEM_ICON_SIZE}
                height={ITEM_ICON_SIZE}
                colorClassName="text-gray-7"
              />
            }
            title={t('consent.items.usage.title')}
            description={t('consent.items.usage.description')}
          />
          <ConsentItem
            icon={
              <LockIcon
                width={ITEM_ICON_SIZE}
                height={ITEM_ICON_SIZE}
                colorClassName="text-gray-7"
              />
            }
            title={t('consent.items.retention.title')}
            description={t('consent.items.retention.description')}
          >
            <TextButton
              size="medium"
              variant="underline"
              accessibilityRole="link"
              style={{ minHeight: PRIVACY_LINK_MIN_HEIGHT }}
              className="self-start justify-center"
              onPress={() => openUrl(LEGAL_URLS.PRIVACY)}
            >
              {t('consent.privacyLink')}
            </TextButton>
          </ConsentItem>
        </VStack>

        <Text size="e1" shade={6} align="center">
          {t('consent.declineNotice')}
        </Text>
      </VStack>
    </ModalBottomSheet>
  );
}

interface ConsentItemProps {
  icon: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}

function ConsentItem({ icon, title, description, children }: ConsentItemProps) {
  return (
    <HStack gap={12} align="start">
      <Box className="size-7 items-center justify-center rounded-full bg-gray-2">{icon}</Box>
      <VStack gap={2} className="flex-1">
        <Text size="b3" weight="semibold" shade={9}>
          {title}
        </Text>
        <Text size="b4" shade={7}>
          {description}
        </Text>
        {children}
      </VStack>
    </HStack>
  );
}

/** 가장 큰 글자 크기에서는 두 버튼을 나란히 두면 라벨이 잘려 세로로 쌓고 동의를 위에 둔다 */
function ConsentActions({ later, agree }: { later: ReactNode; agree: ReactNode }) {
  const { fontScale } = useFontScale();

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
}
