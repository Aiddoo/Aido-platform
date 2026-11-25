import { TODO_LIMITS } from '@aido/api/vocabulary';
import { useFormatPlanValue } from '@src/features/billing/subscription/hooks/use-format-plan-value';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { toPlanFeatureComparison } from '@src/features/billing/subscription/utils/plan-benefit.view-model';
import { CalendarSourceList } from '@src/features/planning/todo-import/components/calendar-source-list';
import { ImportDestinationButton } from '@src/features/planning/todo-import/components/import-destination-button';
import { ImportSourceList } from '@src/features/planning/todo-import/components/import-source-list';
import { TodoImportProgress } from '@src/features/planning/todo-import/components/todo-import-progress';
import {
  type ImportCollection,
  TodoImportCollectionPolicy,
} from '@src/features/planning/todo-import/domains/todo-import-collection.model';
import {
  findTargetPlacement,
  placeImportTargets,
} from '@src/features/planning/todo-import/domains/todo-import-target.model';
import { ANIMATION } from '@src/shared/constants/animation';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  Box,
  HStack,
  LabelChip,
  Meter,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  SettingsListGroup,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';
import { type ReactNode, useState } from 'react';
import Animated, { FadeIn, LinearTransition, ReduceMotion } from 'react-native-reanimated';

import {
  DEMO_CALENDARS,
  DEMO_CATEGORIES,
  DEMO_IMPORTED_TODOS,
  DEMO_SCRIPT_MS,
} from '../constants/release-1-17-0.constants';
import { useDemoScript } from '../hooks/use-demo-script';
import { DemoTodoRow } from './demo-todo-row';
import { WhatsNewStep } from './whats-new-step';

type DemoImportedTodoId = (typeof DEMO_IMPORTED_TODOS)[number]['id'];

/** 막대의 접근성 값이 백분율로 읽히는 실제 진행 화면과 같다 */
const METER_MAX = 100;

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
      <CalendarSourceList.Group accountName={t('v1_17_0.demo.account')}>
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
      </CalendarSourceList.Group>
    </WhatsNewStep.Stage>
  );
}

/**
 * 실제 카테고리 단계와 같은 넣을 곳 카드다. 가져올 일정이 아이두 카테고리 한 곳으로 들어가고, 잠시 뒤 넣을 곳이 다른
 * 카테고리로 바뀐다. 넣을 곳을 눌러 직접 바꿔 볼 수도 있다
 */
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
  const target =
    destination == null
      ? null
      : ({ kind: 'EXISTING_CATEGORY', categoryId: destination.id } as const);
  // 남은 자리는 실제 화면처럼 서버 한도 모양의 값으로 센다
  const limits = new Map(
    DEMO_CATEGORIES.map(({ id, activeCount }) => [
      id,
      { maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY, activeCount },
    ]),
  );
  const placement =
    target == null
      ? null
      : findTargetPlacement(
          placeImportTargets(
            collections,
            Object.fromEntries(collections.map(({ collectionKey }) => [collectionKey, target])),
            limits,
          ),
          target,
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
            <ImportDestinationButton.Card
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
        <Meter
          value={Math.round((createdCount / DEMO_IMPORTED_TODOS.length) * METER_MAX)}
          max={METER_MAX}
          size="medium"
        />
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

  const { free, premium } = toPlanFeatureComparison(snapshot, 'CALENDAR_IMPORT');

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

function useDemoCollections(): ImportCollection[] {
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
