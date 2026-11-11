import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { UserAvatar } from '@src/features/identity/user/components/user-avatar';
import { CategoryHeaderPill } from '@src/features/planning/category/components/category-header-pill';
import {
  TodoCheckbox,
  TodoLabel,
  TodoProgress,
  TodoRow,
} from '@src/features/planning/todo/components/todo-row';
import { SubTodoPolicy } from '@src/features/planning/todo/domains/sub-todo.model';
import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import { useTodoId } from '@src/features/planning/todo/hooks/use-todo-params';
import { useToggleSubTodoMutationOptions } from '@src/features/planning/todo/queries/sub-todo.mutations';
import { useToggleTodoMutationOptions } from '@src/features/planning/todo/queries/todo.mutations';
import {
  useGetTodoDetailsQueryOptions,
  useGetTodosByDateQueryOptions,
} from '@src/features/planning/todo/queries/todo.queries';
import { formatRepeatSummary } from '@src/features/planning/todo/utils/format-repeat-summary';
import { formatTodoTime } from '@src/features/planning/todo/utils/format-todo-time';
import { ThanksSummaryRow } from '@src/features/social/nudge/components/nudge-interactions/thanks-summary-row';
import { TodoNudgeButton } from '@src/features/social/nudge/components/todo-nudge-button';
import { TodoThanksPolicy } from '@src/features/social/nudge/domains/nudge-interaction.model';
import { TodoNudgePolicy } from '@src/features/social/nudge/domains/todo-nudge.model';
import {
  formatDateKeyRange,
  formatYearAwareDateKeyLabel,
} from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
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
import { useMutation, useQuery, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { type ReactNode, Suspense } from 'react';
import { match, P } from 'ts-pattern';

/** 제목(t3) 한 줄 높이. 여러 줄 제목에서도 체크박스를 첫 줄 가운데에 맞춘다 */
const TITLE_LINE_HEIGHT = 28;
/** 24 크기 체크박스의 눌리는 영역을 44로 넓힌다 */
const CHECKBOX_HIT_SLOP = 10;

export function TodoDetailSummary() {
  return (
    <VStack gap={12}>
      <TodoDetailSummary.Owner />

      <TodoDetailSummary.Task />

      <VStack className="gap-2.5 ms-9">
        <TodoDetailSummary.Schedule />

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
        <TodoCheckbox
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
                    date: TodoPolicy.getOptimisticListDate(todo, todayKey),
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

TodoDetailSummary.Schedule = function Schedule() {
  const { t } = useTranslation('todo');
  const [todoId] = useTodoId();
  const [{ data: detail }, { data: preference }] = useSuspenseQueries({
    queries: [useGetTodoDetailsQueryOptions({ todoId }), useGetPreferenceQueryOptions()],
  });
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const { todo } = detail;
  const timeLabel = formatTodoTime(todo, preference.timeFormat, dateFormatContext);
  const isRecurring = TodoPolicy.isRecurringTodo(todo);
  const dateLabel = match({ endDate: todo.endDate, isMultiDay: TodoPolicy.isMultiDayTodo(todo) })
    .with({ isMultiDay: true, endDate: P.string }, ({ endDate }) =>
      formatDateKeyRange(todo.startDate, endDate, todayKey, dateFormatContext),
    )
    .otherwise(() => formatYearAwareDateKeyLabel(todo.startDate, todayKey, dateFormatContext));

  return (
    <VStack gap={6}>
      {(timeLabel != null || isRecurring) && (
        <HStack gap={4} align="center" wrap="wrap">
          {timeLabel != null && (
            <Text size="b4" shade={6}>
              {timeLabel}
            </Text>
          )}
          {timeLabel != null && isRecurring && (
            <Text size="b4" shade={6}>
              ·
            </Text>
          )}
          {isRecurring &&
            (detail.permissions.canEdit ? (
              <OwnRepeatLabel />
            ) : (
              <Text size="b4" shade={6}>
                {t('chip.repeat')}
              </Text>
            ))}
        </HStack>
      )}
      <HStack gap={8} align="center" wrap="wrap">
        <CategoryHeaderPill label={todo.category.name} color={todo.category.color} />
        <Text size="e1" shade={6}>
          {dateLabel}
        </Text>
      </HStack>
    </VStack>
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
      <TodoProgress value={subTodoStats.completed} total={subTodoStats.total} />
      <VStack>
        {todo.subTodos.map((subTodo) => (
          <TodoRow
            key={subTodo.id}
            left={
              <TodoCheckbox
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
                          date: TodoPolicy.getOptimisticListDate(todo, todayKey),
                        })
                    : undefined
                }
              />
            }
            top={<TodoLabel isCompleted={subTodo.completed}>{subTodo.title}</TodoLabel>}
          />
        ))}
      </VStack>
    </VStack>
  );
};

TodoDetailSummary.Metrics = function Metrics() {
  const { t } = useTranslation('todo');
  const [todoId] = useTodoId();
  const { data: detail } = useSuspenseQuery(useGetTodoDetailsQueryOptions({ todoId }));
  const todayKey = useTodayKey();
  const canNudge = TodoNudgePolicy.canNudgeTodoInRange(detail, todayKey);

  return (
    <HStack gap={16} align="center" wrap="wrap">
      <Metric
        icon={<EyeIcon width={16} height={16} colorClassName="text-gray-5" />}
        count={detail.metrics.viewCount}
      />
      {canNudge && (
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
  const push = useSingleTap(router.push);
  const canThank = TodoThanksPolicy.canThankTodo(detail.todo, {
    canEditTodo: detail.permissions.canEdit,
  });

  if (!canThank) {
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

/** 자기 할 일이 대부분이라 작성자 줄 자리는 잡지 않는다. 친구 할 일은 그 한 줄만 받은 뒤 들어온다 */
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

      <VStack className="gap-2.5 ms-9">
        <VStack gap={6}>
          <TextSkeleton size="b4" className="w-32" />
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

/** 상세 응답에는 반복 규칙이 없어 시작일 목록에서 읽는다. 받기 전이나 실패하면 반복이라고만 보인다 */
function OwnRepeatLabel() {
  const { t } = useTranslation('todo');
  const [todoId] = useTodoId();
  const { data: detail } = useSuspenseQuery(useGetTodoDetailsQueryOptions({ todoId }));
  const { data: list } = useQuery(useGetTodosByDateQueryOptions({ date: detail.todo.startDate }));
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const repeat = list?.todos.find((todo) => todo.id === todoId)?.repeat;

  return (
    <Text size="b4" shade={6} className="shrink">
      {repeat == null ? t('chip.repeat') : formatRepeatSummary(repeat, todayKey, dateFormatContext)}
    </Text>
  );
}

function Metric({ icon, count }: { icon: ReactNode; count: number }) {
  return (
    <HStack gap={4} align="center">
      {icon}
      <Text size="e1" shade={5}>
        {count}
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
