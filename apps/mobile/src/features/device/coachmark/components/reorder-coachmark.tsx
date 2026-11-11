import { useLogger } from '@src/bootstrap/providers/di-context';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { getErrorMessage } from '@src/shared/errors';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { InfoIcon, InlineAlert } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { match } from 'ts-pattern';

import { COACHMARK_LOG_EVENT } from '../constants/coachmark-log-events';
import { usePendingCoachmark } from '../hooks/use-pending-coachmark';

type ReorderCoachmarkKind = 'todo' | 'category';

// 보조 안내라 내 정보를 못 읽으면 목록을 막지 않고 조용히 빠진다
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

  return <ReorderCoachmark.Alert kind={kind} accountId={user.id} />;
}

ReorderCoachmark.Alert = function Alert({
  kind,
  accountId,
}: {
  kind: ReorderCoachmarkKind;
  accountId: string;
}) {
  const fontScaledSize = useFontScaledSize();
  const { t } = useTranslation('todo');
  // 기기 안에 저장된 값을 렌더 중에 동기로 읽는다(네트워크 조회가 없어 로딩 상태가 필요 없다)
  const [isPending, complete] = usePendingCoachmark({
    accountId,
    kind: match(kind)
      .with('todo', () => 'todo-reorder' as const)
      .with('category', () => 'category-reorder' as const)
      .exhaustive(),
  });
  // 보이면 끝나는 안내라 붙을 때의 값으로 정하고, 끝낸 뒤에도 닫을 때까지 보인다
  const [isVisible, setIsVisible] = useState(isPending);

  // 렌더는 버려질 수 있어 "봤음"은 화면에 붙은 뒤에 저장한다.
  useEffect(() => {
    if (isVisible) {
      complete();
    }
  }, [isVisible, complete]);

  if (!isVisible) {
    return null;
  }

  return (
    <InlineAlert
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
