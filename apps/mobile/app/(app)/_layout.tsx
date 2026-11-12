import { useErrorReporter } from '@src/bootstrap/providers/di-context';
import { useRecordTodoCompletion } from '@src/features/device/activation/hooks/use-record-todo-completion';
import { useRecordTodoCreated } from '@src/features/device/activation/hooks/use-record-todo-created';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useLogoutMutationOptions } from '@src/features/identity/auth/queries/auth.mutations';
import { useOfferMarketingPushAfterCompletion } from '@src/features/notification/hooks/use-offer-marketing-push-after-completion';
import { usePushOnboardingGuard } from '@src/features/notification/hooks/use-push-onboarding-guard';
import { classifyError, getErrorReportTags } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import {
  HStack,
  Result,
  SHEET_ROUTE_SCREEN_OPTIONS,
  StyledSafeAreaView,
  useStackScreenOptions,
} from '@src/shared/ui';
import { useMutation, useQueryErrorResetBoundary } from '@tanstack/react-query';
import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useResolveClassNames } from 'uniwind';

const SHEET_ROUTES = [
  'todo/new',
  'todo/[todoId]/actions',
  'todo/[todoId]/edit',
  'todo/[todoId]/date',
  'todo/[todoId]/time',
  'todo/[todoId]/category',
  'todo/[todoId]/thanks',
  'todo/[todoId]/report',
  'todo/[todoId]/comments/[commentId]/report',
  'todo/[todoId]/sub-todos/new',
  'todo/[todoId]/sub-todos/[subTodoId]/actions',
  'todo/[todoId]/sub-todos/[subTodoId]/edit',
  'todo-categories/new',
  'todo-categories/[categoryId]/edit',
  'todo-categories/[categoryId]/delete',
  'invite-welcome/[friendId]',
  'users/[userId]/block',
  'users/[userId]/report',
  'users/[userId]/nudge',
  'suggestions/[suggestionId]/category',
] as const;

export const unstable_settings = {
  anchor: '(tabs)',
};

function AppLayout() {
  const { backgroundColor } = useResolveClassNames('bg-white');
  const headerOptions = useStackScreenOptions();
  const { t } = useTranslation(['notification', 'todo', 'ai']);
  // 알림 안내 화면의 Stack.Protected guard라 내비게이터를 그리는 레이아웃이 판정한다
  const isPushOnboardingDue = usePushOnboardingGuard();

  return (
    <>
      <Stack
        screenOptions={{
          // 탭·상세는 각자 Stack.Screen·안쪽 Stack으로 헤더를 켠다. 여기서 켜면 탭 위에 헤더가 겹친다
          headerShown: false,
          animation: 'slide_from_right',
          animationTypeForReplace: 'push',
          contentStyle: { backgroundColor },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="notifications/index"
          options={{ ...headerOptions, title: t('notification:titles.notifications') }}
        />
        <Stack.Screen
          name="nudges/[nudgeId]"
          options={{ ...headerOptions, title: t('todo:interaction.detailTitle') }}
        />
        <Stack.Screen
          name="suggestions/index"
          options={{ ...headerOptions, title: t('ai:titles.suggestions') }}
        />
        {/* 푸시·위젯·링크로 날씨를 다시 열 때 Skia 장면이 겹겹이 쌓이지 않게 있던 날씨 화면으로 돌아간다 */}
        <Stack.Screen name="weather" dangerouslySingular />
        {/* 닫기가 헤더 오른쪽에 있는 흐름이라 아래에서 올린다. 기능으로 떠날 때 그 화면의 토스트·동의 시트가 가려지지 않게 시스템 모달은 쓰지 않는다 */}
        <Stack.Screen
          name="whats-new/index"
          options={{
            ...headerOptions,
            title: '',
            headerBackVisible: false,
            animation: 'slide_from_bottom',
          }}
        />
        {/* 업셀 결제는 지금 맥락 위에 올리는 흐름이라 닫기만 둔다(오른쪽) */}
        <Stack.Screen
          name="paywall"
          options={{
            ...headerOptions,
            title: '',
            headerBackVisible: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen name="memo" options={{ animation: 'slide_from_bottom' }} />
        {/* 녹음을 실수로 잃지 않게 스와이프로 닫지 않는다. 시스템 모달은 쓰지 않는다(토스트·한도 안내가 그 뒤로 가려진다) */}
        <Stack.Screen
          name="voice-notes"
          options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
        />
        {SHEET_ROUTES.map((name) => (
          <Stack.Screen key={name} name={name} options={SHEET_ROUTE_SCREEN_OPTIONS} />
        ))}
        {/* 답하면 조건이 풀려 화면이 빠지고 피드로 돌아간다(답한 뒤에는 링크로도 열리지 않는다). 기본 redirect는 `/(app)/(tabs)`로 replace해 탭 묶음을 새로 만들어 `(mypage)`가 열리므로 뒤로 가기(`..`)를 쓴다 */}
        <Stack.Protected guard={isPushOnboardingDue} redirectTo="..">
          <Stack.Screen
            name="onboarding/notifications"
            options={{
              ...headerOptions,
              title: '',
              headerBackVisible: false,
              animation: 'fade',
              gestureEnabled: false,
            }}
          />
        </Stack.Protected>
      </Stack>
      <TodoEventWatchers />
    </>
  );
}

/** 레이아웃은 내비게이터만 둔다. 할 일 이벤트를 듣는 훅은 null을 그리는 형제에서 부른다 */
function TodoEventWatchers() {
  useRecordTodoCreated();
  useRecordTodoCompletion();
  useOfferMarketingPushAfterCompletion();

  return null;
}

export default AppLayout;

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const status = useAuthStatus();
  const logout = useMutation(useLogoutMutationOptions());
  const errorReporter = useErrorReporter();
  const { reset: resetQueryErrors } = useQueryErrorResetBoundary();
  const { t } = useTranslation();

  // 세션이 끝난 뒤 도착한 401만 조용히 로그인으로 넘긴다. 세션이 살아있는데 401이 여기까지
  // 새어왔다면 컨테인먼트 구멍이므로, null 빈 화면 대신 재시도 UI를 보여주고 리포트한다.
  const isAuthTransition =
    status !== 'authenticated' && classifyError(error).kind === 'auth-expired';

  useEffect(() => {
    if (isAuthTransition) {
      return;
    }

    errorReporter.captureException(error, {
      feature: 'error_boundary',
      ...getErrorReportTags(error),
    });
  }, [error, errorReporter, isAuthTransition]);

  if (isAuthTransition) {
    return null;
  }

  // 실패한 Suspense 조회는 리셋 없이 다시 마운트하면 재요청 없이 같은 오류를 다시 던진다
  const handleRetry = () => {
    resetQueryErrors();
    retry();
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-white">
      <Result
        title={t('appError.title')}
        description={t('appError.description')}
        button={
          <HStack gap={8}>
            <Result.Button isDisabled={logout.isPending} onPress={handleRetry}>
              {t('appError.retry')}
            </Result.Button>
            <Result.Button
              color="primary"
              isLoading={logout.isPending}
              onPress={() => logout.mutate()}
            >
              {t('appError.logout')}
            </Result.Button>
          </HStack>
        }
      />
    </StyledSafeAreaView>
  );
}
