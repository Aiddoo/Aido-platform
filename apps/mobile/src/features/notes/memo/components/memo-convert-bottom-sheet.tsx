import { TODO_LIMITS } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { TodoComposerChips } from '@src/features/planning/composer/components/todo-composer-chips';
import { TodoComposerSubmitButton } from '@src/features/planning/composer/components/todo-composer-submit-button';
import { useReopenTodoRepeatPicker } from '@src/features/planning/composer/hooks/use-reopen-todo-repeat-picker';
import { shouldReopenRepeatPicker } from '@src/features/planning/todo/domains/todo-series.error';
import { todoFormSchema } from '@src/features/planning/todo/schemas/todo-form.schema';
import type { DateKey } from '@src/shared/date/date-key';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { BottomSheetInput, HStack, KeyboardBottomSheet, VStack } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { Separator } from 'heroui-native';
import type { ComponentProps } from 'react';
import { Controller, useForm, useFormState } from 'react-hook-form';

import { isMemoUnavailableError } from '../domains/memo.error';
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
  /** 메모가 이미 없어 옮기지 못했다. 시트는 닫혔고 안내는 mutation이 한 번 띄웠다 */
  onUnavailable: () => void;
}

/** 메모를 할 일 하나로 옮긴다. 제목은 메모 내용으로 채워 두고, 입력칸과 칩은 할 일 작성과 같다 */
export function MemoConvertBottomSheet({
  memo,
  isOpen,
  onOpenChange,
  ...formProps
}: MemoConvertBottomSheetProps) {
  // 폼과 저장 잠금은 메모마다 새로 시작한다. 같은 시트가 다른 메모를 받아도 앞 메모의 제목과 저장 완료가 남지 않는다
  return (
    <KeyboardBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <MemoConvertBottomSheet.Form key={memo.id} memo={memo} {...formProps} />
    </KeyboardBottomSheet>
  );
}

MemoConvertBottomSheet.Form = function Form({
  memo,
  selectedDate,
  categoryId,
  onClose,
  onConverted,
  onUnavailable,
}: Omit<MemoConvertBottomSheetProps, 'isOpen' | 'onOpenChange'>) {
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
  const { isSubmitting, isSubmitSuccessful, isValid } = useFormState({ control: form.control });
  const convertMemo = useMutation(useConvertMemoToTodosMutationOptions());
  const reopenRepeatPicker = useReopenTodoRepeatPicker(form);
  // 옮기면 시트가 내려가는 동안에도 같은 제목이 남고 요청에 멱등 키가 없다. 그동안 다시 보내지 않는다
  const isSubmitLocked = isSubmitting || isSubmitSuccessful;
  const isSubmitDisabled = !isValid || isSubmitLocked;

  // 실패는 여기서 받지 않는다. RHF가 실패로 알아야 isSubmitSuccessful이 꺼진 채 남아 다시 보낼 수 있다
  const saveTodo = form.handleSubmit(async (values) => {
    await convertMemo.mutateAsync({ memoId: memo.id, values });
    onClose();
    onConverted();
  });

  // isSubmitting은 다음 렌더에야 켜져 같은 프레임의 두 번째 탭이 할 일을 하나 더 만든다
  const handleSavePress = useSingleTap(() => {
    saveTodo().catch((error: unknown) => {
      // 없는 메모는 다시 보내도 소용없어 시트를 닫고 떠난다
      if (isMemoUnavailableError(error)) {
        onClose();
        onUnavailable();
        return;
      }
      // 안내는 mutation 토스트가 맡고 시트와 입력값은 그대로 남긴다. 루트 overlay에서는 경계로 보내면 앱 전체가 내려간다
      if (shouldReopenRepeatPicker(error)) {
        reopenRepeatPicker().catch(reportUnexpectedError);
      }
    });
  });

  // 저장 중이거나 저장해 닫히는 중에는 아무 일도 하지 않는다. 시트를 닫으면 저장 결과를 볼 수 없다. 빈 제목은 저장 대신 닫는다
  const handleTitleSubmit = () => {
    if (isSubmitLocked) {
      return;
    }
    if (!isValid) {
      onClose();

      return;
    }
    handleSavePress();
  };

  return (
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
          isSubmitting={isSubmitLocked}
          onPress={() => handleSavePress()}
        />
      </HStack>
    </VStack>
  );
};
