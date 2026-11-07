import { TODO_LIMITS, TODO_UPDATE_SCOPES } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { toTodoEditFormValues } from '@src/features/planning/composer/utils/to-todo-edit-form-values';
import { TodoScopeSelectContent } from '@src/features/planning/todo/components/todo-scope-select-content';
import { TodoRepeatPolicy } from '@src/features/planning/todo/domains/todo-repeat.model';
import { shouldReopenRepeatPicker } from '@src/features/planning/todo/domains/todo-series.error';
import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import { useTodoParams } from '@src/features/planning/todo/hooks/use-todo-params';
import { useTodoSheetDateParam } from '@src/features/planning/todo/hooks/use-todo-sheet-params';
import { useGetTodosByDateQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import {
  type TodoRepeat,
  type TodoUpdateScope,
} from '@src/features/planning/todo/schemas/todo-repeat.schema';
import { type Todo } from '@src/features/planning/todo/schemas/todo.schema';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useRetainedValue } from '@src/shared/hooks/use-retained-value';
import { useTranslation } from '@src/shared/i18n';
import {
  BottomSheet,
  BottomSheetInput,
  HStack,
  INQUIRY_SHEET_EXIT,
  KeyboardBottomSheet,
  ModalBottomSheet,
  QueryErrorActions,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  Result,
  useOverlay,
  useSheetRoute,
  VStack,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Separator } from 'heroui-native';
import { Suspense, useEffect, useState } from 'react';
import { Controller, useForm, useFormState, useWatch } from 'react-hook-form';
import { match } from 'ts-pattern';

import { useUpdateTodoMutationOptions } from '../queries/todo-composer.mutations';
import { useGetTodoSeriesQueryOptions } from '../queries/todo-composer.queries';
import { addTodoFormSchema } from '../schemas/add-todo-form.schema';
import {
  hasOnlyDateChanges,
  hasTodoUpdateChanges,
  toTodoUpdateChanges,
} from '../utils/to-todo-update-changes';
import {
  openTodoRepeatPicker,
  TodoComposerChips,
  TodoComposerSubmitButton,
} from './todo-composer-fields';

/** 키보드 시트가 폼 기본값을 할 일로 정하므로, 할 일을 읽는 동안에는 시트를 띄우지 않는다. */
export function TodoEditBottomSheet() {
  return (
    <QueryErrorBoundary fallback={TodoEditBottomSheet.Error}>
      <Suspense fallback={null}>
        <TodoEditBottomSheet.Form />
      </Suspense>
    </QueryErrorBoundary>
  );
}

TodoEditBottomSheet.Form = function Form() {
  const sheet = useSheetRoute('/feed');
  const { todoId } = useTodoParams();
  const date = useTodoSheetDateParam();
  const { data: todosByDate } = useSuspenseQuery(useGetTodosByDateQueryOptions({ date }));
  const todo = useRetainedValue(TodoPolicy.findTodo(todosByDate.todos, todoId));

  useEffect(() => {
    if (todo == null) {
      sheet.exit();
    }
  }, [todo, sheet]);

  if (todo == null) {
    return null;
  }

  const sheetProps = {
    isOpen: sheet.isOpen,
    onOpenChange: sheet.onOpenChange,
    onClose: () => sheet.close(),
  };

  // 규칙은 목록 응답에 실려 있다. 구 서버 응답처럼 규칙이 없는 회차만 따로 읽는다
  return TodoRepeatPolicy.isMissingRepeatRule(todo) ? (
    <TodoEditBottomSheet.SeriesForm todo={todo} seriesId={todo.recurrenceGroupId} {...sheetProps} />
  ) : (
    <TodoEditForm todo={todo} repeat={todo.repeat} {...sheetProps} />
  );
};

type TodoEditSheetProps = Pick<TodoEditFormProps, 'isOpen' | 'onOpenChange' | 'onClose'>;

/** 편집 폼의 기본값이 규칙이라, 반복 할 일은 규칙을 읽은 뒤에 시트를 띄운다. */
TodoEditBottomSheet.SeriesForm = function SeriesForm({
  todo,
  seriesId,
  ...sheetProps
}: TodoEditSheetProps & { todo: Todo; seriesId: string }) {
  const { data: series } = useSuspenseQuery(useGetTodoSeriesQueryOptions({ seriesId }));

  return (
    <TodoEditForm {...sheetProps} todo={todo} repeat={series == null ? null : series.repeat} />
  );
};

TodoEditBottomSheet.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');
  const sheet = useSheetRoute('/feed');

  return (
    <BottomSheet isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
      <Result
        title={t('errorBoundary.title')}
        button={
          <QueryErrorActions onRetry={reset} onInquiry={() => sheet.close(INQUIRY_SHEET_EXIT)} />
        }
      />
    </BottomSheet>
  );
};

interface TodoEditFormProps {
  todo: Todo;
  repeat: TodoRepeat | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
}

