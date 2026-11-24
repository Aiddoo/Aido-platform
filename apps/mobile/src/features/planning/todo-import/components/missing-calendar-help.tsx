import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  H4,
  HStack,
  Text,
  TextButton,
  useOpenSheet,
  VStack,
  WordWrapText,
} from '@src/shared/ui';
import type { ComponentProps } from 'react';

/** 폰 캘린더에 계정을 더하는 곳은 OS 설정이라 앱이 바로 열 수 없어 순서를 글로 안내한다 */
export function MissingCalendarHelp(
  props: Omit<ComponentProps<typeof TextButton>, 'children' | 'onPress'>,
) {
  const { t } = useTranslation(['todoImport', 'common']);
  const openSheet = useOpenSheet();

  const handlePress = () => {
    openSheet(() => <MissingCalendarHelp.Guide />, {
      footer: (close) => (
        <Button size="large" onPress={() => close()}>
          {t('common:actions.confirm')}
        </Button>
      ),
    });
  };

  return (
    <TextButton size="medium" onPress={handlePress} {...props}>
      {t('calendars.missingHelp.open')}
    </TextButton>
  );
}

MissingCalendarHelp.Guide = function Guide() {
  const { t } = useTranslation('todoImport');
  const isAndroid = process.env.EXPO_OS === 'android';

  return (
    <VStack gap={16}>
      <VStack gap={6}>
        <H4>{t('calendars.missingHelp.title')}</H4>
        <WordWrapText size="b3" shade={7}>
          {t('calendars.missingHelp.description')}
        </WordWrapText>
      </VStack>
      {isAndroid ? (
        <VStack gap={10}>
          <Step order={1} text={t('calendars.missingHelp.android.addAccount')} />
          <Step order={2} text={t('calendars.missingHelp.android.turnOnSync')} />
          <Step order={3} text={t('calendars.missingHelp.comeBack')} />
        </VStack>
      ) : (
        <VStack gap={10}>
          <Step order={1} text={t('calendars.missingHelp.ios.openSettings')} />
          <Step order={2} text={t('calendars.missingHelp.ios.addAccount')} />
          <Step order={3} text={t('calendars.missingHelp.comeBack')} />
        </VStack>
      )}
    </VStack>
  );
};

function Step({ order, text }: { order: number; text: string }) {
  return (
    <HStack gap={10} align="start">
      <Text size="b3" weight="semibold" tone="brand" className="tabular-nums">
        {order}
      </Text>
      <WordWrapText size="b3" shade={8} className="flex-1">
        {text}
      </WordWrapText>
    </HStack>
  );
}
