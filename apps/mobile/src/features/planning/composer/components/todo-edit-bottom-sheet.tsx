import { TODO_LIMITS, TODO_UPDATE_SCOPES } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { toTodoFormValues } from '@src/features/planning/todo/apis/todo.mapper';
import { TodoScopeSelect } from '@src/features/planning/todo/components/todo-scope-select';
import type { TodoUpdateScope } from '@src/features/planning/todo/domains/todo-repeat.model';
import { shouldReopenRepeatPicker } from '@src/features/planning/todo/domains/todo-series.error';
import { type Todo, TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import { useSuspenseSheetTodo } from '@src/features/planning/todo/hooks/use-suspense-sheet-todo';
import { todoFormSchema } from '@src/features/planning/todo/schemas/todo-form.schema';
import { SERVER_VALUES_RESET_OPTIONS } from '@src/shared/constants/server-values-reset-options';
import type { DateKey } from '@src/shared/date/date-key';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  BottomSheet,
  Input,
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
import { Controller, FormState, useForm, Watch } from 'react-hook-form';
import { match } from 'ts-pattern';

import { createTodoChange, TodoChangePolicy } from '../domains/todo-change.model';
import { useFocusTodoTitle } from '../hooks/use-focus-todo-title';
import { useReopenTodoRepeatPicker } from '../hooks/use-reopen-todo-repeat-picker';
import { useUpdateTodoMutationOptions } from '../queries/todo-composer.mutations';
import {
  setTodoComposerChipFields,
  TODO_COMPOSER_CHIP_FIELDS,
  TodoComposerChips,
} from './todo-composer-chips';
import { TodoComposerSubmitButton } from './todo-composer-submit-button';

type EditScopeChoice =
  | { kind: 'unscoped' }
  | { kind: 'scoped'; scope: TodoUpdateScope }
  | { kind: 'cancelled' };

// 회차 규칙을 바꾸면 서버가 이후 할 일까지로만 받는다(TODO_0845)
const FOLLOWING_ONLY_SCOPES = ['THIS_AND_FOLLOWING'] as const satisfies readonly TodoUpdateScope[];

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
  const todo = useSuspenseSheetTodo({ onMissing: () => sheet.exit() });

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
            onInquiry={(href) => sheet.close({ type: 'dismiss-to', href })}
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
  const { timezone } = useDateFormatContext();
  const openSheet = useOpenSheet();
  const reportUnexpectedError = useReportUnexpectedError('todo');

  // 다시 받은 할 일로 비교 기준을 맞춘다. 고치지 않은 칸은 새 값을 보이고 고치던 칸은 남아 고친 칸만 보낸다
  const savedValues = toTodoFormValues(todo, timezone);
  const canChangeRepeat = TodoPolicy.canChangeRepeat(todo);

  const form = useForm({
    resolver: zodResolver(todoFormSchema),
    values: savedValues,
    resetOptions: SERVER_VALUES_RESET_OPTIONS,
  });
  const updateTodo = useMutation(useUpdateTodoMutationOptions());
  const reopenRepeatPicker = useReopenTodoRepeatPicker(form);
  const focusTitle = useFocusTodoTitle(form.setFocus);

  // 입력 시트 안에서 내용을 갈아 끼우면 키보드가 내려가는 동안 높이가 튀어 떠 있는 시트로 묻는다
  const selectEditScope = async (
    date: DateKey,
    scopes: readonly TodoUpdateScope[],
  ): Promise<EditScopeChoice> => {
    const scope = await openSheet<TodoUpdateScope>((close) => (
      <TodoScopeSelect
        action="edit"
        date={date}
        scopes={scopes}
        onChange={(selected) => close(selected)}
        onBack={() => close()}
      />
    ));
    if (scope == null) {
      focusTitle();
      return { kind: 'cancelled' };
    }
    return { kind: 'scoped', scope };
  };

  // 실패는 여기서 받지 않고 호출부가 받는다. 안내는 mutation 토스트가 맡고 시트와 입력값은 그대로 남긴다
  const saveTodo = form.handleSubmit(async (values) => {
    const changes = createTodoChange(values, savedValues);
    if (!TodoChangePolicy.hasTodoUpdateChanges(changes)) {
      onClose();

      return;
    }
    const choice = await match(
      TodoChangePolicy.getEditScopeDecision(changes, TodoPolicy.hasRepeatRule(todo)),
    )
      .returnType<Promise<EditScopeChoice>>()
      .with('no-scope', async () => ({ kind: 'unscoped' }))
      .with('this-only', async () => ({ kind: 'scoped', scope: 'THIS_ONLY' }))
      .with('ask', () => selectEditScope(todo.startDate, TODO_UPDATE_SCOPES))
      .with('ask-following-only', () => selectEditScope(todo.startDate, FOLLOWING_ONLY_SCOPES))
      .exhaustive();
    if (choice.kind === 'cancelled') {
      return;
    }
    await updateTodo.mutateAsync(
      {
        todoId: todo.id,
        fields: changes.fields,
        options: {
          ...(choice.kind === 'scoped' && { scope: choice.scope }),
          // oxlint-disable-next-line aido/no-strict-nullish -- repeat null은 반복 끝내기라 보낸다
          ...(changes.repeat !== undefined && { repeat: changes.repeat }),
        },
      },
      { onSuccess: onClose },
    );
  });

  // isSubmitting은 다음 렌더에야 켜져 같은 프레임의 두 번째 탭이 범위를 또 묻고 한 번 더 보낸다
  const handleSavePress = useSingleTap(() => {
    saveTodo().catch((error: unknown) => {
      // 루트 overlay에서는 경계로 보내면 앱 전체가 내려간다
      if (shouldReopenRepeatPicker(error)) {
        reopenRepeatPicker().catch(reportUnexpectedError);
      }
    });
  });

  // 저장 중에는 아무 일도 하지 않는다. 시트를 닫으면 저장 결과를 볼 수 없다. 빈 제목은 저장 대신 닫는다
  const handleTitleSubmit = (isSubmitting: boolean, isValid: boolean) => {
    if (isSubmitting) {
      return;
    }
    if (!isValid) {
      onClose();

      return;
    }
    handleSavePress();
  };

  return (
    <KeyboardBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <VStack gap={12} testID="todo-add-sheet">
        <Controller
          control={form.control}
          name="title"
          render={({ field, formState: { isSubmitting, isValid } }) => (
            <Input
              ref={field.ref}
              autoFocus
              placeholder={t('add.placeholder')}
              value={field.value}
              onChange={field.onChange}
              maxLength={TODO_LIMITS.TITLE_MAX_LENGTH}
              size="medium"
              renderErrorMessage={false}
              returnKeyType="done"
              onSubmitEditing={() => handleTitleSubmit(isSubmitting, isValid)}
            />
          )}
        />

        <Watch
          control={form.control}
          name={TODO_COMPOSER_CHIP_FIELDS}
          render={([
            startDate,
            endDate,
            scheduledTime,
            isAllDay,
            repeat,
            visibility,
            categoryId,
          ]) => (
            <TodoComposerChips
              value={{
                startDate,
                endDate,
                scheduledTime,
                isAllDay,
                repeat,
                visibility,
                categoryId,
              }}
              onChange={(next) => setTodoComposerChipFields(form.setValue, next)}
              onPickerCloseStart={focusTitle}
              isSeriesOccurrence={TodoPolicy.isRecurringTodo(todo)}
              canChangeRepeat={canChangeRepeat}
            />
          )}
        />

        <Separator thickness={1} className="bg-gray-2" />

        <HStack gap={8} align="center" justify="end">
          <FormState
            control={form.control}
            render={({ isValid, isSubmitting }) => (
              <TodoComposerSubmitButton
                isDisabled={!isValid || isSubmitting}
                isSubmitting={isSubmitting}
                onPress={() => handleSavePress()}
              />
            )}
          />
        </HStack>
      </VStack>
    </KeyboardBottomSheet>
  );
}
