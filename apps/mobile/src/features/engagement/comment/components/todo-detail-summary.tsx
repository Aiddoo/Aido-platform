import { UserAvatar } from '@src/features/identity/user/components/user-avatar';
import { CategoryHeaderPill } from '@src/features/planning/category/components/category-header-pill';
import { TodoDetailSchedule } from '@src/features/planning/todo/components/todo-detail-schedule';
import { TodoRow } from '@src/features/planning/todo/components/todo-row';
import { SubTodoPolicy } from '@src/features/planning/todo/domains/sub-todo.model';
import { useTodoId } from '@src/features/planning/todo/hooks/use-todo-params';
import { useToggleSubTodoMutationOptions } from '@src/features/planning/todo/queries/sub-todo.mutations';
import { getOptimisticListDate } from '@src/features/planning/todo/queries/todo-cache';
import { useToggleTodoMutationOptions } from '@src/features/planning/todo/queries/todo.mutations';
import { useGetTodoDetailsQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { ThanksSummaryRow } from '@src/features/social/nudge/components/thanks-summary-row';
import { TodoNudgeButton } from '@src/features/social/nudge/components/todo-nudge-button';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import {
  Box,
  EyeIcon,
  HStack,
  QueryErrorBoundary,
  Result,
  Text,
  TextSkeleton,
  TodoIllustration,
  VStack,
} from '@src/shared/ui';
import { getTouchTargetInset } from '@src/shared/ui';
import { formatCompactCount } from '@src/shared/utils/number-format';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { type ReactNode, Suspense } from 'react';

/** 제목(t3) 한 줄 높이. 여러 줄 제목에서도 체크박스를 첫 줄 가운데에 맞춘다 */
const TITLE_LINE_HEIGHT = 28;
/** 체크박스 칸(size-6) */
const CHECKBOX_SIZE = 24;
const CHECKBOX_HIT_SLOP = getTouchTargetInset(CHECKBOX_SIZE);

export function TodoDetailSummary() {
  return (
    <VStack gap={12}>
      <TodoDetailSummary.Owner />

      <TodoDetailSummary.Task />

      <VStack className="ms-9 gap-2.5">
        <TodoDetailSchedule />

        <TodoDetailSummary.SubTodos />

        <TodoDetailSummary.Metrics />

        <TodoDetailSummary.Thanks />
      </VStack>
    </VStack>
  );
}

TodoDetailSummary.Owner = function Owner() {
  const { t } = useTranslation('todo');
  const [todoId] = useTodoId();
  const { data: detail } = useSuspenseQuery(useGetTodoDetailsQueryOptions({ todoId }));
  const ownerName = detail.owner.name ?? t('detail.unknownOwner');

  if (detail.permissions.canEdit) {
    return null;
  }

  return (
    <HStack gap={6} align="center" testID="todo-detail-owner">
      <UserAvatar alt={ownerName} className="size-5" profileImage={detail.owner.profileImage} />
      <Text size="e1" shade={6} numberOfLines={1} className="shrink">
        {ownerName}
      </Text>
    </HStack>
  );
};

TodoDetailSummary.Task = function Task() {
  const [todoId] = useTodoId();
  const { data: detail } = useSuspenseQuery(useGetTodoDetailsQueryOptions({ todoId }));
  const toggleTodo = useMutation(useToggleTodoMutationOptions());
  const todayKey = useTodayKey();
  const fontScaledSize = useFontScaledSize();
  const { todo } = detail;

  return (
    <HStack gap={12} align="start">
      <Box className="justify-center" style={{ height: fontScaledSize(TITLE_LINE_HEIGHT) }}>
        <TodoRow.Checkbox
          testID="todo-detail-checkbox"
          accessibilityLabel={todo.title}
          className="size-6"
          hitSlop={CHECKBOX_HIT_SLOP}
          isSelected={todo.completed}
          isDisabled={toggleTodo.isPending}
          onSelectedChange={
            detail.permissions.canEdit
              ? () =>
                  toggleTodo.mutate({
                    todoId,
                    body: { completed: !todo.completed },
                    date: getOptimisticListDate(todo, todayKey),
                  })
              : undefined
          }
        />
      </Box>
      <Text
        size="t3"
        weight="bold"
        strikethrough={todo.completed}
        shade={todo.completed ? 5 : undefined}
        lineBreakStrategyIOS="hangul-word"
        className="flex-1 shrink"
      >
        {todo.title}
      </Text>
    </HStack>
  );
};

TodoDetailSummary.SubTodos = function SubTodos() {
  const [todoId] = useTodoId();
  const { data: detail } = useSuspenseQuery(useGetTodoDetailsQueryOptions({ todoId }));
  const toggleSubTodo = useMutation(useToggleSubTodoMutationOptions());
  const todayKey = useTodayKey();
  const { todo } = detail;

  if (!SubTodoPolicy.hasSubTodos(todo.subTodos)) {
    return null;
  }
  const subTodoStats = SubTodoPolicy.getSubTodoStats(todo.subTodos);

  return (
    <VStack gap={4}>
      <TodoRow.Progress value={subTodoStats.completed} total={subTodoStats.total} />
      <VStack>
        {todo.subTodos.map((subTodo) => (
          <TodoRow
            key={subTodo.id}
            left={
              <TodoRow.Checkbox
                testID={`todo-detail-sub-todo-checkbox-${subTodo.id}`}
                accessibilityLabel={subTodo.title}
                isSelected={subTodo.completed}
                isDisabled={toggleSubTodo.isPending}
                onSelectedChange={
                  detail.permissions.canEdit && !SubTodoPolicy.isOptimisticSubTodo(subTodo)
                    ? () =>
                        toggleSubTodo.mutate({
                          todoId,
                          subTodoId: subTodo.id,
                          isCompleted: !subTodo.completed,
                          date: getOptimisticListDate(todo, todayKey),
                        })
                    : undefined
                }
              />
            }
            top={<TodoRow.Label isCompleted={subTodo.completed}>{subTodo.title}</TodoRow.Label>}
          />
        ))}
      </VStack>
    </VStack>
  );
};

TodoDetailSummary.Metrics = function Metrics() {
  const { t } = useTranslation('todo');
  const fontScaledSize = useFontScaledSize();
  const [todoId] = useTodoId();
  const { data: detail } = useSuspenseQuery(useGetTodoDetailsQueryOptions({ todoId }));

  return (
    <HStack gap={16} align="center" wrap="wrap">
      <Metric
        icon={
          <EyeIcon
            width={fontScaledSize(16)}
            height={fontScaledSize(16)}
            colorClassName="text-gray-5"
          />
        }
        count={detail.metrics.viewCount}
      />
      {detail.permissions.canNudge && (
        <TodoNudgeButton
          receiver={{
            id: detail.owner.id,
            displayName: detail.owner.name ?? t('detail.unknownOwner'),
          }}
          todo={detail.todo}
        />
      )}
    </HStack>
  );
};

TodoDetailSummary.Thanks = function Thanks() {
  const [todoId] = useTodoId();
  const { data: detail } = useSuspenseQuery(useGetTodoDetailsQueryOptions({ todoId }));
  const router = useRouter();
  const push = useSingleTap(router.push);

  if (!detail.permissions.canThank) {
    return null;
  }

  return (
    <QueryErrorBoundary resetKeys={[todoId]} fallback={ThanksSummaryRow.Error}>
      {/* 보낼 대상이 있는지 조회해야 보일지 아는 줄이라 로딩 때 자리를 잡지 않는다(ThanksSummaryRow 머리 주석) */}
      <Suspense fallback={null}>
        <ThanksSummaryRow
          todoId={todoId}
          onOpenThanks={() => push({ pathname: '/todo/[todoId]/thanks', params: { todoId } })}
        />
      </Suspense>
    </QueryErrorBoundary>
  );
};

/** 받아야 있는지 아는 줄(친구 할 일의 작성자, 시간·반복)은 자리를 잡지 않는다. 그 줄이 있는 할 일만 받은 뒤 한 줄 늘어난다 */
TodoDetailSummary.Loading = function Loading() {
  const fontScaledSize = useFontScaledSize();

  return (
    <VStack gap={12} testID="todo-detail-card-loading">
      <HStack className="gap-3" align="start">
        <Box className="justify-center" style={{ height: fontScaledSize(TITLE_LINE_HEIGHT) }}>
          <Skeleton className="size-6 rounded-md" />
        </Box>
        <TextSkeleton size="t3" className="w-3/5" />
      </HStack>

      <VStack className="ms-9 gap-2.5">
        <VStack gap={6}>
          <HStack gap={8} align="center">
            <CategoryHeaderPill.Loading />
            <TextSkeleton size="e1" className="w-14" />
          </HStack>
        </VStack>

        <Metric.Loading />
      </VStack>
    </VStack>
  );
};

/** 할 일을 고르지 않은 넓은 화면의 오른쪽 칸 */
TodoDetailSummary.Empty = function Empty() {
  const { t } = useTranslation('todo');

  return (
    <Box flex={1} className="bg-white px-8">
      <Result
        icon={<TodoIllustration />}
        title={t('detail.emptyTitle')}
        description={t('detail.selectPrompt')}
      />
    </Box>
  );
};

/** 지워졌거나 더는 볼 수 없는 할 일(친구 끊김·차단 등). 알림·위젯이 예전 할 일을 열 때 보인다 */
TodoDetailSummary.Unavailable = function Unavailable({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(['todo', 'common']);

  return (
    <Box flex={1} px={32} testID="todo-unavailable">
      <Result
        icon={<TodoIllustration />}
        title={t('todo:detail.unavailableTitle')}
        description={t('todo:detail.unavailableDescription')}
        button={<Result.Button onPress={onClose}>{t('common:actions.goBack')}</Result.Button>}
      />
    </Box>
  );
};

function Metric({ icon, count }: { icon: ReactNode; count: number }) {
  const { resolvedLanguage } = useLanguage();

  return (
    <HStack gap={4} align="center">
      {icon}
      <Text size="e1" shade={5}>
        {formatCompactCount(count, resolvedLanguage)}
      </Text>
    </HStack>
  );
}

Metric.Loading = function Loading() {
  return (
    <HStack gap={4} align="center">
      <Skeleton className="size-4 rounded-full" />
      <TextSkeleton size="e1" className="w-4" />
    </HStack>
  );
};
