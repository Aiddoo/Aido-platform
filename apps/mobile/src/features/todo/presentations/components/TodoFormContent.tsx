import { useTrack } from '@src/shared/analytics';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useSpeechRecognition } from '@src/shared/hooks/useSpeechRecognition';
import {
  ArrowUpIcon,
  BottomSheetInput,
  CalendarIcon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
  HStack,
  MicIcon,
  PauseIcon,
  Text,
  usePremiumDialog,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { fontScaledSize } from '@src/shared/utils/scale';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PressableFeedback, Spinner } from 'heroui-native';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Keyboard } from 'react-native';
import { AiUsagePolicy } from '../../models/todo.model';
import { useGetAiUsageQueryOptions } from '../queries/use-get-ai-usage-query-options';
import { useParseTodoMutationOptions } from '../queries/use-parse-todo-mutation-options';
import type { AddTodoFormInput } from '../schemas/add-todo-form.schema';
import { formatTodoDateLabel } from '../utils/format-todo-date-label';

interface TodoFormContentProps {
  onDatePress: () => void;
  onTimePress: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  onClose: () => void;
}

export const TodoFormContent = ({
  onDatePress,
  onTimePress,
  onSubmit,
  isSubmitting,
  onClose,
}: TodoFormContentProps) => {
  const methods = useFormContext<AddTodoFormInput>();
  const { trackEvent } = useTrack();
  const toast = useAppToast();
  const premiumDialog = usePremiumDialog();

  const { data: aiUsage } = useQuery(useGetAiUsageQueryOptions());
  const isAiLimitReached = aiUsage != null && AiUsagePolicy.isLimitReached(aiUsage);

  const parseMutation = useMutation(useParseTodoMutationOptions());

  const handleRecognitionEnd = () => {
    const currentTitle = methods.getValues('title');
    const currentCategoryId = methods.getValues('categoryId');
    if (!currentTitle?.trim()) return;

    parseMutation.mutate(
      { text: currentTitle.trim(), categoryId: currentCategoryId },
      {
        onSuccess: (result) => {
          const { data } = result;
          methods.reset(
            (prev) => ({
              ...prev,
              title: data.title,
              startDate: data.startDate,
              endDate: data.endDate,
              scheduledTime: data.scheduledTime,
              isAllDay: data.scheduledTime ? false : data.isAllDay,
              isRecurring: data.isRecurring,
              daysOfWeek: data.recurrence?.daysOfWeek ?? [],
              repeatEndDate: data.recurrence?.endDate ?? null,
            }),
            { keepDirtyValues: true },
          );
        },
      },
    );
  };

  const { isRecognizing, start, stop } = useSpeechRecognition({
    onResult: (text) => {
      methods.setValue('title', text);
    },
    onEnd: handleRecognitionEnd,
    onError: toast.error,
  });

  const handleMicPress = () => {
    if (isRecognizing) {
      stop();
      return;
    }

    if (isAiLimitReached) {
      trackEvent('premium_gate_shown', { feature: 'ai_parse' });
      premiumDialog.open({
        description: '프리미엄 구독으로 매일 무제한 AI 파싱을 사용할 수 있어요',
        onConfirm: onClose,
      });
      return;
    }

    Keyboard.dismiss();
    start();
  };

  const title = methods.watch('title');
  const isSubmitDisabled = !title?.trim() || isSubmitting || parseMutation.isPending;

  return (
    <VStack>
      <Controller
        control={methods.control}
        name="title"
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <BottomSheetInput
            autoFocus
            placeholder={isRecognizing ? '듣고 있어요...' : '무엇을 하고 싶으신가요?'}
            value={value}
            onChangeText={onChange}
            maxLength={200}
            size="medium"
            isInvalid={!!error}
            errorMessage={error?.message}
            returnKeyType="done"
            onSubmitEditing={onSubmit}
          />
        )}
      />

      <HStack gap={4} align="center" className="w-full flex-wrap gap-y-4">
        <DateLabelButton onPress={onDatePress} />
        <TimeLabelButton onPress={onTimePress} />
        <VisibilityChip />

        <HStack gap={8} align="center" className="ml-auto h-8">
          <MicButton
            isRecognizing={isRecognizing}
            onPress={handleMicPress}
            isDisabled={parseMutation.isPending}
            size={fontScaledSize(32)}
            iconSize={fontScaledSize(20)}
          />
          <PressableFeedback
            isDisabled={isSubmitDisabled}
            onPress={onSubmit}
            style={{ width: fontScaledSize(32), height: fontScaledSize(32) }}
            className={cn(
              'items-center justify-center rounded-4xl',
              isSubmitDisabled ? 'bg-gray-3' : 'bg-main',
            )}
          >
            {parseMutation.isPending ? (
              <Spinner size="sm" color="white" />
            ) : (
              <ArrowUpIcon
                width={fontScaledSize(18)}
                height={fontScaledSize(18)}
                colorClassName="text-white"
              />
            )}
          </PressableFeedback>
        </HStack>
      </HStack>
    </VStack>
  );
};

