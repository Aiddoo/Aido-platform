import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { IS_IOS_APP_ON_MAC } from '@src/shared/infra/device/device-info';
import {
  CalendarIllustration,
  CheckmarkIcon,
  HStack,
  ListRow,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Spacing,
  Text,
  VStack,
  WordWrapText,
} from '@src/shared/ui';
import type { ReactNode } from 'react';
import { match } from 'ts-pattern';

import type { CalendarPermissionView } from '../utils/todo-import.view-model';

interface CalendarPermissionPromptProps {
  view: CalendarPermissionView;
}

const FACT_ICON_SIZE = 12;
const FACT_BADGE_SIZE = 20;

/**
 * 시스템 캘린더 창 바로 앞의 안내(App Store 5.1.1, Play 눈에 띄는 공개). 그림과 글만 그리고,
 * "계속"·"설정 열기"는 다른 단계처럼 화면 아래 버튼이 맡는다
 */
export function CalendarPermissionPrompt({ view }: CalendarPermissionPromptProps) {
  return match(view)
    .with('ask', () => <CalendarPermissionPrompt.Ask />)
    .with('denied', 'blocked', () => <CalendarPermissionPrompt.Denied />)
    .exhaustive();
}

CalendarPermissionPrompt.Ask = function Ask() {
  const { t } = useTranslation('todoImport');

  return (
    <Prompt>
      <VStack gap={4} className="self-stretch">
        <Fact>{t('permission.facts.sources')}</Fact>
        <Fact>{t('permission.facts.read')}</Fact>
        <Fact>{t('permission.facts.noAccountInfo')}</Fact>
        <Fact>{t('permission.facts.oneTime')}</Fact>
        <Fact>{t('permission.facts.optional')}</Fact>
      </VStack>
    </Prompt>
  );
};

/** Mac은 아이두 설정 화면이 아니라 시스템 설정의 개인정보 보호에서 켠다 */
CalendarPermissionPrompt.Denied = function Denied() {
  const { t } = useTranslation('todoImport');

  return (
    <Prompt>
      <VStack gap={4} align="center">
        <Text size="b2" weight="semibold" shade={9} align="center">
          {t('permission.deniedTitle')}
        </Text>
        <WordWrapText size="b3" shade={6} align="center">
          {IS_IOS_APP_ON_MAC
            ? t('permission.deniedDescriptionMac')
            : t('permission.deniedDescription')}
        </WordWrapText>
      </VStack>
    </Prompt>
  );
};

CalendarPermissionPrompt.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  return <QueryErrorFallback reset={reset} />;
};

function Prompt({ children }: { children: ReactNode }) {
  return (
    <VStack align="center">
      <CalendarIllustration />
      <Spacing size={24} />
      {children}
    </VStack>
  );
}

function Fact({ children }: { children: string }) {
  const fontScaledSize = useFontScaledSize();
  const badgeSize = fontScaledSize(FACT_BADGE_SIZE);

  return (
    <ListRow
      verticalPadding="small"
      leftAlignment="top"
      left={
        <HStack
          align="center"
          justify="center"
          className="rounded-full bg-main"
          style={{ width: badgeSize, height: badgeSize }}
        >
          <CheckmarkIcon
            width={fontScaledSize(FACT_ICON_SIZE)}
            height={fontScaledSize(FACT_ICON_SIZE)}
            colorClassName="text-white dark:text-gray-9"
          />
        </HStack>
      }
      contents={
        <WordWrapText size="b3" shade={8}>
          {children}
        </WordWrapText>
      }
    />
  );
}
