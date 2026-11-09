import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  H3,
  LocationIllustration,
  ReadableContent,
  Spacing,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';

interface WeatherLocationPromptProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

/** 시스템 위치 창 앞 화면이라 창을 건너뛰는 버튼을 두지 않는다(App Store 5.1.1). 나가는 길은 헤더 뒤로 가기다 */
export function WeatherLocationPrompt({
  title,
  description,
  actionLabel,
  onAction,
}: WeatherLocationPromptProps) {
  return (
    <StyledSafeAreaView className="flex-1 bg-white">
      <ReadableContent flex={1}>
        <VStack flex={1} align="center" justify="center" className="px-6">
          <LocationIllustration />

          <Spacing size={20} />

          <H3 align="center" lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
            {title}
          </H3>

          <Spacing size={8} />

          <Text size="b3" shade={6} align="center">
            {description}
          </Text>
        </VStack>

        <Box className="px-4 pb-4">
          <Button size="large" onPress={onAction}>
            {actionLabel}
          </Button>
        </Box>
      </ReadableContent>
    </StyledSafeAreaView>
  );
}

interface AskProps {
  onContinue: () => void;
}

WeatherLocationPrompt.Ask = function Ask({ onContinue }: AskProps) {
  const { t } = useTranslation('weather');

  return (
    <WeatherLocationPrompt
      title={t('locationPrompt.title')}
      description={t('locationPrompt.description')}
      actionLabel={t('locationPrompt.continue')}
      onAction={onContinue}
    />
  );
};

interface DeniedProps {
  onOpenSettings: () => void;
}

WeatherLocationPrompt.Denied = function Denied({ onOpenSettings }: DeniedProps) {
  const { t } = useTranslation('weather');

  return (
    <WeatherLocationPrompt
      title={t('locationPrompt.deniedTitle')}
      description={t('locationPrompt.deniedDescription')}
      actionLabel={t('locationPrompt.openSettings')}
      onAction={onOpenSettings}
    />
  );
};
