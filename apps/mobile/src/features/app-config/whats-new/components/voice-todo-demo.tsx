import { CategoryHeaderPill } from '@src/features/planning/category/components/category-header-pill';
import { DEFAULT_CATEGORY_COLOR } from '@src/features/planning/category/constants/todo-category.constants';
import { LiveTranscript } from '@src/features/voice/components/quick-voice/live-transcript';
import {
  VoiceTranscriptPolicy,
  type VoiceTranscript,
} from '@src/features/voice/domains/voice-transcript.model';
import { formatMediaTime } from '@src/features/voice/utils/format-media-time';
import { ANIMATION } from '@src/shared/constants/animation';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, HStack, splitWords, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { Chip } from 'heroui-native';
import { useState } from 'react';
import Animated, { FadeIn, LinearTransition, ReduceMotion } from 'react-native-reanimated';

import {
  DEMO_PLANNED_TODOS,
  DEMO_SCRIPT,
  DEMO_WAVEFORM_LEVELS,
} from '../constants/release-1-15-0.constants';
import { useDemoScript } from '../hooks/use-demo-script';
import { DemoTodoRow } from './demo-todo-row';
import { WhatsNewStep } from './whats-new-step';

const DEMO_EXISTING_TODO = { id: 'water', time: null } as const;

export type DemoPlannedTodoId = (typeof DEMO_PLANNED_TODOS)[number]['id'];
type DemoTodoId = DemoPlannedTodoId | typeof DEMO_EXISTING_TODO.id;

/** 실제 인식처럼 끝 몇 단어는 흐리게 보이다 확정된다 */
const INTERIM_WORD_COUNT = 2;
const ORB_BAR = { count: 6, minHeight: 6, levelHeight: 30 } as const;
const ROW_ENTERING = FadeIn.duration(ANIMATION.duration.slow).reduceMotion(ReduceMotion.System);
const ROW_LAYOUT = LinearTransition.duration(ANIMATION.duration.slow).reduceMotion(
  ReduceMotion.System,
);

interface VoiceTodoCaptureDemoProps {
  onFinish: () => void;
}

export function VoiceTodoCaptureDemo({ onFinish }: VoiceTodoCaptureDemoProps) {
  const { t } = useTranslation(['whatsNew', 'voice']);
  const words = splitWords(t('whatsNew:v1_15_0.demo.transcript'));
  const heardCount = useDemoScript({ frameCount: words.length, frameMs: DEMO_SCRIPT.wordMs });
  const isListening = heardCount < words.length;

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
        <ListeningOrb />
        <Text size="e1" shade={5} align="center" lineBreakStrategyIOS="hangul-word">
          {t('voice:listening.autoFinishHint')}
        </Text>
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

  return VoiceTranscriptPolicy.createVoiceTranscript({
    sentences: finalCount > 0 ? [words.slice(0, finalCount).join(' ')] : [],
    interim: words.slice(finalCount, heardCount).join(' '),
  });
}

/** 실제 화면의 Skia 원 대신 멈춰 있는 원과 막대다. 저사양 기기에서 프레임마다 그리지 않는다 */
function ListeningOrb() {
  const bars = DEMO_WAVEFORM_LEVELS.slice(0, ORB_BAR.count);

  return (
    <HStack gap={6} align="center" justify="center">
      {[...bars].reverse().map((level, index) => (
        <OrbBar key={`left-${index}`} level={level} />
      ))}
      <Box className="size-16 items-center justify-center rounded-full bg-main/15">
        <Box className="size-11 rounded-full bg-main" />
      </Box>
      {bars.map((level, index) => (
        <OrbBar key={`right-${index}`} level={level} />
      ))}
    </HStack>
  );
}

function OrbBar({ level }: { level: number }) {
  return (
    <Box
      className="w-1 rounded-full bg-main/40"
      style={{ height: ORB_BAR.minHeight + level * ORB_BAR.levelHeight }}
    />
  );
}

interface VoiceTodoReviewDemoProps {
  value: readonly DemoPlannedTodoId[];
  onValueChange: (value: DemoPlannedTodoId[]) => void;
  onApply: () => void;
}

export function VoiceTodoReviewDemo({ value, onValueChange, onApply }: VoiceTodoReviewDemoProps) {
  const { t } = useTranslation(['whatsNew', 'voicePlan']);
  const shownCount = useDemoScript({
    frameCount: DEMO_PLANNED_TODOS.length,
    frameMs: DEMO_SCRIPT.rowMs,
  });
  const selectedCount = value.length;

  return (
    <WhatsNewStep.Stage>
      <VStack flex={1} gap={12} className="pb-4">
        <VStack gap={4}>
          <Text size="t3" weight="bold" lineBreakStrategyIOS="hangul-word">
            {t('voicePlan:plan.title', { count: DEMO_PLANNED_TODOS.length })}
          </Text>
          <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
            {t('whatsNew:v1_15_0.review.hint')}
          </Text>
        </VStack>
        <VStack flex={1} gap={8} className="overflow-hidden">
          <CategoryHeaderPill
            label={t('whatsNew:v1_15_0.demo.category')}
            color={DEFAULT_CATEGORY_COLOR}
          />
          {DEMO_PLANNED_TODOS.slice(0, shownCount).map((todo) => (
            <Animated.View key={todo.id} entering={ROW_ENTERING}>
              <DemoTodoRow
                surface="plan"
                title={t(`whatsNew:v1_15_0.demo.todos.${todo.id}`)}
                time={todo.time}
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
  const addedTodos = DEMO_PLANNED_TODOS.filter(({ id }) => addedTodoIds.includes(id));
  const shownCount = useDemoScript({ frameCount: addedTodos.length, frameMs: DEMO_SCRIPT.rowMs });
  const [completedIds, setCompletedIds] = useState<readonly DemoTodoId[]>([DEMO_EXISTING_TODO.id]);

  const toggleCompleted = (id: DemoTodoId, isCompleted: boolean) => {
    setCompletedIds((current) =>
      isCompleted ? [...current, id] : current.filter((completedId) => completedId !== id),
    );
  };

  return (
    <WhatsNewStep.Stage>
      <VStack flex={1} gap={8} className="pb-4">
        <CategoryHeaderPill label={t('v1_15_0.demo.category')} color={DEFAULT_CATEGORY_COLOR} />
        {addedTodos.slice(0, shownCount).map((todo) => (
          <Animated.View key={todo.id} entering={ROW_ENTERING} layout={ROW_LAYOUT}>
            <DemoTodoRow
              surface="list"
              title={t(`v1_15_0.demo.todos.${todo.id}`)}
              time={todo.time}
              isSelected={completedIds.includes(todo.id)}
              onSelectedChange={(isCompleted) => toggleCompleted(todo.id, isCompleted)}
              className="bg-main/10 px-2"
              right={
                <Chip size="sm" variant="secondary" className="bg-white">
                  <Text size="e2" weight="semibold" tone="brand">
                    {t('v1_15_0.list.justAdded')}
                  </Text>
                </Chip>
              }
            />
          </Animated.View>
        ))}
        <Animated.View layout={ROW_LAYOUT}>
          <DemoTodoRow
            surface="list"
            title={t(`v1_15_0.demo.todos.${DEMO_EXISTING_TODO.id}`)}
            time={DEMO_EXISTING_TODO.time}
            isSelected={completedIds.includes(DEMO_EXISTING_TODO.id)}
            onSelectedChange={(isCompleted) => toggleCompleted(DEMO_EXISTING_TODO.id, isCompleted)}
            className="px-2"
          />
        </Animated.View>
      </VStack>
    </WhatsNewStep.Stage>
  );
}
