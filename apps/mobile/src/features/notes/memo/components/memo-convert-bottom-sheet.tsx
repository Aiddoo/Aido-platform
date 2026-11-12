import { TODO_LIMITS } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { TodoComposerChips } from '@src/features/planning/composer/components/todo-composer-chips';
import { TodoComposerSubmitButton } from '@src/features/planning/composer/components/todo-composer-submit-button';
import { useReopenTodoRepeatPicker } from '@src/features/planning/composer/hooks/use-reopen-todo-repeat-picker';
import { shouldReopenRepeatPicker } from '@src/features/planning/todo/domains/todo-series.error';
import { todoFormSchema } from '@src/features/planning/todo/schemas/todo-form.schema';
import type { DateKey } from '@src/shared/date/date-key';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useTranslation } from '@src/shared/i18n';
import { BottomSheetInput, HStack, KeyboardBottomSheet, VStack } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { Separator } from 'heroui-native';
import type { ComponentProps } from 'react';
import { Controller, useForm, useFormState } from 'react-hook-form';

import type { Memo } from '../domains/memo.model';
import { useConvertMemoToTodosMutationOptions } from '../queries/memo.mutations';

interface MemoConvertBottomSheetProps extends Pick<
  ComponentProps<typeof KeyboardBottomSheet>,
  'isOpen' | 'onOpenChange'
> {
  memo: Pick<Memo, 'id' | 'content'>;
  selectedDate: DateKey;
  categoryId: number;
  onClose: () => void;
  onConverted: () => void;
}

/** 메모를 할 일 하나로 옮긴다. 제목은 메모 내용으로 채워 두고, 입력칸과 칩은 할 일 작성과 같다 */
export function MemoConvertBottomSheet({
  memo,
  selectedDate,
  categoryId,
  isOpen,
  onOpenChange,
  onClose,
  onConverted,
}: MemoConvertBottomSheetProps) {
  const { t } = useTranslation('todo');
  const reportUnexpectedError = useReportUnexpectedError('todo');
  const form = useForm({
    resolver: zodResolver(todoFormSchema),
    defaultValues: {
      title: memo.content.slice(0, TODO_LIMITS.TITLE_MAX_LENGTH),
      startDate: selectedDate,
      endDate: null,
      scheduledTime: null,
      isAllDay: true,
      categoryId,
      visibility: 'PUBLIC',
      repeat: null,
    },
  });
  const { isSubmitting, isValid } = useFormState({ control: form.control });
  const convertMemo = useMutation(useConvertMemoToTodosMutationOptions());
  const reopenRepeatPicker = useReopenTodoRepeatPicker(form);
  const isSubmitDisabled = !isValid || isSubmitting;

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await convertMemo.mutateAsync({ memoId: memo.id, values });
      onClose();
      onConverted();
    } catch (error) {
      // 안내는 mutation 토스트가 맡고 시트와 입력값은 그대로 남긴다. 루트 overlay에서는 경계로 보내면 앱 전체가 내려간다
      if (shouldReopenRepeatPicker(error)) {
        reopenRepeatPicker().catch(reportUnexpectedError);
      }
    }
  });

  // 저장 중에는 아무 일도 하지 않는다. 시트를 닫으면 저장 결과를 볼 수 없다. 빈 제목은 저장 대신 닫는다
  const handleTitleSubmit = () => {
    if (isSubmitting) {
      return;
    }
    if (!isValid) {
      onClose();

      return;
    }
    handleSubmit();
  };

  return (
    <KeyboardBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <VStack gap={12} testID="memo-convert-sheet">
        <Controller
          control={form.control}
          name="title"
          render={({ field: { value, onChange, ref } }) => (
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

        <TodoComposerChips form={form} />

        <Separator thickness={1} className="bg-gray-2" />

        <HStack align="center" justify="end">
          <TodoComposerSubmitButton
            isDisabled={isSubmitDisabled}
            isSubmitting={isSubmitting}
            onPress={() => handleSubmit()}
          />
        </HStack>
      </VStack>
    </KeyboardBottomSheet>
  );
}
