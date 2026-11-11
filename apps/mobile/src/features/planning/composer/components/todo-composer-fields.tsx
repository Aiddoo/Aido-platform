import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { TodoTimePushNotice } from '@src/features/notification/components/todo-time-push-notice';
import { usePromptPushPermission } from '@src/features/notification/hooks/use-prompt-push-permission';
import { CategorySelectInput } from '@src/features/planning/category/components/category-select-input';
import { TodoCategoryPolicy } from '@src/features/planning/category/domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { TodoDatePickerContent } from '@src/features/planning/todo/components/todo-date-picker-content';
import { TodoRepeatPickerContent } from '@src/features/planning/todo/components/todo-repeat-picker-content';
import { TodoTimePickerContent } from '@src/features/planning/todo/components/todo-time-picker-content';
import { TodoRepeatPolicy } from '@src/features/planning/todo/domains/todo-repeat.model';
import {
  getShiftedEndDate,
  isPrivateVisibility,
  withVisibilityToggled,
} from '@src/features/planning/todo/domains/todo.model';
import { formatRepeatSummary } from '@src/features/planning/todo/utils/format-repeat-summary';
import { parseInstant } from '@src/features/planning/todo/utils/parse-instant';
import {
  formatDateKeyCompactRange,
  formatHHmmTime,
  formatYearAwareDateKeyLabel,
} from '@src/shared/date/format/date-format';
import { instantFromDate, instantToDate } from '@src/shared/date/native-date';
import { toDateKey } from '@src/shared/date/zoned';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  ActionButton,
  ArrowUpIcon,
  Box,
  CalendarIcon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
  ModalBottomSheet,
  type Overlay,
  QueryErrorBoundary,
  RepeatIcon,
  SheetChipRow,
  useOverlay,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback, Spinner } from 'heroui-native';
import type { ComponentProps } from 'react';
import { Suspense } from 'react';
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';
import { useResolveClassNames } from 'uniwind';

import type { AddTodoFormValues } from '../schemas/add-todo-form.schema';

type ComposerForm = UseFormReturn<AddTodoFormValues>;

interface TodoComposerChipsProps {
  form: ComposerForm;
  isSeriesOccurrence?: boolean;
  canChangeRepeat?: boolean;
}

/** 할 일을 만들고 고치는 시트가 함께 쓰는 칩 줄. 시트가 가진 폼을 받아 읽고 바꾼다 */
export function TodoComposerChips({
  form,
  isSeriesOccurrence = false,
  canChangeRepeat = true,
}: TodoComposerChipsProps) {
  const overlay = useOverlay();

  return (
    <VStack gap={8}>
      <SheetChipRow>
        <DateChip form={form} isSeriesOccurrence={isSeriesOccurrence} />
        <TimeChip form={form} />
        {canChangeRepeat && (
          <RepeatChip form={form} onPress={() => openTodoRepeatPicker(overlay, form)} />
        )}
        <VisibilityChip form={form} />
        {/* 루트 overlay에 그려지므로 칩 조회 실패가 앱 경계까지 올라가지 않게 칩만 숨긴다 */}
        <QueryErrorBoundary fallback={() => null}>
          <Suspense fallback={<ActionButton.Loading />}>
            <CategoryChip form={form} />
          </Suspense>
        </QueryErrorBoundary>
      </SheetChipRow>
      <TimePushNotice form={form} />
    </VStack>
  );
}

function TimePushNotice({ form }: { form: ComposerForm }) {
  const [scheduledTime, isAllDay] = useWatch({
    control: form.control,
    name: ['scheduledTime', 'isAllDay'],
  });

  return <TodoTimePushNotice isTimed={!isAllDay && scheduledTime != null} />;
}

/** 저장이 거절됐을 때 제출 함수에서도 열어야 해 훅이 아니라 함수다 */
export function openTodoRepeatPicker(
  overlay: Overlay,
  form: Pick<UseFormReturn<AddTodoFormValues>, 'getValues' | 'setFocus' | 'setValue'>,
) {
  overlay.open(({ isOpen, close, unmount }) => (
    <ModalBottomSheet
      hasFixedHeader
      isOpen={isOpen}
      onOpenChange={() => close()}
      onCloseStart={() => requestAnimationFrame(() => form.setFocus('title'))}
      onExit={unmount}
    >
      <TodoRepeatPickerContent
        value={{
          startDate: form.getValues('startDate'),
          repeat: form.getValues('repeat'),
        }}
        onChange={({ startDate, repeat }) => {
          form.setValue('startDate', startDate);
          form.setValue('repeat', repeat);
          if (repeat != null) {
            form.setValue('endDate', null);
          }
          close();
        }}
        onCancel={close}
      />
    </ModalBottomSheet>
  ));
}