const CHIP_ICON_SIZE = fontScaledSize(16, 0.3);

const DateLabelButton = ({ onPress }: { onPress: () => void }) => {
  const { control } = useFormContext<AddTodoFormInput>();

  const [startDate, isRecurring, repeatEndDate] = useWatch({
    control,
    name: ['startDate', 'isRecurring', 'repeatEndDate'],
  });

  const dateLabel = formatTodoDateLabel({
    startDate,
    scheduledTime: null,
    isAllDay: true,
    isRecurring,
    repeatEndDate,
  });

  return (
    <PressableFeedback
      onPress={onPress}
      className="h-8 flex-row items-center gap-1.5 rounded-full bg-main/10 px-3"
    >
      <CalendarIcon width={CHIP_ICON_SIZE} height={CHIP_ICON_SIZE} colorClassName="text-main" />
      <Text size="e1" tone="brand" weight="medium">
        {dateLabel}
      </Text>
    </PressableFeedback>
  );
};

const TimeLabelButton = ({ onPress }: { onPress: () => void }) => {
  const { control } = useFormContext<AddTodoFormInput>();

  const [scheduledTime, isAllDay] = useWatch({
    control,
    name: ['scheduledTime', 'isAllDay'],
  });

  const hasTime = !isAllDay && !!scheduledTime;
  const timeLabel = isAllDay ? '종일' : (scheduledTime ?? '종일');

  return (
    <PressableFeedback
      onPress={onPress}
      className={cn(
        'h-8 flex-row items-center gap-1.5 rounded-full px-3',
        hasTime ? 'bg-main/10' : 'bg-gray-2',
      )}
    >
      <ClockIcon
        width={CHIP_ICON_SIZE}
        height={CHIP_ICON_SIZE}
        colorClassName={hasTime ? 'text-main' : 'text-gray-5'}
      />
      <Text size="e1" weight="medium" {...(hasTime ? { tone: 'brand' } : { shade: 6 })}>
        {timeLabel}
      </Text>
    </PressableFeedback>
  );
};

interface MicButtonProps {
  isRecognizing: boolean;
  onPress: () => void;
  isDisabled?: boolean;
  size: number;
  iconSize: number;
}

const MicButton = ({
  isRecognizing,
  onPress,
  isDisabled = false,
  size,
  iconSize,
}: MicButtonProps) => {
  return (
    <PressableFeedback
      onPress={onPress}
      isDisabled={isDisabled}
      style={{ width: size, height: size }}
      className="items-center justify-center"
    >
      {isRecognizing ? (
        <PauseIcon width={iconSize} height={iconSize} colorClassName="text-error" />
      ) : (
        <MicIcon width={iconSize} height={iconSize} colorClassName="text-main" />
      )}
    </PressableFeedback>
  );
};

const VisibilityChip = () => {
  const { control } = useFormContext<AddTodoFormInput>();

  return (
    <Controller
      control={control}
      name="visibility"
      render={({ field: { value, onChange } }) => {
        const isPrivate = (value ?? 'PUBLIC') === 'PRIVATE';

        return (
          <PressableFeedback
            onPress={() => onChange(isPrivate ? 'PUBLIC' : 'PRIVATE')}
            className="h-8 flex-row items-center gap-1.5 rounded-full bg-gray-2 px-3"
          >
            {isPrivate ? (
              <EyeOffIcon
                width={CHIP_ICON_SIZE}
                height={CHIP_ICON_SIZE}
                colorClassName="text-gray-6"
              />
            ) : (
              <EyeIcon
                width={CHIP_ICON_SIZE}
                height={CHIP_ICON_SIZE}
                colorClassName="text-gray-5"
              />
            )}
            <Text size="e1" weight="medium" shade={6}>
              {isPrivate ? '비공개' : '공개'}
            </Text>
          </PressableFeedback>
        );
      }}
    />
  );
};
