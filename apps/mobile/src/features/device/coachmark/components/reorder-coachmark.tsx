import { useCoachmarkService, useLogger } from '@src/bootstrap/providers/di-context';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { getErrorMessage } from '@src/shared/errors';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { InfoIcon, InlineNotice } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { match } from 'ts-pattern';

import { COACHMARK_LOG_EVENT } from '../constants/coachmark-log-events';

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
    logger.warn(COACHMARK_LOG_EVENT.REORDER_COACHMARK_UNAVAILABLE, {
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
  const coachmarkKind = match(kind)
    .with('todo', () => 'todo-reorder' as const)
    .with('category', () => 'category-reorder' as const)
    .exhaustive();
  const [isVisible, setIsVisible] = useState(() =>
    service.isPending({ accountId, kind: coachmarkKind }),
  );

  // 렌더는 버려질 수 있어 "봤음"은 화면에 붙은 뒤에 저장한다.
  useEffect(() => {
    if (isVisible) {
      service.complete({ accountId, kind: coachmarkKind });
    }
  }, [isVisible, service, accountId, coachmarkKind]);

  if (!isVisible) {
    return null;
  }

  return (
    <InlineNotice
      accessibilityRole="alert"
      image={
        <InfoIcon
          width={fontScaledSize(17)}
          height={fontScaledSize(17)}
          colorClassName="text-main"
        />
      }
      description={t(`reorderCoachmark.${kind}`)}
      onClose={() => setIsVisible(false)}
      closeLabel={t('reorderCoachmark.dismiss')}
    />
  );
};