interface TodoComposerSubmitButtonProps extends Pick<
  ComponentProps<typeof PressableFeedback>,
  'isDisabled' | 'onPress' | 'testID'
> {
  isSubmitting: boolean;
}

export function TodoComposerSubmitButton({
  isDisabled,
  isSubmitting,
  onPress,
  testID,
}: TodoComposerSubmitButtonProps) {
  const { t } = useTranslation('todo');
  const fontScaledSize = useFontScaledSize();
  const { color: spinnerColor } = useResolveClassNames('text-white');

  return (
    <PressableFeedback
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={t('add.save')}
      accessibilityState={{ disabled: isDisabled === true, busy: isSubmitting }}
      isDisabled={isDisabled}
      onPress={onPress}
      style={{ width: fontScaledSize(36), height: fontScaledSize(36) }}
      className={cn(
        'items-center justify-center rounded-4xl',
        isDisabled ? 'bg-gray-3' : 'bg-main',
      )}
    >
      {isSubmitting ? (
        <Spinner size="sm" color={typeof spinnerColor === 'string' ? spinnerColor : undefined} />
      ) : (
        <ArrowUpIcon
          width={fontScaledSize(18)}
          height={fontScaledSize(18)}
          colorClassName="text-white"
        />
      )}
    </PressableFeedback>
  );
}

function DateChip({
  form,
  isSeriesOccurrence,
}: {
  form: ComposerForm;
  isSeriesOccurrence: boolean;
}) {
  const { t } = useTranslation('common');
  const overlay = useOverlay();
  const todayDateKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();
  const { getValues, setFocus, setValue } = form;
  const [startDate, endDate] = useWatch({ control: form.control, name: ['startDate', 'endDate'] });
  const startDateKey = toDateKey(startDate, dateFormatContext.timeZone);
  const endDateKey = endDate == null ? null : toDateKey(endDate, dateFormatContext.timeZone);
  const singleDayLabel =
    startDateKey === todayDateKey
      ? t('dateSections.today')
      : formatYearAwareDateKeyLabel(startDateKey, todayDateKey, dateFormatContext);

  const applyStartDate = (nextStartDate: Date) => {
    const repeat = getValues('repeat');
    // 반복 회차의 날짜 이동은 이 회차에만 적용되므로 규칙은 그대로 둔다
    if (repeat != null && !isSeriesOccurrence) {
      setValue(
        'repeat',
        TodoRepeatPolicy.withRepeatStartDate(
          repeat,
          toDateKey(startDate, dateFormatContext.timeZone),
          toDateKey(nextStartDate, dateFormatContext.timeZone),
        ),
      );
    }
    // 여러 날 할 일은 기간을 유지한 채 옮긴다. 날짜 변경 시트와 같은 규칙이고, 끝 날짜보다 뒤를 골라도 시작이 끝을 넘지 않는다
    const nextEndDate = getShiftedEndDate(
      {
        startDate: toDateKey(startDate, dateFormatContext.timeZone),
        endDate: endDate == null ? null : toDateKey(endDate, dateFormatContext.timeZone),
      },
      toDateKey(nextStartDate, dateFormatContext.timeZone),
    );
    setValue('startDate', instantFromDate(nextStartDate));
    setValue('endDate', parseInstant(nextEndDate));
  };

  const handlePress = () => {
    overlay.open(({ isOpen, close, unmount }) => (
      <ModalBottomSheet
        hasFixedHeader
        isOpen={isOpen}
        onOpenChange={() => close()}
        onCloseStart={() => requestAnimationFrame(() => setFocus('title'))}
        onExit={unmount}
      >
        <TodoDatePickerContent
          value={instantToDate(startDate)}
          onChange={(nextStartDate) => {
            applyStartDate(nextStartDate);
            close();
          }}
          onCancel={close}
        />
      </ModalBottomSheet>
    ));
  };

  return (
    <ActionButton
      icon={<ActionButton.Icon Icon={CalendarIcon} colorClassName="text-main" />}
      label={
        endDateKey == null || endDateKey === startDateKey
          ? singleDayLabel
          : formatDateKeyCompactRange(startDateKey, endDateKey, todayDateKey, dateFormatContext)
      }
      isActive
      onPress={handlePress}
    />
  );
}

