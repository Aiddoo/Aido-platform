import type { OsPermission } from '@src/core/ports/os-permission';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useOpenAppSettings } from '@src/shared/hooks/use-open-app-settings';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  CalendarIllustration,
  CheckmarkIcon,
  HStack,
  ListRow,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Spacing,
  Text,
  TextSkeleton,
  VStack,
  WordWrapText,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { Skeleton } from 'heroui-native';
import type { ReactNode } from 'react';
import { match } from 'ts-pattern';

import { useGetCalendarPermissionQueryOptions } from '../queries/todo-import-source.queries';
import { useRequestCalendarPermissionMutationOptions } from '../queries/todo-import.mutations';

interface CalendarPermissionPromptProps {
  /** 다음 단계로 가는 일은 화면이 정한다 */
  onGranted: () => void;
}

type PermissionView = 'ask' | 'denied' | 'blocked';

const FACT_ICON_SIZE = 12;
const FACT_BADGE_SIZE = 20;

/**
 * 시스템 캘린더 창 바로 앞의 안내(App Store 5.1.1, Play 눈에 띄는 공개). 열 때는 상태만 읽고 "계속"을 눌러야 묻는다.
 * 방금 거절했으면 다시 조르지 않고, 다시 들어왔을 때 다시 물을 수 없는 상태면 설정 열기를 보인다
 */
export function CalendarPermissionPrompt({ onGranted }: CalendarPermissionPromptProps) {
  const { data: permission } = useSuspenseQuery(useGetCalendarPermissionQueryOptions());
  const request = useMutation(useRequestCalendarPermissionMutationOptions());
  const openSettings = useOpenAppSettings();

  const handleContinue = () => {
    request
      .mutateAsync()
      .then((answered) => {
        if (answered.status === 'granted') {
          onGranted();
        }
      })
      .catch(noop);
  };

  return match(toPermissionView(permission, request.data ?? null))
    .with('ask', () => (
      <CalendarPermissionPrompt.Ask isRequesting={request.isPending} onContinue={handleContinue} />
    ))
    .with('denied', () => <CalendarPermissionPrompt.Denied />)
    .with('blocked', () => <CalendarPermissionPrompt.Denied onOpenSettings={openSettings} />)
    .exhaustive();
}

interface AskProps {
  isRequesting: boolean;
  onContinue: () => void;
}

/** 버튼은 "계속" 하나다. 닫기·건너뛰기를 두지 않고 나가는 길은 헤더 뒤로 가기다 */
CalendarPermissionPrompt.Ask = function Ask({ isRequesting, onContinue }: AskProps) {
  const { t } = useTranslation(['todoImport', 'common']);

  return (
    <Prompt
      action={
        <Button size="large" isLoading={isRequesting} onPress={onContinue}>
          {t('common:actions.continue')}
        </Button>
      }
    >
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

interface DeniedProps {
  /** 다시 물을 수 없을 때만 준다(Android 영구 거절, iOS 거절·쓰기 전용). 방금 거절했으면 조르지 않고 글만 보인다 */
  onOpenSettings?: () => void;
}

CalendarPermissionPrompt.Denied = function Denied({ onOpenSettings }: DeniedProps) {
  const { t } = useTranslation('todoImport');

  return (
    <Prompt
      action={
        onOpenSettings == null ? null : (
          <Button size="large" onPress={onOpenSettings}>
            {t('permission.openSettings')}
          </Button>
        )
      }
    >
      <VStack gap={4} align="center">
        <Text size="b2" weight="semibold" shade={9} align="center">
          {t('permission.deniedTitle')}
        </Text>
        <WordWrapText size="b3" shade={6} align="center">
          {t('permission.deniedDescription')}
        </WordWrapText>
      </VStack>
    </Prompt>
  );
};

CalendarPermissionPrompt.Loading = function Loading() {
  return (
    <Prompt action={<Skeleton className="h-14 w-full rounded-2xl" />}>
      <VStack gap={4} className="self-stretch">
        <FactSkeleton />
        <FactSkeleton />
        <FactSkeleton />
        <FactSkeleton />
        <FactSkeleton />
      </VStack>
    </Prompt>
  );
};

CalendarPermissionPrompt.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  return <QueryErrorFallback reset={reset} />;
};

function Prompt({ children, action }: { children: ReactNode; action: ReactNode }) {
  return (
    <VStack align="center">
      <CalendarIllustration />
      <Spacing size={24} />
      {children}
      {action != null && (
        <>
          <Spacing size={32} />
          <Box className="self-stretch">{action}</Box>
        </>
      )}
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

function FactSkeleton() {
  return (
    <ListRow
      verticalPadding="small"
      left={<Skeleton className="size-5 rounded-full" />}
      contents={<TextSkeleton size="b3" className="w-56" />}
    />
  );
}

function toPermissionView(permission: OsPermission, answered: OsPermission | null): PermissionView {
  if (permission.status === 'granted') {
    return 'ask';
  }
  if (answered != null && answered.status !== 'granted') {
    return 'denied';
  }
  return permission.status === 'denied' && !permission.canAskAgain ? 'blocked' : 'ask';
}
