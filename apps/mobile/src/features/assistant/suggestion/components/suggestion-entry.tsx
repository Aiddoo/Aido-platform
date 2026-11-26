import { AI_SUGGESTION_LIMITS } from '@aido/api/vocabulary';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { CoachmarkPopover } from '@src/features/device/coachmark/components/coachmark-popover';
import { formatDayCountLabel } from '@src/shared/date/format/date-labels';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  AiFilledIcon,
  Box,
  LabelChip,
  ListRow,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useRouter, useIsFocused } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { type ComponentProps, type ComponentRef, type ReactNode, Suspense, useRef } from 'react';
import type { View } from 'react-native';
import { match } from 'ts-pattern';

import { isSuggestionsPremiumRequiredError } from '../domains/suggestion.error';
import {
  selectCanUseSuggestions,
  SuggestionListSelect,
  useGetSuggestionsQueryOptions,
} from '../queries/suggestion.queries';

interface SuggestionEntryProps {
  /** 먼저 뜰 자동 화면(알림 화면·새로운 기능)이 남았거나 피드가 움직이는 중이면 false라 AI 개편 안내를 미룬다 */
  shouldShowHint?: boolean;
}

export function SuggestionEntry({ shouldShowHint = true }: SuggestionEntryProps) {
  const { t } = useTranslation(['todo', 'ai']);
  const router = useRouter();
  const push = useSingleTap(router.push);
  const dateFormatContext = useDateFormatContext();
  const { data: canUseSuggestions } = useSuspenseQuery({
    ...useGetEntitlementsQueryOptions(),
    select: selectCanUseSuggestions,
  });

  if (!canUseSuggestions) {
    return (
      <AiUpdateCoachmark
        description={t('ai:updateHint.freeDescription')}
        shouldShowHint={shouldShowHint}
      >
        <InfoCard
          label={t('todo:feed.suggestionFree')}
          isPremiumOnly
          onPress={() => push('/suggestions')}
        />
      </AiUpdateCoachmark>
    );
  }

  // 제안만 늦게 오면 "불러오는 중" 대신 제안을 기다린다는 문구를 보인다. 안내는 상태 줄이 그려진 뒤에 연다
  return (
    <Suspense fallback={<InfoCard label={t('todo:feed.suggestionsLoading')} />}>
      <AiUpdateCoachmark
        description={t('ai:updateHint.premiumDescription', {
          period: formatDayCountLabel(AI_SUGGESTION_LIMITS.ANALYSIS_PERIOD_DAYS, dateFormatContext),
        })}
        shouldShowHint={shouldShowHint}
      >
        <SuggestionEntry.Contents />
      </AiUpdateCoachmark>
    </Suspense>
  );
}

type SuggestionEntryContentsProps = Omit<InfoCardProps, 'label' | 'isPremiumOnly'>;

SuggestionEntry.Contents = function Contents({ onPress, ...props }: SuggestionEntryContentsProps) {
  const { t } = useTranslation(['todo', 'ai']);
  const router = useRouter();
  const push = useSingleTap(router.push);
  // 분석 중 polling이 다른 탭·화면에 가려진 동안 돌지 않게 구독을 끊는다
  const isFocused = useIsFocused();
  const { data: entry } = useSuspenseQuery({
    ...useGetSuggestionsQueryOptions(),
    select: SuggestionListSelect.entry,
    subscribed: isFocused,
  });

  const label = match(entry.state)
    .with('HAS_SUGGESTIONS', () =>
      t('ai:suggestions.status.hasSuggestions', { count: entry.count }),
    )
    .with('ANALYZING', () => t('ai:suggestions.status.analyzing'))
    .with('DONE_FOR_TODAY', () => t('ai:suggestions.status.doneForToday'))
    .with('NO_PATTERN_FOUND', () => t('ai:suggestions.status.noPatternFound'))
    .with('UNAVAILABLE_TODAY', () => t('ai:suggestions.status.unavailableToday'))
    .with('NEEDS_MORE_TODOS', () => t('todo:feed.suggestion.needsMoreTodos'))
    .with('NEEDS_AI_CONSENT', () => t('todo:feed.suggestion.needsAiConsent'))
    .with('WAITING_FOR_NEXT_RUN', () => t('ai:suggestions.status.waitingForNextRun'))
    .exhaustive();

  return (
    <InfoCard
      {...props}
      label={label}
      onPress={(event) => {
        push('/suggestions');
        if (typeof onPress === 'function') {
          onPress(event);
        }
      }}
    />
  );
};