function TimeChip({ form }: { form: ComposerForm }) {
  const { t } = useTranslation('todo');
  const overlay = useOverlay();
  const dateFormatContext = useDateFormatContext();
  // 설정을 아직 모르면 칩이 경계로 터지지 않게 24시간 표기로 먼저 보인다
  const { data: preference } = useQuery(useGetPreferenceQueryOptions());
  const { setFocus, setValue } = form;
  const promptPushPermission = usePromptPushPermission();
  const [startDate, scheduledTime, isAllDay] = useWatch({
    control: form.control,
    name: ['startDate', 'scheduledTime', 'isAllDay'],
  });
  const displayedTime = isAllDay ? null : scheduledTime;

  const handlePress = () => {
    overlay.open(({ isOpen, close, unmount }) => (
      <ModalBottomSheet
        hasFixedHeader
        isOpen={isOpen}
        onOpenChange={() => close()}
        onCloseStart={() => requestAnimationFrame(() => setFocus('title'))}
        onExit={unmount}
      >
        <QueryErrorBoundary>
          <Suspense fallback={<TodoTimePickerContent.Loading />}>
            <TodoTimePickerContent
              date={instantToDate(startDate)}
              value={{ scheduledTime, isAllDay }}
              onChange={(nextTime) => {
                setValue('scheduledTime', nextTime.scheduledTime);
                setValue('isAllDay', nextTime.isAllDay);
                close();
                if (!nextTime.isAllDay && nextTime.scheduledTime != null) {
                  promptPushPermission();
                }
              }}
              onCancel={close}
            />
          </Suspense>
        </QueryErrorBoundary>
      </ModalBottomSheet>
    ));
  };

  return (
    <ActionButton
      icon={
        <ActionButton.Icon
          Icon={ClockIcon}
          colorClassName={displayedTime == null ? 'text-gray-5' : 'text-main'}
        />
      }
      label={
        displayedTime == null
          ? t('chip.allDay')
          : formatHHmmTime(
              displayedTime,
              preference?.timeFormat ?? 'TWENTY_FOUR_HOUR',
              dateFormatContext,
            )
      }
      isActive={displayedTime != null}
      onPress={handlePress}
    />
  );
}

function RepeatChip({
  form,
  onPress,
}: Pick<ComponentProps<typeof ActionButton>, 'onPress'> & { form: ComposerForm }) {
  const { t } = useTranslation('todo');
  const dateFormatContext = useDateFormatContext();
  const todayDateKey = useTodayKey();
  const repeat = useWatch({ control: form.control, name: 'repeat' });

  return (
    <ActionButton
      icon={
        <ActionButton.Icon
          Icon={RepeatIcon}
          colorClassName={repeat == null ? 'text-gray-5' : 'text-main'}
        />
      }
      label={
        repeat == null
          ? t('chip.repeat')
          : formatRepeatSummary(repeat, todayDateKey, dateFormatContext)
      }
      isActive={repeat != null}
      onPress={onPress}
    />
  );
}

function VisibilityChip({ form }: { form: ComposerForm }) {
  const { t } = useTranslation('todo');

  return (
    <Controller
      control={form.control}
      name="visibility"
      render={({ field: { value, onChange } }) => {
        const isPrivate = isPrivateVisibility(value);

        return (
          <ActionButton
            icon={
              isPrivate ? (
                <ActionButton.Icon Icon={EyeOffIcon} colorClassName="text-gray-6" />
              ) : (
                <ActionButton.Icon Icon={EyeIcon} colorClassName="text-gray-5" />
              )
            }
            label={isPrivate ? t('chip.private') : t('chip.public')}
            onPress={() => onChange(withVisibilityToggled({ visibility: value }).visibility)}
          />
        );
      }}
    />
  );
}

function CategoryChip({ form }: { form: ComposerForm }) {
  const { t } = useTranslation('todo');
  const overlay = useOverlay();
  const { setFocus } = form;
  const {
    data: { categories },
  } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());

  return (
    <Controller
      control={form.control}
      name="categoryId"
      render={({ field: { value: categoryId, onChange } }) => {
        const category = TodoCategoryPolicy.findCategory(categories, categoryId);

        return (
          <ActionButton
            icon={
              <Box
                className={cn('size-2 rounded-full', category == null && 'bg-gray-5')}
                style={category == null ? undefined : { backgroundColor: category.color }}
              />
            }
            label={category?.name ?? t('chip.category')}
            onPress={() => {
              overlay.open(({ isOpen, close, unmount }) => (
                <ModalBottomSheet
                  isOpen={isOpen}
                  onOpenChange={() => close()}
                  onCloseStart={() => requestAnimationFrame(() => setFocus('title'))}
                  onExit={unmount}
                >
                  <QueryErrorBoundary>
                    <Suspense fallback={<CategorySelectInput.Loading />}>
                      <CategorySelectInput
                        defaultValue={categoryId}
                        onSubmit={(nextCategoryId) => {
                          onChange(nextCategoryId);
                          close();
                        }}
                        submitLabel={t('add.submit')}
                      />
                    </Suspense>
                  </QueryErrorBoundary>
                </ModalBottomSheet>
              ));
            }}
          />
        );
      }}
    />
  );
}
