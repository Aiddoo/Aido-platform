import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useGetTodoOverviewQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useStoredValue } from '@src/shared/storage/use-stored-value';
import { useQuery } from '@tanstack/react-query';

import { ActivationPolicy } from '../domains/activation.model';
import { activationProgressStoredValue } from '../schemas/activation-progress-storage.schema';

export function useActivationChecklist() {
  const isAuthenticated = useAuthStatus() === 'authenticated';
  const { data: user } = useQuery({ ...useGetMeQueryOptions(), enabled: isAuthenticated });
  // 진행은 기기 저장소가 원본이다. 할 일 저장이 기록하면 구독으로 바로 따라간다
  const [progress] = useStoredValue(
    activationProgressStoredValue,
    isAuthenticated ? user?.id : undefined,
  );
  const now = useMinuteNow();
  const shouldOfferChecklist =
    isAuthenticated &&
    user != null &&
    ActivationPolicy.shouldOfferChecklist(user, { progress, now });
  // 재설치·다른 기기에서도 같은 진행을 보이도록 서버의 할 일 기록을 함께 본다. 대상 사용자에게만 부른다
  const todoRecordQuery = useQuery({
    ...useGetTodoOverviewQueryOptions(),
    select: ({ hasTodo, hasCompletedTodo }) => ({ hasTodo, hasCompletedTodo }),
    enabled: shouldOfferChecklist,
  });
  const steps = ActivationPolicy.getChecklistSteps(progress, todoRecordQuery.data);
  // 끝낸 사용자에게 카드가 잠깐 보였다 사라지지 않게 서버 기록을 읽은 뒤 띄우고, 실패하면 기기 기록만 본다
  const hasSettledTodoRecord = todoRecordQuery.isSuccess || todoRecordQuery.isError;

  return {
    steps,
    isVisible:
      shouldOfferChecklist &&
      hasSettledTodoRecord &&
      !ActivationPolicy.hasFinishedRequiredSteps(steps),
  };
}
