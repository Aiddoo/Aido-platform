import { TODO_LIMITS } from '@aido/api/vocabulary';
import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useFormatPlanValue } from '@src/features/billing/subscription/hooks/use-format-plan-value';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import {
  selectTimeFormat,
  useGetPreferenceQueryOptions,
} from '@src/features/identity/preference/queries/preference.queries';
import { CATEGORY_COLORS } from '@src/features/planning/category/constants/todo-category.constants';
import { CalendarSourceList } from '@src/features/planning/todo-import/components/calendar-source-list';
import { ImportDestinationInput } from '@src/features/planning/todo-import/components/import-destination-input';
import { ImportSourceList } from '@src/features/planning/todo-import/components/import-source-list';
import { TodoImportProgress } from '@src/features/planning/todo-import/components/todo-import-progress';
import {
  type TodoImportCollection,
  TodoImportCollectionPolicy,
} from '@src/features/planning/todo-import/domains/todo-import-collection.model';
import { createTodoImportPlacement } from '@src/features/planning/todo-import/domains/todo-import-placement.model';
import { TodoRow } from '@src/features/planning/todo/components/todo-row';
import { TodoResourceLimitPolicy } from '@src/features/planning/todo/domains/todo-resource-limit.model';
import { isPrivateVisibility } from '@src/features/planning/todo/domains/todo-visibility.model';
import type { Todo } from '@src/features/planning/todo/domains/todo.model';
import { ANIMATION } from '@src/shared/constants/animation';
import { formatTimeOfDay } from '@src/shared/date/format/date-format';
import { toTimeOfDay } from '@src/shared/date/time-of-day';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  Box,
  getTouchTargetInset,
  HStack,
  LabelChip,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  SettingsListGroup,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';
import { type ComponentProps, type ReactNode, useState } from 'react';
import Animated, { FadeIn, LinearTransition, ReduceMotion } from 'react-native-reanimated';

import { DEMO_SCRIPT_MS } from '../constants/release-1-17-0.constants';
import { useDemoScript } from '../hooks/use-demo-script';
import { WhatsNewStep } from './whats-new-step';

/** 이름은 카탈로그 `v1_17_0.demo.calendars`에 있다. 공휴일은 기본 선택에서 빠진다 */
const DEMO_CALENDARS = [
  { id: 'personal', color: CATEGORY_COLORS[6], accountKind: 'cloud', itemCount: 12 },
  { id: 'school', color: CATEGORY_COLORS[9], accountKind: 'cloud', itemCount: 18 },
  { id: 'holidays', color: CATEGORY_COLORS[14], accountKind: 'holidays', itemCount: 9 },
] as const satisfies readonly (Pick<TodoImportCollection, 'color' | 'accountKind' | 'itemCount'> & {
  id: string;
})[];

/** 이름은 카탈로그 `v1_17_0.demo.categories`에 있다. 첫 카테고리가 처음 넣을 곳이고 잠시 뒤 둘째로 바뀐다 */
const DEMO_CATEGORIES = [
  { id: 1, key: 'daily', color: CATEGORY_COLORS[0], activeCount: 48 },
  { id: 2, key: 'study', color: CATEGORY_COLORS[9], activeCount: 12 },
] as const;

/** 제목은 카탈로그 `v1_17_0.demo.todos`에 있다 */
const DEMO_IMPORTED_TODOS = [
  { id: 'lecture', localTime: '09:30' },
  { id: 'groupMeeting', localTime: '15:00' },
  { id: 'clubDinner', localTime: '19:00' },
] as const;

type DemoImportedTodoId = (typeof DEMO_IMPORTED_TODOS)[number]['id'];

/** 목록 줄의 체크 칸(`Checkbox`의 size-5) */
const CHECKBOX_SIZE_PT = 20;
const CHECKBOX_HIT_SLOP = getTouchTargetInset(CHECKBOX_SIZE_PT);

const ROW_ENTERING = FadeIn.duration(ANIMATION.durationMs.slow).reduceMotion(ReduceMotion.System);
const ROW_LAYOUT = LinearTransition.duration(ANIMATION.durationMs.slow).reduceMotion(
  ReduceMotion.System,
);

