import { DictationButton } from '@src/features/voice/components/dictation-button';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  BottomSheetInput,
  HintPopoverContent,
  HStack,
  InfoIcon,
  MicIcon,
  RouteKeyboardBottomSheet,
  Text,
  VStack,
} from '@src/shared/ui';
import { Popover, PressableFeedback, Separator, Skeleton } from 'heroui-native';
import { type ComponentProps, type ReactNode, useState } from 'react';
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';

import { subTodoFormSchema, type SubTodoFormValues } from '../schemas/sub-todo-form.schema';

interface SubTodoBottomSheetProps extends Omit<
  ComponentProps<typeof RouteKeyboardBottomSheet>,
  'fallbackHref' | 'loading' | 'children'
> {
  children: (close: () => void) => ReactNode;
}

/** 하위 항목 추가·수정 시트의 route와 경계. 폼과 제출은 각 시트가 갖는다 */
export function SubTodoBottomSheet({ children, ...props }: SubTodoBottomSheetProps) {
  return (
    <RouteKeyboardBottomSheet
      {...props}
      fallbackHref="/feed"
      loading={<SubTodoBottomSheet.Loading />}
    >
      {(sheet) => children(() => sheet.close())}
    </RouteKeyboardBottomSheet>
  );
}

SubTodoBottomSheet.Loading = function Loading() {
  return (
    <VStack gap={12}>
      <Skeleton className="h-12 w-full rounded-xl" />
      <Separator thickness={1} className="bg-gray-2" />
      <Skeleton className="h-9 w-24 self-end rounded-4xl" />
    </VStack>
  );
};

interface SubTodoFormPartProps {
  form: UseFormReturn<SubTodoFormValues>;
}

interface SubTodoTitleInputProps extends SubTodoFormPartProps {
  onSubmitEditing: () => void;
}

const SUB_TODO_TITLE_MAX_LENGTH = subTodoFormSchema.shape.title.out.maxLength ?? undefined;

export function SubTodoTitleInput({ form, onSubmitEditing }: SubTodoTitleInputProps) {
  const { t } = useTranslation('todo');

  return (
    <Controller
      control={form.control}
      name="title"
      render={({ field }) => (
        <BottomSheetInput
          testID="sub-todo-input"
          autoFocus
          placeholder={t('subTodo.placeholder')}
          value={field.value}
          onChange={field.onChange}
          maxLength={SUB_TODO_TITLE_MAX_LENGTH}
          size="medium"
          renderErrorMessage={false}
          returnKeyType="done"
          onSubmitEditing={onSubmitEditing}
        />
      )}
    />
  );
}

export function SubTodoDictation({ form }: SubTodoFormPartProps) {
  const title = useWatch({ control: form.control, name: 'title' });

  return (
    <>
      <SpeechTooltip />
      {/* 입력칸은 최대 길이를 막지만 받아쓴 글은 넘을 수 있어, 넘으면 조용히 전송이 멈추지 않게 자른다.
          적은 글자처럼 고친 칸으로 두고 바로 검사해 다시 받은 값이 덮지 않고 전송·완료 키가 따른다 */}
      <DictationButton
        value={title}
        onChange={(text) =>
          form.setValue('title', text.slice(0, SUB_TODO_TITLE_MAX_LENGTH), {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
      />
    </>
  );
}

function SpeechTooltip() {
  const fontScaledSize = useFontScaledSize();
  const { t } = useTranslation('todo');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <PressableFeedback onPress={() => setIsOpen(true)} className="items-center justify-center">
          <HStack gap={4} align="center">
            <Text size="e2" weight="medium" shade={6}>
              {t('subTodo.voiceInput')}
            </Text>

            <InfoIcon
              width={fontScaledSize(16)}
              height={fontScaledSize(16)}
              colorClassName="text-gray-6"
            />
          </HStack>
        </PressableFeedback>
      </Popover.Trigger>
      <HintPopoverContent
        Icon={MicIcon}
        title={t('subTodo.voiceTitle')}
        description={t('subTodo.voiceHint')}
      />
    </Popover>
  );
}
