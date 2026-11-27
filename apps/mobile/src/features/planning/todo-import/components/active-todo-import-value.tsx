import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, QueryErrorFallback, SettingsListGroup } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Suspense } from 'react';

import { useGetActiveTodoImportQueryOptions } from '../queries/todo-import.queries';

// 못 읽으면 값 없이 두고, 어디로 갈지는 도착한 가져오기 화면이 같은 캐시로 정한다
export function ActiveTodoImportValue() {
  return (
    <QueryErrorBoundary fallback={QueryErrorFallback.Hidden}>
      {/* 대부분 진행 중인 가져오기가 없어 자리를 잡지 않는다 */}
      <Suspense fallback={null}>
        <ActiveTodoImport />
      </Suspense>
    </QueryErrorBoundary>
  );
}

function ActiveTodoImport() {
  const { t } = useTranslation('todoImport');

  const { data: activeImport } = useSuspenseQuery(useGetActiveTodoImportQueryOptions());

  if (activeImport == null) {
    return null;
  }

  return (
    <SettingsListGroup.Value numberOfLines={1}>{t('entry.inProgress')}</SettingsListGroup.Value>
  );
}
