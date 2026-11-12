import { CategoryHeaderPill } from '@src/features/planning/category/components/category-header-pill';
import { LiveTranscript } from '@src/features/voice/components/live-transcript';
import { PlanReview } from '@src/features/voice/components/plan-review';
import { VoiceVisual } from '@src/features/voice/components/voice-visual';
import {
  createVoiceTranscript,
  type VoiceTranscript,
} from '@src/features/voice/domains/voice-transcript.model';
import { formatMediaTime } from '@src/features/voice/utils/media-time.view-model';
import { ANIMATION } from '@src/shared/constants/animation';
import { addDaysToDateKey } from '@src/shared/date/date-key';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, HStack, splitWords, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { Chip } from 'heroui-native';
import { type ReactNode, useState } from 'react';
import Animated, { FadeIn, LinearTransition, ReduceMotion } from 'react-native-reanimated';

import {
  DEMO_CATEGORIES,
  DEMO_EXISTING_TODO,
  DEMO_PLANNED_TODOS,
  DEMO_SCRIPT,
} from '../constants/release-1-15-0.constants';
import { useDemoScript } from '../hooks/use-demo-script';
import { useDemoVoiceLevel } from '../hooks/use-demo-voice-level';
import { type DemoTodo, DemoTodoRow } from './demo-todo-row';
import { WhatsNewStep } from './whats-new-step';

type DemoPlannedTodo = (typeof DEMO_PLANNED_TODOS)[number];
type DemoTodoSource = DemoPlannedTodo | typeof DEMO_EXISTING_TODO;
export type DemoPlannedTodoId = DemoPlannedTodo['id'];
type DemoTodoId = DemoTodoSource['id'];
type DemoCategory = (typeof DEMO_CATEGORIES)[number];

/** 실제 인식처럼 끝 몇 단어는 흐리게 보이다 확정된다 */
const INTERIM_WORD_COUNT = 2;
/** 말이 끝난 뒤 파형이 조용히 가라앉을 때까지 듣는 모습을 이어 가다 그리기를 멈춘다 */
const LISTENING_SETTLE_MS = 1_500;
const ROW_ENTERING = FadeIn.duration(ANIMATION.durationMs.slow).reduceMotion(ReduceMotion.System);
const ROW_LAYOUT = LinearTransition.duration(ANIMATION.durationMs.slow).reduceMotion(
  ReduceMotion.System,
);

interface VoiceTodoCaptureDemoProps {
  onFinish: () => void;
}

export function VoiceTodoCaptureDemo({ onFinish }: VoiceTodoCaptureDemoProps) {
  const { t } = useTranslation(['whatsNew', 'voice']);
  const words = splitWords(t('whatsNew:v1_15_0.demo.transcript'));
  const heardCount = useDemoScript({ frameCount: words.length, frameMs: DEMO_SCRIPT.wordMs });
  const settledCount = useDemoScript({
    frameCount: 1,
    frameMs: 0,
    startDelayMs:
      DEMO_SCRIPT.startDelayMs + words.length * DEMO_SCRIPT.wordMs + LISTENING_SETTLE_MS,
  });
  const isListening = settledCount === 0;
  const level = useDemoVoiceLevel({ isSpeaking: heardCount < words.length });

  return (
    <WhatsNewStep.Stage accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <VStack flex={1} gap={12} className="pb-4">
        <HStack gap={8} align="center" className="self-center">
          <Box className={cn('size-2 rounded-full', isListening ? 'bg-main' : 'bg-gray-4')} />
          <Text size="b4" weight="semibold" shade={7} className="tabular-nums">
            {formatMediaTime(heardCount * DEMO_SCRIPT.spokenMsPerWord)}
          </Text>
        </HStack>
        <Box flex={1}>
          <LiveTranscript
            transcript={toDemoTranscript(words, heardCount)}
            placeholder={t('voice:listening.prompt')}
          />
        </Box>
        <VoiceVisual level={level} isActive={isListening} />
        <Button size="medium" isDisabled={heardCount === 0} onPress={onFinish}>
          {t('voice:listening.done')}
        </Button>
      </VStack>
    </WhatsNewStep.Stage>
  );
}

function toDemoTranscript(words: readonly string[], heardCount: number): VoiceTranscript {
  const finalCount =
    heardCount === words.length ? heardCount : Math.max(0, heardCount - INTERIM_WORD_COUNT);

  return createVoiceTranscript({
    sentences: finalCount > 0 ? [words.slice(0, finalCount).join(' ')] : [],
    interim: words.slice(finalCount, heardCount).join(' '),
  });
}

interface VoiceTodoReviewDemoProps {
  value: readonly DemoPlannedTodoId[];
  onValueChange: (value: DemoPlannedTodoId[]) => void;
  onApply: () => void;
}

