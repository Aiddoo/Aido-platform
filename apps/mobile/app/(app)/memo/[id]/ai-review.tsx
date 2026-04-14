import { ErrorCode } from '@aido/errors';
import type { ParsedMemoResult, ParsedMemoTodo } from '@src/features/ai/models/ai.model';
import { AI_QUERY_KEYS } from '@src/features/ai/presentations/constants/ai-query-keys.constant';
import { useConvertMemoToTodosMutationOptions } from '@src/features/memo/presentations/queries/use-convert-memo-to-todos-mutation-options';
import { CategorySelectContent } from '@src/features/todo/presentations/components/CategorySelectBottomSheet';
import { TodoDatePickerContent } from '@src/features/todo/presentations/components/TodoDatePickerContent';
import { TodoTimePickerContent } from '@src/features/todo/presentations/components/TodoTimePickerContent';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/presentations/queries/use-get-todo-categories-query-options';
import { isApiError } from '@src/shared/errors';
import {
  ACTION_CHIP_ICON_SIZE,
  ActionChip,
  Box,
  Button,
  CalendarIcon,
  ClockIcon,
  HStack,
  ModalBottomSheet,
  QueryErrorBoundary,
  Result,
  RobotPixelIcon,
  Spacing,
  Text,
  useOverlay,
  VStack,
} from '@src/shared/ui';
import { formatDate, formatMonthDay } from '@src/shared/utils/date';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CloseButton } from 'heroui-native';
import { createContext, Suspense, use, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';

const StyledTextInput = withUniwind(TextInput);

const DAY_LABELS: Record<string, string> = {
  MON: '월',
  TUE: '화',
  WED: '수',
  THU: '목',
  FRI: '금',
  SAT: '토',
  SUN: '일',
};

type TodoWithId = ParsedMemoTodo & { _key: string };

interface TodosContextValue {
  todos: TodoWithId[];
  updateTodo: (index: number, updates: Partial<ParsedMemoTodo>) => void;
  removeTodo: (index: number) => void;
}

const TodosContext = createContext<TodosContextValue | null>(null);
const useTodos = () => {
  const ctx = use(TodosContext);
  if (!ctx) throw new Error('TodosContext is required');
  return ctx;
};

export default function AiReviewScreen() {
  return (
    <VStack className="flex-1 bg-white">
      <QueryErrorBoundary fallback={({ error }) => <AiReviewScreen.Error error={error} />}>
        <Suspense fallback={<AiReviewScreen.Loading />}>
          <AiReviewContent />
        </Suspense>
      </QueryErrorBoundary>
    </VStack>
  );
}

AiReviewScreen.Loading = function Loading() {
  return (
    <VStack className="flex-1 items-center justify-center gap-3">
      <ActivityIndicator size="large" />
      <Text size="b3" shade={7}>
        메모를 분석하고 있어요...
      </Text>
    </VStack>
  );
};

AiReviewScreen.Error = function ErrorFallback({ error }: { error: unknown }) {
  const router = useRouter();

  if (isApiError(error) && error.hasCode(ErrorCode.AI_1303)) {
    return (
      <Result
        title="오늘의 AI 사용 횟수를 모두 사용했어요"
        description="구독하면 무제한으로 사용할 수 있어요"
        button={
          <Result.Button onPress={() => router.replace('/settings/subscription')}>
            구독하기
          </Result.Button>
        }
      />
    );
  }

  const message = isApiError(error) ? error.message : '잠시 후 다시 시도해 주세요';

  return (
    <Result
      title="파싱에 실패했어요"
      description={message}
      button={<Result.Button onPress={() => router.back()}>돌아가기</Result.Button>}
    />
  );
};

function AiReviewContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memoId = Number(id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { bottom: safeBottom } = useSafeAreaInsets();

  const parsedResult = queryClient.getQueryData<ParsedMemoResult>(AI_QUERY_KEYS.parseMemo(memoId));

  const nextId = useRef(0);
  const [todos, setTodos] = useState<TodoWithId[]>(
    () => parsedResult?.todos.map((todo) => ({ ...todo, _key: `todo-${nextId.current++}` })) ?? [],
  );
  const convertMutation = useMutation(useConvertMemoToTodosMutationOptions());

  if (!parsedResult) {
    router.back();
    return null;
  }

  const updateTodo = (index: number, updates: Partial<ParsedMemoTodo>) => {
    setTodos((prev) => prev.map((todo, i) => (i === index ? { ...todo, ...updates } : todo)));
  };

  const handleRemoveTodo = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTodos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (todos.length === 0) return;

    convertMutation.mutate(
      {
        memoId,
        input: {
          todos: todos.map((todo) => ({
            title: todo.title,
            categoryId: todo.categoryId,
            startDate: todo.startDate,
            endDate: todo.endDate ?? undefined,
            scheduledTime: todo.scheduledTime ?? undefined,
            isAllDay: todo.isAllDay,
            visibility: 'PUBLIC' as const,
            isRecurring: todo.isRecurring,
            recurrence: todo.recurrence ?? undefined,
            items: todo.items,
          })),
        },
      },
      {
        onSuccess: () => {
          router.dismiss();
          router.navigate('/feed');
        },
      },
    );
  };

  if (todos.length === 0) {
    return (
      <Result
        title="생성할 할 일이 없어요"
        button={<Result.Button onPress={() => router.back()}>돌아가기</Result.Button>}
      />
    );
  }

  return (
    <>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 16 }}
      >
        <TodosContext value={{ todos, updateTodo, removeTodo: handleRemoveTodo }}>
          {todos.map((todo, index) => (
            <TodoCard key={todo._key} index={index} />
          ))}
        </TodosContext>
      </ScrollView>

      <Box px={16} style={{ paddingBottom: safeBottom || 16 }}>
        <Button
          onPress={handleConfirm}
          isDisabled={todos.length === 0}
          isLoading={convertMutation.isPending}
        >
          {`${todos.length}개 할 일 생성`}
        </Button>
      </Box>
    </>
  );
}

