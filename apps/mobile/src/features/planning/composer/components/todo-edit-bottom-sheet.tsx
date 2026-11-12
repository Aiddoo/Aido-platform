import { TODO_LIMITS, TODO_UPDATE_SCOPES } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { toTodoFormValues } from '@src/features/planning/todo/apis/todo.mapper';
import { TodoScopeSelect } from '@src/features/planning/todo/components/todo-scope-select';
import { TodoRepeatPolicy } from '@src/features/planning/todo/domains/todo-repeat.model';
import { type TodoUpdateScope } from '@src/features/planning/todo/domains/todo-repeat.model';
import { shouldReopenRepeatPicker } from '@src/features/planning/todo/domains/todo-series.error';
import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import { type Todo } from '@src/features/planning/todo/domains/todo.model';
import { useSheetTodo } from '@src/features/planning/todo/hooks/use-sheet-todo';
import { todoFormSchema } from '@src/features/planning/todo/schemas/todo-form.schema';
import type { DateKey } from '@src/shared/date/date-key';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useTranslation } from '@src/shared/i18n';
import {
  BottomSheet,
  BottomSheetInput,
  HStack,
  KeyboardBottomSheet,
  QueryErrorActions,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  Result,
  useOpenSheet,
  useSheetRoute,
  VStack,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { Separator } from 'heroui-native';
import { Suspense } from 'react';
import { Controller, useForm, useFormState } from 'react-hook-form';
import { match } from 'ts-pattern';

import { TodoChangePolicy } from '../domains/todo-change.model';
import { useFocusTodoTitle } from '../hooks/use-focus-todo-title';
import { useReopenTodoRepeatPicker } from '../hooks/use-reopen-todo-repeat-picker';
import { useUpdateTodoMutationOptions } from '../queries/todo-composer.mutations';
import { toTodoUpdateChanges } from '../utils/to-todo-update-changes';
import { TodoComposerChips } from './todo-composer-chips';
import { TodoComposerSubmitButton } from './todo-composer-submit-button';

/** 고칠 범위를 정한 결과. 범위 없이 고치는 할 일, 범위를 고른 반복 회차, 범위 고르기에서 뒤로 간 취소 셋이다 */
type EditScopeChoice =
  | { kind: 'unscoped' }
  | { kind: 'scoped'; scope: TodoUpdateScope }
  | { kind: 'cancelled' };

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
  const todo = useSheetTodo({ onMissing: () => sheet.exit() });

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
          <QueryErrorActions
            onRetry={reset}
            onInquiry={(href) => sheet.close({ type: 'replace', href })}
          />
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
  const openSheet = useOpenSheet();
  const reportUnexpectedError = useReportUnexpectedError('todo');

  // 다시 받은 할 일로 비교 기준을 맞춘다. 고치지 않은 칸은 새 값을 보이고 고치던 칸은 남아 고친 칸만 보낸다
  const savedValues = toTodoFormValues(todo, timeZone);
  const canChangeRepeat = TodoRepeatPolicy.canChangeRepeat({
    ...todo,
    repeat: savedValues.repeat,
  });

  const form = useForm({
    resolver: zodResolver(todoFormSchema),
    values: savedValues,
    resetOptions: { keepDirtyValues: true },
  });
  const { isSubmitting, isValid } = useFormState({ control: form.control });
  const updateTodo = useMutation(useUpdateTodoMutationOptions());
  const reopenRepeatPicker = useReopenTodoRepeatPicker(form);

  const focusTitle = useFocusTodoTitle(form);

  // 입력 시트 안에서 내용을 갈아 끼우면 키보드가 내려가는 동안 높이가 튀어 떠 있는 시트로 묻는다
  const selectEditScope = async (
    date: DateKey,
    { isFollowingOnly = false }: { isFollowingOnly?: boolean } = {},
  ): Promise<EditScopeChoice> => {
    const scope = await openSheet<TodoUpdateScope>((close) => (
      <TodoScopeSelect
        action="edit"
        date={date}
        scopes={isFollowingOnly ? ['THIS_AND_FOLLOWING'] : TODO_UPDATE_SCOPES}
        onChange={(selected) => close(selected === 'ALL' ? undefined : selected)}
        onBack={() => close()}
      />
    ));
    if (scope == null) {
      focusTitle();
      return { kind: 'cancelled' };
    }
    return { kind: 'scoped', scope };
  };

  const submitTodo = form.handleSubmit(async (values) => {
    try {
      const changes = toTodoUpdateChanges(values, savedValues);
      if (!TodoChangePolicy.hasTodoUpdateChanges(changes)) {
        onClose();

        return;
      }
      const choice = await match(
        TodoRepeatPolicy.getTodoEditScopeDecision({
          isSeries: TodoRepeatPolicy.hasRepeatRule({ ...todo, repeat: savedValues.repeat }),
          repeat: changes.repeat,
          isDateOnly: TodoChangePolicy.hasOnlyDateChanges(changes),
        }),
      )
        .returnType<Promise<EditScopeChoice>>()
        .with('no-scope', async () => ({ kind: 'unscoped' }))
        .with('this-only', async () => ({ kind: 'scoped', scope: 'THIS_ONLY' }))
        .with('ask', () => selectEditScope(todo.startDate))
        .with('ask-following-only', () =>
          selectEditScope(todo.startDate, { isFollowingOnly: true }),
        )
        .exhaustive();
      if (choice.kind === 'cancelled') {
        return;
      }
      await updateTodo.mutateAsync(
        {
          todoId: todo.id,
          input: changes.input,
          options: {
            ...(choice.kind === 'scoped' && { scope: choice.scope }),
            // oxlint-disable-next-line aido/no-strict-nullish -- repeat null은 반복 끝내기라 보낸다
            ...(changes.repeat !== undefined && { repeat: changes.repeat }),
          },
        },
        { onSuccess: onClose },
      );
    } catch (error) {
      // 안내는 mutation 토스트가 맡고 시트와 입력값은 그대로 남긴다. 루트 overlay에서는 경계로 보내면 앱 전체가 내려간다
      if (shouldReopenRepeatPicker(error)) {
        reopenRepeatPicker().catch(reportUnexpectedError);
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