export function VoiceTodoReviewDemo({ value, onValueChange, onApply }: VoiceTodoReviewDemoProps) {
  const { t } = useTranslation(['whatsNew', 'voicePlan']);
  const toDemoTodo = useToDemoTodo();
  const shownCount = useDemoScript({
    frameCount: DEMO_PLANNED_TODOS.length,
    frameMs: DEMO_SCRIPT.rowMs,
  });
  const shownTodos = DEMO_PLANNED_TODOS.slice(0, shownCount);
  const selectedCount = value.length;

  return (
    <WhatsNewStep.Stage>
      <VStack flex={1} gap={12} className="pb-4">
        <VStack gap={4}>
          <Text size="t3" weight="bold" lineBreakStrategyIOS="hangul-word">
            {t('voicePlan:plan.title', { count: DEMO_PLANNED_TODOS.length })}
          </Text>
          <PlanReview.Guide />
        </VStack>
        <VStack flex={1} gap={8} className="overflow-hidden">
          {DEMO_CATEGORIES.map((category) => {
            const todos = shownTodos.filter(({ categoryId }) => categoryId === category.id);
            return (
              todos.length > 0 && (
                <DemoCategoryGroup key={category.id} category={category}>
                  {todos.map((todo) => (
                    <Animated.View key={todo.id} entering={ROW_ENTERING}>
                      <DemoTodoRow
                        surface="plan"
                        todo={toDemoTodo(todo)}
                        isSelected={value.includes(todo.id)}
                        onSelectedChange={(isSelected) =>
                          onValueChange(
                            DEMO_PLANNED_TODOS.map(({ id }) => id).filter((id) =>
                              id === todo.id ? isSelected : value.includes(id),
                            ),
                          )
                        }
                      />
                    </Animated.View>
                  ))}
                </DemoCategoryGroup>
              )
            );
          })}
        </VStack>
        <Button size="medium" isDisabled={selectedCount === 0} onPress={onApply}>
          {selectedCount === 0
            ? t('voicePlan:plan.applyNothing')
            : t('voicePlan:plan.apply', { count: selectedCount })}
        </Button>
      </VStack>
    </WhatsNewStep.Stage>
  );
}

interface VoiceTodoListDemoProps {
  addedTodoIds: readonly DemoPlannedTodoId[];
}

export function VoiceTodoListDemo({ addedTodoIds }: VoiceTodoListDemoProps) {
  const { t } = useTranslation('whatsNew');
  const toDemoTodo = useToDemoTodo();
  const addedTodos = DEMO_PLANNED_TODOS.filter(({ id }) => addedTodoIds.includes(id));
  const shownCount = useDemoScript({ frameCount: addedTodos.length, frameMs: DEMO_SCRIPT.rowMs });
  const shownTodos: readonly DemoTodoSource[] = [
    ...addedTodos.slice(0, shownCount),
    DEMO_EXISTING_TODO,
  ];
  const [completedIds, setCompletedIds] = useState<readonly DemoTodoId[]>([DEMO_EXISTING_TODO.id]);

  const toggleCompleted = (id: DemoTodoId, isCompleted: boolean) => {
    setCompletedIds((current) =>
      isCompleted ? [...current, id] : current.filter((completedId) => completedId !== id),
    );
  };

  return (
    <WhatsNewStep.Stage>
      <VStack flex={1} gap={12} className="pb-4">
        {DEMO_CATEGORIES.map((category) => {
          const todos = shownTodos.filter(({ categoryId }) => categoryId === category.id);
          return (
            todos.length > 0 && (
              <DemoCategoryGroup key={category.id} category={category}>
                {todos.map((todo) => {
                  const isJustAdded = todo.id !== DEMO_EXISTING_TODO.id;
                  return (
                    <Animated.View
                      key={todo.id}
                      entering={isJustAdded ? ROW_ENTERING : undefined}
                      layout={ROW_LAYOUT}
                    >
                      <DemoTodoRow
                        surface="list"
                        todo={toDemoTodo(todo)}
                        isSelected={completedIds.includes(todo.id)}
                        onSelectedChange={(isCompleted) => toggleCompleted(todo.id, isCompleted)}
                        className={cn('px-2', isJustAdded && 'bg-main/10')}
                        right={
                          isJustAdded && (
                            <Chip size="sm" variant="secondary" className="bg-white">
                              <Text size="e2" weight="semibold" tone="brand">
                                {t('v1_15_0.list.justAdded')}
                              </Text>
                            </Chip>
                          )
                        }
                      />
                    </Animated.View>
                  );
                })}
              </DemoCategoryGroup>
            )
          );
        })}
      </VStack>
    </WhatsNewStep.Stage>
  );
}

interface DemoCategoryGroupProps {
  category: DemoCategory;
  children: ReactNode;
}

function DemoCategoryGroup({ category, children }: DemoCategoryGroupProps) {
  const { t } = useTranslation('whatsNew');

  return (
    <Animated.View entering={ROW_ENTERING} layout={ROW_LAYOUT}>
      <VStack gap={8}>
        <CategoryHeaderPill
          label={t(`v1_15_0.demo.categories.${category.id}`)}
          color={category.color}
        />
        {children}
      </VStack>
    </Animated.View>
  );
}

/** 고르기와 목록이 같은 할 일을 실제 카드 값으로 보여 준다. 날짜는 오늘을 기준으로 정한다 */
function useToDemoTodo() {
  const { t } = useTranslation('whatsNew');
  const todayKey = useTodayKey();

  return (todo: DemoTodoSource): DemoTodo => ({
    title: t(`v1_15_0.demo.todos.${todo.id}`),
    startDate: addDaysToDateKey(todayKey, todo.daysFromToday),
    endDate: null,
    scheduledTime: todo.scheduledTime,
    repeat: todo.repeat,
    visibility: todo.visibility,
    items: todo.itemIds.map((itemId) => ({ title: t(`v1_15_0.demo.items.${itemId}`) })),
    recurrenceGroupId: todo.repeat == null ? null : todo.id,
  });
}
