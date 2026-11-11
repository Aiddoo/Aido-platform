import { useActivationProgressRepository } from '@src/bootstrap/providers/di-context';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useGetTodoExistenceQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { getNowInstant } from '@src/shared/date/clock';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { EMPTY_ACTIVATION_PROGRESS } from '../constants/activation.constants';
import { ActivationPolicy } from '../domains/activation.model';

export function useActivationChecklist() {
  const isAuthenticated = useAuthStatus() === 'authenticated';
  const { data: user } = useQuery({ ...useGetMeQueryOptions(), enabled: isAuthenticated });
  const repository = useActivationProgressRepository();
  const accountId = isAuthenticated ? user?.id : undefined;
  // 진행은 기기 저장소가 원본이다. 할 일 저장이 기록하면 구독으로 바로 따라간다
  const progress = useSyncExternalStore(
    useCallback(
      (onChange: () => void) =>
        accountId == null ? noop : repository.subscribe(accountId, onChange),
      [accountId, repository],
    ),
    () => (accountId == null ? EMPTY_ACTIVATION_PROGRESS : repository.get(accountId)),
  );
  // React Compiler가 인자 없는 new Date()를 렌더 사이에 붙잡아 두므로, 날짜가 바뀔 때 다시 읽는다
  const todayKey = useTodayKey();
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- todayKey는 날짜가 바뀔 때 now를 다시 읽게 하는 키다
  const now = useMemo(() => getNowInstant(), [todayKey]);
  const shouldOfferChecklist =
    isAuthenticated &&
    user != null &&
    ActivationPolicy.shouldOfferChecklist(user, { progress, now });
  // 재설치·다른 기기에서도 같은 진행을 보이도록 서버의 할 일 기록을 함께 본다. 대상 사용자에게만 부른다
  const todoExistenceQuery = useQuery({
    ...useGetTodoExistenceQueryOptions(),
    enabled: shouldOfferChecklist,
    throwOnError: false,
  });
  const steps = ActivationPolicy.getChecklistSteps(progress, todoExistenceQuery.data);
  // 끝낸 사용자에게 카드가 잠깐 보였다 사라지지 않게 서버 기록을 읽은 뒤 띄우고, 실패하면 기기 기록만 본다
  const hasSettledTodoExistence = todoExistenceQuery.isSuccess || todoExistenceQuery.isError;

  return {
    steps,
    isVisible:
      shouldOfferChecklist &&
      hasSettledTodoExistence &&
      !ActivationPolicy.hasFinishedRequiredSteps(steps),
  };
}