interface TodoCardProps {
  index: number;
}

function TodoCard({ index }: TodoCardProps) {
  const { todos, updateTodo, removeTodo } = useTodos();
  const todo = todos[index];
  const { data: categoriesData } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const overlay = useOverlay();

  const category = useMemo(
    () => (todo ? categoriesData.categories.find((c) => c.id === todo.categoryId) : undefined),
    [categoriesData.categories, todo?.categoryId, todo],
  );

  if (!todo) return null;

  const dateLabel = todo.endDate
    ? `${formatMonthDay(todo.startDate)} ~ ${formatMonthDay(todo.endDate)}`
    : formatMonthDay(todo.startDate);

  const timeLabel = todo.isAllDay ? '종일' : (todo.scheduledTime ?? '종일');

  const openDatePicker = () => {
    overlay.open<Date | null>(({ isOpen, close, exit }) => (
      <ModalBottomSheet isOpen={isOpen} onClose={() => close(null)} onExit={exit}>
        <TodoDatePickerContent
          startDate={new Date(todo.startDate)}
          onConfirm={(date) => {
            updateTodo(index, { startDate: formatDate(date) });
            close(date);
          }}
          onCancel={() => close(null)}
        />
      </ModalBottomSheet>
    ));
  };

  const openTimePicker = () => {
    overlay.open<{ time: string | undefined; isAllDay: boolean } | null>(
      ({ isOpen, close, exit }) => (
        <ModalBottomSheet isOpen={isOpen} onClose={() => close(null)} onExit={exit}>
          <Suspense fallback={<ActivityIndicator />}>
            <TodoTimePickerContent
              draftDate={new Date(todo.startDate)}
              scheduledTime={todo.scheduledTime ?? undefined}
              isAllDay={todo.isAllDay}
              onConfirm={(time, isAllDay) => {
                updateTodo(index, { scheduledTime: time ?? null, isAllDay });
                close({ time, isAllDay });
              }}
              onCancel={() => close(null)}
            />
          </Suspense>
        </ModalBottomSheet>
      ),
    );
  };

  const openCategoryPicker = () => {
    overlay.open<number | null>(({ isOpen, close, exit }) => (
      <ModalBottomSheet isOpen={isOpen} onClose={() => close(null)} onExit={exit}>
        <Suspense fallback={<ActivityIndicator />}>
          <CategorySelectModalContent
            selectedCategoryId={todo.categoryId}
            onSelect={(categoryId) => {
              updateTodo(index, { categoryId });
              close(categoryId);
            }}
          />
        </Suspense>
      </ModalBottomSheet>
    ));
  };

  return (
    <VStack px={20} py={16} className="overflow-hidden rounded-2xl bg-gray-1">
      <Box className="absolute right-2 top-2 z-10">
        <CloseButton onPress={() => removeTodo(index)} iconProps={{ size: 14 }} />
      </Box>

      <VStack className="mr-6 border-b-2 border-gray-3 dark:border-gray-2">
        <StyledTextInput
          value={todo.title}
          onChangeText={(text) => updateTodo(index, { title: text })}
          className="text-b1 font-semibold text-gray-9"
          allowFontScaling={false}
        />
      </VStack>

      <Spacing size={12} />

      {todo.items.length > 0 && (
        <VStack className="gap-1.5 pl-2 pr-4">
          {todo.items.map((item) => (
            <HStack key={item.title} align="center" gap={8}>
              <Box className="size-1.5 rounded-full bg-gray-5" />
              <Text size="b3" shade={8}>
                {item.title}
              </Text>
            </HStack>
          ))}
        </VStack>
      )}

      <Spacing size={16} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2"
      >
        <ActionChip
          icon={
            <CalendarIcon
              width={ACTION_CHIP_ICON_SIZE}
              height={ACTION_CHIP_ICON_SIZE}
              colorClassName="text-gray-5"
            />
          }
          label={dateLabel}
          onPress={openDatePicker}
        />
        <ActionChip
          icon={
            <ClockIcon
              width={ACTION_CHIP_ICON_SIZE}
              height={ACTION_CHIP_ICON_SIZE}
              colorClassName="text-gray-5"
            />
          }
          label={timeLabel}
          onPress={openTimePicker}
        />
        <ActionChip
          icon={
            <Box className="size-2 rounded-full" style={{ backgroundColor: category?.color }} />
          }
          label={category?.name ?? '카테고리'}
          onPress={openCategoryPicker}
        />
      </ScrollView>

      {todo.isRecurring && todo.recurrence && (
        <Text size="e1" shade={6}>
          매주 {todo.recurrence.daysOfWeek.map((d) => DAY_LABELS[d] ?? d).join(', ')}
        </Text>
      )}

      <Box className="absolute -bottom-6 -right-2 rotate-[-10deg] opacity-30" pointerEvents="none">
        <RobotPixelIcon width={96} height={96} colorClassName="text-main" />
      </Box>
    </VStack>
  );
}

function CategorySelectModalContent({
  selectedCategoryId,
  onSelect,
}: {
  selectedCategoryId: number;
  onSelect: (categoryId: number) => void;
}) {
  const { data } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());

  return (
    <CategorySelectContent
      categories={data.categories}
      selectedCategoryId={selectedCategoryId}
      onSelect={onSelect}
      submitLabel="선택하기"
      isLoading={false}
    />
  );
}
