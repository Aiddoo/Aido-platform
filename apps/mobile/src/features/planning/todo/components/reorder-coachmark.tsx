import { useCoachmarkService, useLogger } from '@src/bootstrap/providers/di-context';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { getErrorMessage } from '@src/shared/errors';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { CloseIcon, HStack, InfoIcon, Text } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { CloseButton } from 'heroui-native';
import { useEffect, useState } from 'react';
import { match } from 'ts-pattern';

import { TODO_LOG_EVENT } from '../constants/todo-log-events';

type ReorderCoachmarkKind = 'todo' | 'category';

/**
 * 처음 재정렬이 가능해진 계정에 한 번만 길게 눌러 옮기는 방법을 알린다.
 * 보조 안내라 내 정보를 못 읽으면 목록을 막지 않고 조용히 빠진다.
 */
export function ReorderCoachmark({ kind }: { kind: ReorderCoachmarkKind }) {
  const logger = useLogger();
  const { data: user, error } = useQuery({ ...useGetMeQueryOptions(), throwOnError: false });

  useEffect(() => {
    if (error == null) {
      return;
    }
    logger.warn(TODO_LOG_EVENT.REORDER_COACHMARK_UNAVAILABLE, {
      kind,
      error: getErrorMessage(error),
    });
  }, [error, kind, logger]);

  if (user == null) {
    return null;
  }

  return <ReorderCoachmark.Contents kind={kind} accountId={user.id} />;
}

ReorderCoachmark.Contents = function Contents({
  kind,
  accountId,
}: {
  kind: ReorderCoachmarkKind;
  accountId: string;
}) {
  const fontScaledSize = useFontScaledSize();
  const { t } = useTranslation('todo');
  const service = useCoachmarkService();
  const [isVisible, setIsVisible] = useState(() =>
    service.claim({
      accountId,
      kind: match(kind)
        .with('todo', () => 'todo-reorder' as const)
        .with('category', () => 'category-reorder' as const)
        .exhaustive(),
    }),
  );

  if (!isVisible) {
    return null;
  }

  return (
    <HStack
      gap={8}
      align="center"
      className="rounded-xl bg-gray-2 px-3 py-2.5"
      accessibilityRole="alert"
    >
      <InfoIcon width={fontScaledSize(17)} height={fontScaledSize(17)} colorClassName="text-main" />
      <Text size="b4" shade={7} className="flex-1 shrink">
        {t(`reorderCoachmark.${kind}`)}
      </Text>
      <CloseButton
        variant="ghost"
        className="size-4"
        hitSlop={14}
        onPress={() => setIsVisible(false)}
        accessibilityLabel={t('reorderCoachmark.dismiss')}
      >
        <CloseIcon
          width={fontScaledSize(16)}
          height={fontScaledSize(16)}
          colorClassName="text-gray-6"
        />
      </CloseButton>
    </HStack>
  );
};