SuggestionEntry.Loading = function Loading() {
  const { t } = useTranslation('todo');
  return <InfoCard label={t('feed.loading')} />;
};

SuggestionEntry.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['todo', 'ai']);
  const router = useRouter();
  const push = useSingleTap(router.push);

  // 한도 스냅샷이 늦어 프리미엄으로 보였지만 서버는 거절했다. 다시 시도 대신 결제 화면으로 보낸다
  if (isSuggestionsPremiumRequiredError(error)) {
    return (
      <InfoCard
        label={t('ai:suggestions.toasts.premiumOnly')}
        onPress={() => push({ pathname: '/paywall', params: { feature: 'AI_SUGGESTION' } })}
      />
    );
  }

  return <InfoCard label={t('todo:feed.suggestionsRetry')} onPress={reset} />;
};

interface AiUpdateCoachmarkProps {
  /** 무료와 프리미엄(체험·유예·관리자 포함)은 쓸 수 있는 것이 달라 입구가 고른 문구를 받는다 */
  description: string;
  shouldShowHint: boolean;
  children: ReactNode;
}

/** 1.16.0 AI 제안·리포트 개편을 계정마다 한 번 알린다. 피드 맨 아래라 입구가 다 보일 때만 연다 */
function AiUpdateCoachmark({ description, shouldShowHint, children }: AiUpdateCoachmarkProps) {
  const { t } = useTranslation('ai');
  const targetRef = useRef<ComponentRef<typeof View>>(null);

  return (
    <Box ref={targetRef}>
      <CoachmarkPopover
        kind="ai-feature-update"
        title={t('updateHint.title')}
        description={description}
        Icon={AiFilledIcon}
        placement="top"
        align="center"
        shouldAutoOpen={shouldShowHint}
        onScreenTargetRef={targetRef}
        isPassThrough
      >
        {children}
      </CoachmarkPopover>
    </Box>
  );
}

interface InfoCardProps extends Omit<ComponentProps<typeof PressableFeedback>, 'children'> {
  label: string;
  /** 무료 사용자가 눌러 보기 전에 프리미엄 기능임을 알린다 */
  isPremiumOnly?: boolean;
}

function InfoCard({ label, isPremiumOnly = false, ...props }: InfoCardProps) {
  const { t } = useTranslation('subscription');
  const fontScaledSize = useFontScaledSize();

  return (
    <PressableFeedback className="rounded-xl bg-gray-1 px-4" {...props}>
      <ListRow
        left={
          <AiFilledIcon
            width={fontScaledSize(24)}
            height={fontScaledSize(24)}
            colorClassName="text-main"
          />
        }
        contents={
          <ListRow.Texts
            type="1RowTypeA"
            top={label}
            topProps={{
              size: 'b3',
              weight: 'medium',
              shade: 8,
              lineBreakStrategyIOS: 'hangul-word',
              textBreakStrategy: 'highQuality',
            }}
          />
        }
        right={
          isPremiumOnly && (
            // Chip도 Pressable이라 그대로 두면 칩 자리 탭을 가로채 카드가 눌리지 않는다
            <LabelChip
              color="accent"
              label={t('tier.premium')}
              labelProps={{ weight: 'semibold', numberOfLines: 1 }}
              pointerEvents="none"
            />
          )
        }
      />
    </PressableFeedback>
  );
}
