import type { DayOfWeek } from '@aido/validators';
import { useTrack } from '@src/shared/analytics';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useSpeechRecognition } from '@src/shared/hooks/useSpeechRecognition';
import {
  ArrowUpIcon,
  BottomSheetInput,
  Box,
  CalendarIcon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
  HStack,
  MicIcon,
  PauseIcon,
  RepeatIcon,
  Text,
  usePremiumDialog,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { fontScaledSize } from '@src/shared/utils/scale';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PressableFeedback, Spinner } from 'heroui-native';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Keyboard, ScrollView } from 'react-native';
import { AiUsagePolicy } from '../../models/todo.model';
import { useGetAiUsageQueryOptions } from '../queries/use-get-ai-usage-query-options';
import { useParseTodoMutationOptions } from '../queries/use-parse-todo-mutation-options';
import type { AddTodoFormInput } from '../schemas/add-todo-form.schema';
import { formatTodoDateLabel } from '../utils/format-todo-date-label';

interface TodoFormContentProps {
  onDatePress: () => void;
  onTimePress: () => void;
  onRepeatPress: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  onClose: () => void;
}

export const TodoFormContent = ({
  onDatePress,
  onTimePress,
  onRepeatPress,
  onSubmit,
  isSubmitting,
  onClose,
}: TodoFormContentProps) => {
  const methods = useFormContext<AddTodoFormInput>();

  const title = methods.watch('title');
  const isSubmitDisabled = !title?.trim() || isSubmitting;

  return (
    <VStack gap={12}>
      <Controller
        control={methods.control}
        name="title"
        render={({ field: { onChange, value } }) => (
          <BottomSheetInput
            autoFocus
            placeholder="무엇을 하고 싶으신가요?"
            value={value}
            onChangeText={onChange}
            maxLength={200}
            size="medium"
            renderErrorMessage={false}
            returnKeyType="done"
            onSubmitEditing={isSubmitDisabled ? onClose : onSubmit}
          />
        )}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2"
      >
        <DateLabelButton onPress={onDatePress} />
        <TimeLabelButton onPress={onTimePress} />
        <RepeatChip onPress={onRepeatPress} />
        <VisibilityChip />
      </ScrollView>

      <Box className="h-px bg-gray-2" />

      <HStack gap={8} align="center" justify="end">
        <AiParseButton onClose={onClose} />
        <PressableFeedback
          isDisabled={isSubmitDisabled}
          onPress={onSubmit}
          style={{ width: fontScaledSize(36), height: fontScaledSize(36) }}
          className={cn(
            'items-center justify-center rounded-4xl',
            isSubmitDisabled ? 'bg-gray-3' : 'bg-main',
          )}
        >
          {isSubmitting ? (
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
    </VStack>
  );
};

const CHIP_ICON_SIZE = fontScaledSize(16, 0.3);

interface AiParseButtonProps {
  onClose: () => void;
}

const AiParseButton = ({ onClose }: AiParseButtonProps) => {
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
          methods.setValue('source', 'ai');
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

  const handlePress = () => {
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

  return (
    <>
      <Text size="e2" weight="medium" tone="brand" onPress={handlePress}>
        AI 기능
      </Text>
      <PressableFeedback
        onPress={handlePress}
        isDisabled={parseMutation.isPending}
        style={{ width: fontScaledSize(36), height: fontScaledSize(36) }}
        className="items-center justify-center rounded-full bg-main/10"
      >
        {isRecognizing ? (
          <PauseIcon
            width={fontScaledSize(20)}
            height={fontScaledSize(20)}
            colorClassName="text-error"
          />
        ) : (
          <MicIcon
            width={fontScaledSize(20)}
            height={fontScaledSize(20)}
            colorClassName="text-main"
          />
        )}
      </PressableFeedback>
    </>
  );
};

const DateLabelButton = ({ onPress }: { onPress: () => void }) => {
  const { control } = useFormContext<AddTodoFormInput>();
  const startDate = useWatch({ control, name: 'startDate' });

  const dateLabel = formatTodoDateLabel({
    startDate,
    scheduledTime: null,
    isAllDay: true,
  });

  return (
    <PressableFeedback
      onPress={onPress}
      className="h-8 flex-row items-center gap-1.5 rounded-full border border-main/30 bg-main/10 px-3"
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
        'h-8 flex-row items-center gap-1.5 rounded-full border px-3',
        hasTime ? 'border-main/30 bg-main/10' : 'border-gray-3',
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

const ALL_DAYS: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_SHORT: Record<DayOfWeek, string> = {
  MON: '월',
  TUE: '화',
  WED: '수',
  THU: '목',
  FRI: '금',
  SAT: '토',
  SUN: '일',
};

const formatRepeatLabel = (days: DayOfWeek[]): string => {
  if (days.length === 7) return '매일';
  const sorted = ALL_DAYS.filter((d) => days.includes(d));
  return `매주 ${sorted.map((d) => DAY_SHORT[d]).join(', ')}`;
};

const RepeatChip = ({ onPress }: { onPress: () => void }) => {
  const { control } = useFormContext<AddTodoFormInput>();
  const [isRecurring, daysOfWeek] = useWatch({
    control,
    name: ['isRecurring', 'daysOfWeek'],
  });

  const isActive = isRecurring && daysOfWeek.length > 0;
  const label = isActive ? formatRepeatLabel(daysOfWeek) : '반복';

  return (
    <PressableFeedback
      onPress={onPress}
      className={cn(
        'h-8 flex-row items-center gap-1.5 rounded-full border px-3',
        isActive ? 'border-main/30 bg-main/10' : 'border-gray-3',
      )}
    >
      <RepeatIcon
        width={CHIP_ICON_SIZE}
        height={CHIP_ICON_SIZE}
        colorClassName={isActive ? 'text-main' : 'text-gray-5'}
      />
      <Text size="e1" weight="medium" {...(isActive ? { tone: 'brand' } : { shade: 6 })}>
        {label}
      </Text>
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
            className="h-8 flex-row items-center gap-1.5 rounded-full border border-gray-3 px-3"
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