function TodoEditForm({ todo, repeat, isOpen, onOpenChange, onClose }: TodoEditFormProps) {
  const { t } = useTranslation('todo');
  const { timeZone } = useDateFormatContext();
  const reportUnexpectedError = useReportUnexpectedError('todo');
  const overlay = useOverlay();

  // 서버 재조회로 할 일이 바뀌어도 고치기 시작한 값과 비교한다. 사용자가 안 고친 칸을 덮어쓰지 않는다
  const [initialValues] = useState(() => toTodoEditFormValues(todo, timeZone, repeat));
  const canChangeRepeat = TodoRepeatPolicy.canChangeRepeat({
    ...todo,
    repeat: initialValues.repeat,
  });

  const form = useForm({
    resolver: zodResolver(addTodoFormSchema),
    defaultValues: initialValues,
  });
  const { isSubmitting } = useFormState({ control: form.control });
  const title = useWatch({ control: form.control, name: 'title' });
  const updateTodo = useMutation(useUpdateTodoMutationOptions());

  const focusTitle = () => requestAnimationFrame(() => form.setFocus('title'));

  // 입력 시트 안에서 내용을 갈아 끼우면 키보드가 내려가는 동안 높이가 튀어 떠 있는 시트로 묻는다
  const selectEditScope = async (
    date: string,
    { isFollowingOnly = false }: { isFollowingOnly?: boolean } = {},
  ) => {
    const scope = await overlay.openAsync<TodoUpdateScope | null>(
      ({ isOpen: isScopeOpen, close, unmount }) => (
        <ModalBottomSheet isOpen={isScopeOpen} onOpenChange={() => close(null)} onExit={unmount}>
          <TodoScopeSelectContent
            action="edit"
            date={date}
            scopes={isFollowingOnly ? ['THIS_AND_FOLLOWING'] : TODO_UPDATE_SCOPES}
            onChange={(selected) => close(selected === 'ALL' ? null : selected)}
            onBack={() => close(null)}
          />
        </ModalBottomSheet>
      ),
      { dismissedValue: null },
    );
    if (scope == null) {
      focusTitle();
    }

    return scope;
  };

  const submitTodo = form.handleSubmit(async (values) => {
    try {
      const changes = toTodoUpdateChanges(values, initialValues, timeZone);
      if (!hasTodoUpdateChanges(changes)) {
        onClose();

        return;
      }
      const scope = await match(
        TodoRepeatPolicy.getTodoEditScopeDecision({
          isSeries: TodoRepeatPolicy.hasRepeatRule({ ...todo, repeat: initialValues.repeat }),
          repeat: changes.repeat,
          isDateOnly: hasOnlyDateChanges(changes),
        }),
      )
        .returnType<Promise<TodoUpdateScope | null | undefined>>()
        .with('not-repeating', async () => undefined)
        .with('this-only', async () => 'THIS_ONLY')
        .with('ask', () => selectEditScope(todo.startDate))
        .with('ask-following-only', () =>
          selectEditScope(todo.startDate, { isFollowingOnly: true }),
        )
        .exhaustive();
      // nullish-strict: 생략은 범위가 없는 수정, null은 범위 선택에서 뒤로 간 취소다
      if (scope === null) {
        return;
      }
      await updateTodo.mutateAsync(
        {
          todoId: todo.id,
          input: changes.input,
          options: {
            ...(scope != null && { scope }),
            // nullish-strict: repeat null은 반복 끝내기라 보낸다
            ...(changes.repeat !== undefined && { repeat: changes.repeat }),
          },
        },
        { onSuccess: onClose },
      );
    } catch (error) {
      // 안내는 mutation 토스트가 맡고 시트와 입력값은 그대로 남긴다. 루트 overlay에서는 경계로 보내면 앱 전체가 내려간다
      reportUnexpectedError(error);
      if (shouldReopenRepeatPicker(error)) {
        openTodoRepeatPicker(overlay, form);
      }
    }
  });

  const isSubmitDisabled = title.trim().length === 0 || isSubmitting;

  return (
    <KeyboardBottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      footer={
        <VStack gap={12}>
          <Separator thickness={1} className="bg-gray-2" />

          <HStack gap={8} align="center" justify="end">
            <TodoComposerSubmitButton
              isDisabled={isSubmitDisabled}
              isSubmitting={isSubmitting}
              onPress={() => submitTodo()}
            />
          </HStack>
        </VStack>
      }
    >
      <VStack gap={12} testID="todo-add-sheet">
        <Controller
          control={form.control}
          name="title"
          render={({ field: { onChange, value, ref } }) => (
            <BottomSheetInput
              ref={ref}
              autoFocus
              placeholder={t('add.placeholder')}
              value={value}
              onChange={onChange}
              maxLength={TODO_LIMITS.TITLE_MAX_LENGTH}
              size="medium"
              renderErrorMessage={false}
              returnKeyType="done"
              onSubmitEditing={() => (isSubmitDisabled ? onClose() : submitTodo())}
            />
          )}
        />

        <TodoComposerChips
          form={form}
          isSeriesOccurrence={TodoPolicy.isRecurringTodo(todo)}
          canChangeRepeat={canChangeRepeat}
        />
      </VStack>
    </KeyboardBottomSheet>
  );
}
