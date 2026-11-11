import { DigestProgress } from '@src/features/voice/components/note/digest-progress';
import { DigestScanPreview } from '@src/features/voice/components/note/digest-scan-preview';
import { KeyPointList } from '@src/features/voice/components/note/key-point-list';
import { RecognizerWaveform } from '@src/features/voice/components/note/recognizer-waveform';
import { RecordingTimer } from '@src/features/voice/components/note/recording-timer';
import { SentenceCaptionList } from '@src/features/voice/components/note/sentence-caption-list';
import type { VoiceNoteSentence } from '@src/features/voice/domains/voice-note.model';
import {
  type VoiceNoteTab,
  voiceNoteTabSchema,
} from '@src/features/voice/schemas/voice-note-params.schema';
import { formatMediaTime } from '@src/features/voice/utils/format-media-time';
import { ANIMATION } from '@src/shared/constants/animation';
import { SECOND_MS } from '@src/shared/constants/time-units';
import { formatYearAwareDateKeyLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  AiFilledIcon,
  HStack,
  SegmentTabTrigger,
  Text,
  VStack,
  WordWrapText,
} from '@src/shared/ui';
import { Tabs } from 'heroui-native';
import { useState } from 'react';
import Animated, { FadeIn, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { match } from 'ts-pattern';

import { DEMO_SCRIPT } from '../constants/release-1-15-0.constants';
import { useDemoScript } from '../hooks/use-demo-script';
import { useDemoVoiceLevel } from '../hooks/use-demo-voice-level';
import { DemoTodoRow } from './demo-todo-row';
import { WhatsNewStep } from './whats-new-step';

const DEMO_NOTE_SENTENCES = [
  { id: 'goal', startMs: 2 * SECOND_MS, isBookmarked: false },
  { id: 'design', startMs: 9 * SECOND_MS, isBookmarked: false },
  { id: 'qa', startMs: 17 * SECOND_MS, isBookmarked: true },
  { id: 'retro', startMs: 24 * SECOND_MS, isBookmarked: false },
] as const;

const DEMO_NOTE_KEY_POINTS = [
  { id: 'schedule', startMs: 2 * SECOND_MS, isBookmarked: false },
  { id: 'design', startMs: 9 * SECOND_MS, isBookmarked: false },
  { id: 'qa', startMs: 17 * SECOND_MS, isBookmarked: true },
] as const;

const DEMO_NOTE_TODOS = [
  { id: 'design', scheduledTime: '10:00' },
  { id: 'qa', scheduledTime: '14:00' },
] as const;

const DEMO_NOTE_DURATION_MS = 31 * SECOND_MS;

/** 녹음 화면처럼 방금 들은 문장 몇 개만 보이고 앞 문장은 위로 밀려난다 */
const VISIBLE_CAPTION_COUNT = 2;
/** 글자로 바꾸기·핵심 포인트·할 일이 모두 끝난 다음 장면에서 결과로 넘어간다 */
const DIGEST_STEP_COUNT = 3;
/** 실제 정리 화면처럼 앞 문장 몇 개만 스캔하는 모습으로 보여 준다 */
const SCAN_PREVIEW_SENTENCE_COUNT = 2;
const DIGEST_AI_ICON_SIZE = 18;
const CAPTION_ENTERING = FadeIn.duration(ANIMATION.duration.slow).reduceMotion(ReduceMotion.System);
const CAPTION_LAYOUT = LinearTransition.duration(ANIMATION.duration.slow).reduceMotion(
  ReduceMotion.System,
);

type DemoNoteTodoId = (typeof DEMO_NOTE_TODOS)[number]['id'];

function toDemoSentence(
  { startMs, isBookmarked }: (typeof DEMO_NOTE_SENTENCES)[number],
  text: string,
): VoiceNoteSentence {
  return { text, startMs, endMs: startMs, isBookmarked, lowConfidenceWords: [] };
}

export function VoiceNoteRecordDemo() {
  const { t } = useTranslation(['whatsNew', 'voiceNote']);
  const heardCount = useDemoScript({
    frameCount: DEMO_NOTE_SENTENCES.length,
    frameMs: DEMO_SCRIPT.sentenceMs,
  });
  const elapsedMs =
    heardCount === 0 ? 0 : (DEMO_NOTE_SENTENCES[heardCount]?.startMs ?? DEMO_NOTE_DURATION_MS);
  const isRecording = heardCount < DEMO_NOTE_SENTENCES.length;
  const level = useDemoVoiceLevel({ isSpeaking: isRecording });
  const heardSentences = DEMO_NOTE_SENTENCES.slice(0, heardCount);
  const captions = heardSentences.slice(-VISIBLE_CAPTION_COUNT);

  return (
    <WhatsNewStep.Stage accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <VStack flex={1} gap={12} align="center" className="pb-4">
        <RecordingTimer elapsedMs={elapsedMs} limitMs={null} />
        <RecognizerWaveform
          level={level}
          isActive={isRecording}
          bookmarksMs={heardSentences
            .filter(({ isBookmarked }) => isBookmarked)
            .map(({ startMs }) => startMs)}
          className="h-14 self-stretch"
        />
        <VStack gap={8} className="self-stretch">
          {captions.map((sentence) => (
            <Animated.View key={sentence.id} entering={CAPTION_ENTERING} layout={CAPTION_LAYOUT}>
              <SentenceCaptionList.Card
                sentence={toDemoSentence(
                  sentence,
                  t(`whatsNew:v1_15_0.demo.note.sentences.${sentence.id}`),
                )}
                isActive={false}
              />
            </Animated.View>
          ))}
        </VStack>
      </VStack>
    </WhatsNewStep.Stage>
  );
}

export function VoiceNoteResultDemo() {
  const doneCount = useDemoScript({
    frameCount: DIGEST_STEP_COUNT + 1,
    frameMs: DEMO_SCRIPT.digestStepMs,
  });

  return (
    <WhatsNewStep.Stage>
      {doneCount > DIGEST_STEP_COUNT ? (
        <Animated.View entering={CAPTION_ENTERING} style={{ flex: 1 }}>
          <DigestedNote />
        </Animated.View>
      ) : (
        <DigestingNote doneCount={doneCount} />
      )}
    </WhatsNewStep.Stage>
  );
}

function DigestingNote({ doneCount }: { doneCount: number }) {
  const { t } = useTranslation(['whatsNew', 'voiceNote']);
  const fontScaledSize = useFontScaledSize();

  return (
    <VStack flex={1} gap={16}>
      <HStack gap={6} align="center">
        <AiFilledIcon
          width={fontScaledSize(DIGEST_AI_ICON_SIZE)}
          height={fontScaledSize(DIGEST_AI_ICON_SIZE)}
          colorClassName="text-main"
        />
        <Text size="t3" weight="bold" className="shrink">
          {t('voiceNote:digest.title')}
        </Text>
      </HStack>
      <DigestScanPreview
        paragraphs={DEMO_NOTE_SENTENCES.slice(0, SCAN_PREVIEW_SENTENCE_COUNT).map(({ id }) =>
          t(`whatsNew:v1_15_0.demo.note.sentences.${id}`),
        )}
        className="max-h-[50%]"
      />
      <VStack gap={12}>
        <DigestProgress.Step
          label={t('voiceNote:digest.steps.transcript')}
          status={doneCount >= 1 ? 'done' : 'doing'}
        />
        <DigestProgress.Step
          label={t('voiceNote:digest.steps.keyPoints')}
          status={doneCount >= 2 ? 'done' : 'doing'}
        />
        <DigestProgress.Step
          label={t('voiceNote:digest.steps.todos')}
          status={doneCount >= 3 ? 'done' : 'doing'}
        />
      </VStack>
    </VStack>
  );
}

function DigestedNote() {
  const { t } = useTranslation(['whatsNew', 'voiceNote']);
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const [tab, setTab] = useState<VoiceNoteTab>('summary');
  const [selectedTodoIds, setSelectedTodoIds] = useState<readonly DemoNoteTodoId[]>(
    DEMO_NOTE_TODOS.map(({ id }) => id),
  );

  return (
    <VStack flex={1} gap={12}>
      <VStack gap={4}>
        <Text size="t3" weight="bold" lineBreakStrategyIOS="hangul-word">
          {t('whatsNew:v1_15_0.demo.note.title')}
        </Text>
        <Text size="e1" shade={6} className="tabular-nums">
          {t('voiceNote:result.meta', {
            date: formatYearAwareDateKeyLabel(todayKey, todayKey, dateFormatContext),
            duration: formatMediaTime(DEMO_NOTE_DURATION_MS),
          })}
        </Text>
      </VStack>
      <Tabs value={tab} onValueChange={(next) => setTab(voiceNoteTabSchema.parse(next))}>
        <Tabs.List>
          <Tabs.Indicator />
          <SegmentTabTrigger value="summary" size="b4" numberOfLines={1}>
            {t('voiceNote:result.tabs.summary')}
          </SegmentTabTrigger>
          <SegmentTabTrigger value="todos" size="b4" numberOfLines={1}>
            {t('voiceNote:result.tabs.todos', { amount: DEMO_NOTE_TODOS.length })}
          </SegmentTabTrigger>
          <SegmentTabTrigger value="transcript" size="b4" numberOfLines={1}>
            {t('voiceNote:result.tabs.transcript')}
          </SegmentTabTrigger>
        </Tabs.List>
      </Tabs>
      <Animated.View key={tab} entering={CAPTION_ENTERING} style={{ flex: 1 }}>
        {match(tab)
          .with('summary', () => (
            <VStack gap={12}>
              <WordWrapText size="b3">{t('whatsNew:v1_15_0.demo.note.summary')}</WordWrapText>
              <VStack gap={4}>
                <Text size="b4" weight="semibold" shade={6}>
                  {t('voiceNote:keyPoints.title')}
                </Text>
                <KeyPointList
                  keyPoints={DEMO_NOTE_KEY_POINTS.map((keyPoint) => ({
                    ...keyPoint,
                    text: t(`whatsNew:v1_15_0.demo.note.keyPoints.${keyPoint.id}`),
                  }))}
                />
              </VStack>
            </VStack>
          ))
          .with('todos', () => (
            <VStack gap={8}>
              {DEMO_NOTE_TODOS.map((todo) => (
                <DemoTodoRow
                  key={todo.id}
                  surface="plan"
                  todo={{
                    title: t(`whatsNew:v1_15_0.demo.note.todos.${todo.id}`),
                    startDate: todayKey,
                    endDate: null,
                    scheduledTime: todo.scheduledTime,
                    repeat: null,
                    visibility: null,
                    items: [],
                    recurrenceGroupId: null,
                  }}
                  isSelected={selectedTodoIds.includes(todo.id)}
                  onSelectedChange={(isSelected) =>
                    setSelectedTodoIds((current) =>
                      isSelected ? [...current, todo.id] : current.filter((id) => id !== todo.id),
                    )
                  }
                />
              ))}
            </VStack>
          ))
          .with('transcript', () => (
            <VStack gap={8}>
              {DEMO_NOTE_SENTENCES.map((sentence) => (
                <SentenceCaptionList.Card
                  key={sentence.id}
                  sentence={toDemoSentence(
                    sentence,
                    t(`whatsNew:v1_15_0.demo.note.sentences.${sentence.id}`),
                  )}
                  isActive={false}
                />
              ))}
            </VStack>
          ))
          .exhaustive()}
      </Animated.View>
    </VStack>
  );
}