export function CalendarChoiceDemo() {
  const { t } = useTranslation('whatsNew');
  const collections = useDemoCollections();
  const [pressedSelection, setPressedSelection] = useState<Partial<Record<string, boolean>>>({});

  const defaultSelectedKeys = collections
    .filter((collection) => TodoImportCollectionPolicy.isDefaultSelected(collection))
    .map((collection) => collection.collectionKey);
  const checkedCount = useDemoScript({
    frameCount: defaultSelectedKeys.length,
    frameMs: DEMO_SCRIPT_MS.calendarCheck,
  });
  const checkedKeys = new Set(defaultSelectedKeys.slice(0, checkedCount));

  return (
    <WhatsNewStep.Stage accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SettingsListGroup label={t('v1_17_0.demo.account')}>
        {collections.map((collection, index) => (
          <Box key={collection.collectionKey}>
            {index > 0 && <SettingsListGroup.Separator />}
            <CalendarSourceList.Item
              collection={collection}
              isSelected={
                pressedSelection[collection.collectionKey] ??
                checkedKeys.has(collection.collectionKey)
              }
              onSelectedChange={(isSelected) =>
                setPressedSelection((current) => ({
                  ...current,
                  [collection.collectionKey]: isSelected,
                }))
              }
            />
          </Box>
        ))}
      </SettingsListGroup>
    </WhatsNewStep.Stage>
  );
}

/** 실제 카테고리 단계와 같은 넣을 곳 카드다 */
export function ImportDestinationDemo() {
  const { t } = useTranslation('whatsNew');
  const collections = useDemoCollections().filter((collection) =>
    TodoImportCollectionPolicy.isDefaultSelected(collection),
  );
  const [pressedIndex, setPressedIndex] = useState<number | null>(null);

  const switchedCount = useDemoScript({
    frameCount: 1,
    frameMs: 0,
    startDelayMs: DEMO_SCRIPT_MS.categoryChange,
  });
  const destinationIndex = (pressedIndex ?? switchedCount) % DEMO_CATEGORIES.length;
  const destination = DEMO_CATEGORIES[destinationIndex];
  // 남은 자리는 실제 화면처럼 서버 한도 모양의 값으로 센다
  const placement =
    destination == null
      ? null
      : createTodoImportPlacement(
          { kind: 'EXISTING_CATEGORY', categoryId: destination.id },
          TodoImportCollectionPolicy.calculateItemCount(collections),
          TodoResourceLimitPolicy.calculateRoomLeft({
            maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
            activeCount: destination.activeCount,
          }),
        );

  return (
    <WhatsNewStep.Stage accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <VStack gap={8}>
        <ImportSourceList collections={collections} />
        <Box className="rotate-90 self-center">
          <ArrowRightIcon width={20} height={20} colorClassName="text-gray-5" />
        </Box>
        {destination != null && (
          // 넣을 곳이 바뀌면 카드를 새로 그려 바뀐 이름이 스며들듯 나타난다
          <Animated.View key={destination.id} entering={ROW_ENTERING}>
            <ImportDestinationInput.Card
              appearance={{
                name: t(`v1_17_0.demo.categories.${destination.key}`),
                color: destination.color,
                isNew: false,
              }}
              placement={placement}
              errorMessage={null}
              onPress={() => setPressedIndex(destinationIndex + 1)}
            />
          </Animated.View>
        )}
      </VStack>
    </WhatsNewStep.Stage>
  );
}

/** 가져온 할 일은 기본이 비공개라 자물쇠가 붙는다 */
export function ImportProgressDemo() {
  const { t } = useTranslation(['whatsNew', 'todoImport']);
  const [completedIds, setCompletedIds] = useState<readonly DemoImportedTodoId[]>([]);

  const createdCount = useDemoScript({
    frameCount: DEMO_IMPORTED_TODOS.length,
    frameMs: DEMO_SCRIPT_MS.importRow,
    startDelayMs: DEMO_SCRIPT_MS.importStart,
  });

  const isCreated = createdCount === DEMO_IMPORTED_TODOS.length;
  const createdTodos = DEMO_IMPORTED_TODOS.slice(0, createdCount);

  return (
    <WhatsNewStep.Stage accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <VStack gap={8}>
        <TodoImportProgress.Stage
          status={isCreated ? 'done' : 'active'}
          label={t('todoImport:progress.creating')}
        />
        <TodoImportProgress.Meter ratio={createdCount / DEMO_IMPORTED_TODOS.length} />
      </VStack>
      {createdTodos.map(({ id, localTime }) => (
        <Animated.View key={id} entering={ROW_ENTERING} layout={ROW_LAYOUT}>
          <DemoTodoRow
            todo={{
              title: t(`whatsNew:v1_17_0.demo.todos.${id}`),
              visibility: 'PRIVATE',
              localTime,
            }}
            isSelected={completedIds.includes(id)}
            onSelectedChange={(isSelected) =>
              setCompletedIds((current) =>
                isSelected ? [...current, id] : current.filter((completedId) => completedId !== id),
              )
            }
          />
        </Animated.View>
      ))}
    </WhatsNewStep.Stage>
  );
}

