import { useTranslation } from '@src/shared/i18n';
import {
  IOS_MAJOR_VERSION,
  IS_IOS_APP_ON_MAC,
  IS_IPAD,
} from '@src/shared/infra/device/device-info';
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

// iOS 18부터 앱마다의 설정이 설정 > 앱 아래로 옮겨져 캘린더 계정 메뉴 이름도 바뀌었다
const HAS_APPS_SETTINGS_MENU = IOS_MAJOR_VERSION != null && 18 <= IOS_MAJOR_VERSION;

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

  return (
    <VStack gap={16}>
      <VStack gap={6}>
        <H4>{t('calendars.missingHelp.title')}</H4>
        <WordWrapText size="b3" shade={7}>
          {t('calendars.missingHelp.description')}
        </WordWrapText>
      </VStack>
      {match(findHelpDevice())
        .with('iphone', () => (
          <VStack gap={10}>
            <Step
              order={1}
              text={
                HAS_APPS_SETTINGS_MENU
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
                HAS_APPS_SETTINGS_MENU
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

// 계정을 더하는 설정 위치가 기기마다 다르다. iPhone Duo는 휴대폰이라 iPhone이다
function findHelpDevice(): 'iphone' | 'ipad' | 'mac' | 'android' {
  if (process.env.EXPO_OS === 'android') {
    return 'android';
  }
  if (IS_IOS_APP_ON_MAC) {
    return 'mac';
  }
  if (IS_IPAD) {
    return 'ipad';
  }
  return 'iphone';
}

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
