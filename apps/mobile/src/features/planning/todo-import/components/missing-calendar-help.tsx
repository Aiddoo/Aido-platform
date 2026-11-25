import { useExternalLink } from '@src/bootstrap/providers/di-context';
import type { SettingsApp } from '@src/core/ports/external-link-gateway';
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
import { match } from 'ts-pattern';

type MissingCalendarHelpProps = Omit<ComponentProps<typeof TextButton>, 'children' | 'onPress'>;

type HelpDevice = 'iphone' | 'ipad' | 'mac' | 'android';

// 폰 캘린더에 계정을 더하는 곳은 OS 설정이라 앱이 바로 열 수 없어 순서를 글로 안내한다
export function MissingCalendarHelp(props: MissingCalendarHelpProps) {
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
  const { settingsApp } = useExternalLink();

  return (
    <VStack gap={16}>
      <VStack gap={6}>
        <H4>{t('calendars.missingHelp.title')}</H4>
        <WordWrapText size="b3" shade={7}>
          {t('calendars.missingHelp.description')}
        </WordWrapText>
      </VStack>
      {match(getHelpDevice(settingsApp))
        .with('iphone', () => (
          <VStack gap={10}>
            <Step
              order={1}
              text={
                // 설정 > 앱 아래로 옮겨진 OS는 캘린더 계정 메뉴 이름도 다르다
                settingsApp.hasAppsMenu
                  ? t('calendars.missingHelp.iphone.openAppsSettings')
                  : t('calendars.missingHelp.iphone.openSettings')
              }
            />
            <Step order={2} text={t('calendars.missingHelp.ios.addAccount')} />
            <Step order={3} text={t('calendars.missingHelp.comeBack')} />
          </VStack>
        ))
        .with('ipad', () => (
          <VStack gap={10}>
            <Step
              order={1}
              text={
                settingsApp.hasAppsMenu
                  ? t('calendars.missingHelp.ipad.openAppsSettings')
                  : t('calendars.missingHelp.ipad.openSettings')
              }
            />
            <Step order={2} text={t('calendars.missingHelp.ios.addAccount')} />
            <Step order={3} text={t('calendars.missingHelp.comeBack')} />
          </VStack>
        ))
        .with('mac', () => (
          <VStack gap={10}>
            <Step order={1} text={t('calendars.missingHelp.mac.openSettings')} />
            <Step order={2} text={t('calendars.missingHelp.mac.addAccount')} />
            <Step order={3} text={t('calendars.missingHelp.comeBack')} />
          </VStack>
        ))
        .with('android', () => (
          <VStack gap={10}>
            <Step order={1} text={t('calendars.missingHelp.android.addAccount')} />
            <Step order={2} text={t('calendars.missingHelp.android.turnOnSync')} />
            <Step order={3} text={t('calendars.missingHelp.comeBack')} />
          </VStack>
        ))
        .exhaustive()}
    </VStack>
  );
};

interface StepProps {
  order: number;
  text: string;
}

function Step({ order, text }: StepProps) {
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

// 계정을 더하는 설정 위치가 기기마다 다르다. iPhone Duo는 휴대폰이라 iPhone이다
function getHelpDevice({ device }: SettingsApp): HelpDevice {
  if (process.env.EXPO_OS === 'android') {
    return 'android';
  }
  return match(device)
    .returnType<HelpDevice>()
    .with('desktop', () => 'mac')
    .with('tablet', () => 'ipad')
    .with('phone', () => 'iphone')
    .exhaustive();
}
