import { DictationButton } from '@src/features/voice/components/dictation-button';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  BottomSheetInput,
  HintPopoverContent,
  HStack,
  InfoIcon,
  INQUIRY_SHEET_EXIT,
  KeyboardBottomSheet,
  MicIcon,
  QueryErrorActions,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  Result,
  Text,
  useSheetRoute,
  VStack,
} from '@src/shared/ui';
import { Popover, PressableFeedback, Separator, Skeleton } from 'heroui-native';
import { type ComponentProps, type ReactNode, Suspense, useState } from 'react';
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';

import { subTodoFormSchema, type SubTodoFormValues } from '../schemas/sub-todo-form.schema';

interface SubTodoBottomSheetProps extends Omit<
  ComponentProps<typeof KeyboardBottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
> {
  children: (close: () => void) => ReactNode;
}

/** 하위 항목 추가·수정 시트의 route와 경계. 폼과 제출은 각 시트가 갖는다 */
export function SubTodoBottomSheet({ children, ...props }: SubTodoBottomSheetProps) {
  const sheet = useSheetRoute('/feed');

  return (
    <KeyboardBottomSheet {...props} isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
      <QueryErrorBoundary
        fallback={(fallbackProps) => (
          <SubTodoBottomSheet.Error
            {...fallbackProps}
            onInquiry={() => sheet.close(INQUIRY_SHEET_EXIT)}
          />
        )}
      >
        <Suspense fallback={<SubTodoBottomSheet.Loading />}>
          {children(() => sheet.close())}
        </Suspense>
      </QueryErrorBoundary>
    </KeyboardBottomSheet>
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

SubTodoBottomSheet.Error = function ErrorFallback({
  reset,
  onInquiry,
}: QueryErrorFallbackProps & { onInquiry: () => void }) {
  const { t } = useTranslation('common');

  return (
    <Result
      title={t('errorBoundary.title')}
      button={<QueryErrorActions onRetry={reset} onInquiry={onInquiry} />}
    />
  );
};

interface SubTodoFormPartProps {
  form: UseFormReturn<SubTodoFormValues>;
}

interface SubTodoTitleInputProps extends SubTodoFormPartProps {
  onSubmitEditing: () => void;
}

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
          maxLength={subTodoFormSchema.shape.title.maxLength ?? undefined}
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
      <DictationButton value={title} onChange={(text) => form.setValue('title', text)} />
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
        icon={MicIcon}
        title={t('subTodo.voiceTitle')}
        description={t('subTodo.voiceHint')}
      />
    </Popover>
  );
}