/** 일 수는 서버 요금제 값이다 */
export function CalendarImportPlans() {
  const { t } = useTranslation(['whatsNew', 'subscription']);
  const { data: snapshot } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const formatPlanValue = useFormatPlanValue();

  const { free, premium } = EntitlementPolicy.getPlanFeatureComparison(snapshot, 'CALENDAR_IMPORT');

  return (
    <CalendarImportPlans.Board>
      <CalendarImportPlans.Plan
        chip={
          <LabelChip
            color="success"
            label={t('whatsNew:v1_17_0.plans.free')}
            labelProps={{ weight: 'semibold', numberOfLines: 1 }}
            pointerEvents="none"
          />
        }
        value={formatPlanValue(free)}
      />
      <CalendarImportPlans.Plan
        chip={
          <LabelChip
            color="accent"
            label={t('subscription:tier.premium')}
            labelProps={{ weight: 'semibold', numberOfLines: 1 }}
            pointerEvents="none"
          />
        }
        value={formatPlanValue(premium)}
      />
    </CalendarImportPlans.Board>
  );
}

CalendarImportPlans.Board = function Board({ children }: { children: ReactNode }) {
  const { t } = useTranslation('whatsNew');

  return (
    <VStack flex={1} gap={8} justify="center" className="rounded-3xl bg-highlight p-3">
      <Text size="b4" weight="semibold" shade={7} className="px-1">
        {t('v1_17_0.plans.period')}
      </Text>
      {children}
    </VStack>
  );
};

interface PlanProps {
  chip: ReactNode;
  value: string;
}

CalendarImportPlans.Plan = function Plan({ chip, value }: PlanProps) {
  return (
    <HStack align="center" justify="between" gap={12} className="rounded-2xl bg-white p-4">
      {chip}
      <Text size="t3" weight="bold" className="tabular-nums">
        {value}
      </Text>
    </HStack>
  );
};

CalendarImportPlans.Loading = function Loading() {
  return (
    <CalendarImportPlans.Board>
      <PlanSkeleton />
      <PlanSkeleton />
    </CalendarImportPlans.Board>
  );
};

CalendarImportPlans.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  return (
    <Box flex={1} className="justify-center rounded-3xl bg-highlight p-3">
      <QueryErrorFallback reset={reset} illustrationSize="block" />
    </Box>
  );
};

function PlanSkeleton() {
  return (
    <HStack align="center" justify="between" className="rounded-2xl bg-white p-4">
      <Skeleton className="h-6 w-14 rounded-full" />
      <TextSkeleton size="t3" className="w-16" />
    </HStack>
  );
}

type DemoTodo = Pick<Todo, 'title' | 'visibility' | 'localTime'>;

interface DemoTodoRowProps extends Omit<
  ComponentProps<typeof TodoRow>,
  'left' | 'top' | 'middle' | 'bottom'
> {
  todo: DemoTodo;
  /** 목록처럼 체크가 "끝냄"이라 줄을 긋는다 */
  isSelected: boolean;
  onSelectedChange: (isSelected: boolean) => void;
}

function DemoTodoRow({ todo, isSelected, onSelectedChange, ...rowProps }: DemoTodoRowProps) {
  const dateFormatContext = useDateFormatContext();
  // 예시라 설정을 받기까지 기다리지 않고 기본 표기로 먼저 보인다
  const { data: preference } = useQuery(useGetPreferenceQueryOptions());

  const timeFormat = selectTimeFormat(preference);
  const timeLabel =
    todo.localTime == null
      ? null
      : formatTimeOfDay(toTimeOfDay(todo.localTime), timeFormat, dateFormatContext);

  return (
    <TodoRow
      {...rowProps}
      left={
        <TodoRow.Checkbox
          accessibilityLabel={todo.title}
          hitSlop={CHECKBOX_HIT_SLOP}
          isSelected={isSelected}
          onSelectedChange={onSelectedChange}
        />
      }
      top={
        <TodoRow.TitleLine
          label={
            <TodoRow.Label isCompleted={isSelected} className="flex-1">
              {todo.title}
            </TodoRow.Label>
          }
          isPrivate={isPrivateVisibility(todo.visibility)}
        />
      }
      middle={
        timeLabel == null ? undefined : (
          <TodoRow.ScheduleLine repeat={null} isRepeating={false} timeLabel={timeLabel} />
        )
      }
    />
  );
}

function useDemoCollections(): TodoImportCollection[] {
  const { t } = useTranslation('whatsNew');
  const accountName = t('v1_17_0.demo.account');

  return DEMO_CALENDARS.map(({ id, color, accountKind, itemCount }) => ({
    collectionKey: id,
    title: t(`v1_17_0.demo.calendars.${id}`),
    color,
    accountName,
    accountKind,
    accountProvider: 'icloud',
    itemCount,
  }));
}
