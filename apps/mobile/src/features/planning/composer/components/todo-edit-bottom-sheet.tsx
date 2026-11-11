import { TODO_LIMITS, TODO_UPDATE_SCOPES } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { TodoScopeSelectContent } from '@src/features/planning/todo/components/todo-scope-select-content';
import { TodoRepeatPolicy } from '@src/features/planning/todo/domains/todo-repeat.model';
import { type TodoUpdateScope } from '@src/features/planning/todo/domains/todo-repeat.model';
import { shouldReopenRepeatPicker } from '@src/features/planning/todo/domains/todo-series.error';
import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import { type Todo } from '@src/features/planning/todo/domains/todo.model';
import { useTodoId } from '@src/features/planning/todo/hooks/use-todo-params';
import { useTodoSheetDateKey } from '@src/features/planning/todo/hooks/use-todo-sheet-date-key';
import { useGetTodosByDateQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
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
import { Controller, useForm, useFormState } from 'react-hook-form';
import { match } from 'ts-pattern';

import { TodoChangePolicy } from '../domains/todo-change.model';
import { useUpdateTodoMutationOptions } from '../queries/todo-composer.mutations';
import { addTodoFormSchema } from '../schemas/add-todo-form.schema';
import { toTodoEditFormValues } from '../utils/to-todo-edit-form-values';
import { toTodoUpdateChanges } from '../utils/to-todo-update-changes';
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
  const [todoId] = useTodoId();
  const [date] = useTodoSheetDateKey();
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

  return (
    <TodoEditForm
      todo={todo}
      isOpen={sheet.isOpen}
      onOpenChange={sheet.onOpenChange}
      onClose={() => sheet.close()}
    />
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
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
}

function TodoEditForm({ todo, isOpen, onOpenChange, onClose }: TodoEditFormProps) {
  const { t } = useTranslation('todo');
  const { timeZone } = useDateFormatContext();
  const overlay = useOverlay();

  // 서버 재조회로 할 일이 바뀌어도 고치기 시작한 값과 비교한다. 사용자가 안 고친 칸을 덮어쓰지 않는다
  const [initialValues] = useState(() => toTodoEditFormValues(todo, timeZone));
  const canChangeRepeat = TodoRepeatPolicy.canChangeRepeat({
    ...todo,
    repeat: initialValues.repeat,
  });

  const form = useForm({
    resolver: zodResolver(addTodoFormSchema),
    defaultValues: initialValues,
  });
  const { isSubmitting, isValid } = useFormState({ control: form.control });
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
      if (!TodoChangePolicy.hasTodoUpdateChanges(changes)) {
        onClose();

        return;
      }
      const scope = await match(
        TodoRepeatPolicy.getTodoEditScopeDecision({
          isSeries: TodoRepeatPolicy.hasRepeatRule({ ...todo, repeat: initialValues.repeat }),
          repeat: changes.repeat,
          isDateOnly: TodoChangePolicy.hasOnlyDateChanges(changes),
        }),
      )
        .returnType<Promise<TodoUpdateScope | null | undefined>>()
        .with('no-scope', async () => undefined)
        .with('this-only', async () => 'THIS_ONLY')
        .with('ask', () => selectEditScope(todo.startDate))
        .with('ask-following-only', () =>
          selectEditScope(todo.startDate, { isFollowingOnly: true }),
        )
        .exhaustive();
      // oxlint-disable-next-line aido/no-strict-nullish -- 생략은 범위가 없는 수정, null은 범위 선택에서 뒤로 간 취소다
      if (scope === null) {
        return;
      }
      await updateTodo.mutateAsync(
        {
          todoId: todo.id,
          input: changes.input,
          options: {
            ...(scope != null && { scope }),
            // oxlint-disable-next-line aido/no-strict-nullish -- repeat null은 반복 끝내기라 보낸다
            ...(changes.repeat !== undefined && { repeat: changes.repeat }),
          },
        },
        { onSuccess: onClose },
      );
    } catch (error) {
      // 안내는 mutation 토스트가 맡고 시트와 입력값은 그대로 남긴다. 루트 overlay에서는 경계로 보내면 앱 전체가 내려간다
      if (shouldReopenRepeatPicker(error)) {
        openTodoRepeatPicker(overlay, form);
      }
    }
  });

  const isSubmitDisabled = !isValid || isSubmitting;

  // 저장 중에는 아무 일도 하지 않는다. 시트를 닫으면 저장 결과를 볼 수 없다. 빈 제목은 저장 대신 닫는다
  const handleTitleSubmit = () => {
    if (isSubmitting) {
      return;
    }
    if (!isValid) {
      onClose();

      return;
    }
    submitTodo();
  };

  return (
    <KeyboardBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
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
              onSubmitEditing={handleTitleSubmit}
            />
          )}
        />

        <TodoComposerChips
          form={form}
          isSeriesOccurrence={TodoPolicy.isRecurringTodo(todo)}
          canChangeRepeat={canChangeRepeat}
        />

        <Separator thickness={1} className="bg-gray-2" />

        <HStack gap={8} align="center" justify="end">
          <TodoComposerSubmitButton
            isDisabled={isSubmitDisabled}
            isSubmitting={isSubmitting}
            onPress={() => submitTodo()}
          />
        </HStack>
      </VStack>
    </KeyboardBottomSheet>
  );
}
