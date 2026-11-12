import { INVITE_QUALIFICATION } from '@aido/api/vocabulary';
import { ANIMATION } from '@src/shared/constants/animation';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  CrownFilledIcon,
  HStack,
  IconCircle,
  PawIcon,
  PersonFilledIcon,
  SendIcon,
  Spacing,
  StampPress,
  Steps,
  type StyledIcon,
  Text,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { match } from 'ts-pattern';

import { RELEASE_1_14_0 } from '../constants/releases.constants';
import { useDemoScript } from '../hooks/use-demo-script';
import { useWhatsNewFlow } from '../hooks/use-whats-new-flow';
import { useWhatsNewParams } from '../hooks/use-whats-new-params';
import { WhatsNewStep } from './whats-new-step';

type Release1140StepMap = {
  friendInvite: object;
};

interface Release1140StepsProps {
  /** 초대가 꺼져 있으면 소개만 남기고 초대 화면으로 이어 주지 않는다 */
  isInviteAvailable: boolean;
}

export function Release1140Steps({ isInviteAvailable }: Release1140StepsProps) {
  const [{ source }] = useWhatsNewParams();
  const { t } = useTranslation(['whatsNew', 'common']);
  const flow = useWhatsNewFlow({ release: RELEASE_1_14_0, source });
  const stepper = useStepper<Release1140StepMap>({
    id: 'whats-new-1.14.0',
    initial: { step: 'friendInvite', context: {} },
    onStepChange: flow.trackStepViewed,
  });

  return (
    <>
      <WhatsNewStep.Header isNew={false} version={RELEASE_1_14_0.version} onClose={flow.close} />

      <Spacing size={8} />

      <stepper.Render
        friendInvite={() => (
          <WhatsNewStep
            media={<FriendInviteMedia />}
            title={t('v1_14_0.friendInvite.title')}
            description={t('v1_14_0.friendInvite.description', {
              activeDays: INVITE_QUALIFICATION.MIN_ACTIVE_DAYS,
            })}
            actionLabel={isInviteAvailable ? t('v1_14_0.friendInvite.action') : undefined}
            onAction={() => {
              flow.trackCta({ step: 'friendInvite', feature: RELEASE_1_14_0.cta.feature });
              flow.leaveTo(RELEASE_1_14_0.cta.href);
            }}
          />
        )}
      />

      <Spacing size={16} />

      <Steps.Buttons
        index={stepper.index}
        isLast
        backLabel={t('common:actions.back')}
        nextLabel={t('common:actions.done')}
        onBack={stepper.history.back}
        onNext={flow.complete}
      />
    </>
  );
}

/** `stampedAt` 장면부터 찍힌 도장이다. 그 전에는 초대 화면의 발자국 판처럼 기다림(점선)·빈 칸으로 둔다 */
const INVITE_FLOW = {
  invite: { Icon: SendIcon, stampedAt: 0, pending: 'empty', reveal: 'none' },
  join: { Icon: PersonFilledIcon, stampedAt: 0, pending: 'empty', reveal: 'none' },
  pawPrint: { Icon: PawIcon, stampedAt: 1, pending: 'waiting', reveal: 'stamp' },
  reward: { Icon: CrownFilledIcon, stampedAt: 2, pending: 'empty', reveal: 'fade' },
} as const;
type InviteFlowStep = (typeof INVITE_FLOW)[keyof typeof INVITE_FLOW];

/** 발자국이 쿵 찍히는 스프링(400ms)이 가라앉은 뒤 보상이 켜진다 */
const INVITE_FLOW_FRAME_MS = 700;
const STAMP_SIZE = 44;
const STAMP_ICON_SIZE = 20;
const REWARD_ENTERING = FadeIn.duration(ANIMATION.durationMs.slow).reduceMotion(
  ReduceMotion.System,
);

function FriendInviteMedia() {
  const { t } = useTranslation('whatsNew');
  const frame = useDemoScript({ frameCount: 2, frameMs: INVITE_FLOW_FRAME_MS });

  return (
    <Box
      flex={1}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="justify-center overflow-hidden rounded-3xl bg-highlight px-3"
    >
      <HStack align="start" className="rounded-2xl bg-white px-1 py-5">
        <InviteFlowStamp
          step={INVITE_FLOW.invite}
          frame={frame}
          label={t('v1_14_0.demo.steps.invite')}
          lineBefore="none"
          lineAfter={toLineState(frame, INVITE_FLOW.join)}
        />
        <InviteFlowStamp
          step={INVITE_FLOW.join}
          frame={frame}
          label={t('v1_14_0.demo.steps.join')}
          lineBefore={toLineState(frame, INVITE_FLOW.join)}
          lineAfter={toLineState(frame, INVITE_FLOW.pawPrint)}
        />
        <InviteFlowStamp
          step={INVITE_FLOW.pawPrint}
          frame={frame}
          label={t('v1_14_0.demo.steps.pawPrint')}
          lineBefore={toLineState(frame, INVITE_FLOW.pawPrint)}
          lineAfter={toLineState(frame, INVITE_FLOW.reward)}
        />
        <InviteFlowStamp
          step={INVITE_FLOW.reward}
          frame={frame}
          label={t('v1_14_0.demo.steps.reward')}
          lineBefore={toLineState(frame, INVITE_FLOW.reward)}
          lineAfter="none"
        />
      </HStack>
    </Box>
  );
}

type LineState = 'none' | 'filled' | 'empty';

/** 다음 도장이 찍히면 그 앞 줄도 채운다 */
function toLineState(frame: number, nextStep: InviteFlowStep): LineState {
  return frame >= nextStep.stampedAt ? 'filled' : 'empty';
}

interface InviteFlowStampProps {
  step: InviteFlowStep;
  frame: number;
  label: string;
  lineBefore: LineState;
  lineAfter: LineState;
}

function InviteFlowStamp({ step, frame, label, lineBefore, lineAfter }: InviteFlowStampProps) {
  const isStamped = frame >= step.stampedAt;

  return (
    <VStack flex={1} gap={8} align="center">
      <HStack align="center" className="self-stretch">
        <StampLine state={lineBefore} />
        {isStamped ? (
          match(step.reveal)
            .with('stamp', () => (
              <StampPress>
                <InviteFlowStamp.Circle Icon={step.Icon} state="stamped" />
              </StampPress>
            ))
            .with('fade', () => (
              <Animated.View entering={REWARD_ENTERING}>
                <InviteFlowStamp.Circle Icon={step.Icon} state="stamped" className="-rotate-6" />
              </Animated.View>
            ))
            .with('none', () => (
              <InviteFlowStamp.Circle Icon={step.Icon} state="stamped" className="-rotate-6" />
            ))
            .exhaustive()
        ) : (
          <InviteFlowStamp.Circle Icon={step.Icon} state={step.pending} />
        )}
        <StampLine state={lineAfter} />
      </HStack>
      <Text
        size="e1"
        weight="semibold"
        tone={isStamped ? 'brand' : 'neutral'}
        shade={6}
        align="center"
        lineBreakStrategyIOS="hangul-word"
      >
        {label}
      </Text>
    </VStack>
  );
}

/** 초대 화면 발자국 판의 찍힘·기다림·빈 칸과 같은 모양 */
const STAMP_STYLES = {
  stamped: { tone: 'brand', iconClassName: 'text-white dark:text-gray-1' },
  waiting: { tone: 'outline', iconClassName: 'text-main opacity-40' },
  empty: { tone: 'neutral', iconClassName: 'text-gray-4 dark:text-gray-3' },
} as const;

interface CircleProps {
  Icon: StyledIcon;
  state: keyof typeof STAMP_STYLES;
  className?: string;
}

InviteFlowStamp.Circle = function Circle({ Icon, state, className }: CircleProps) {
  const fontScaledSize = useFontScaledSize();
  const stampSize = fontScaledSize(STAMP_SIZE);
  const iconSize = fontScaledSize(STAMP_ICON_SIZE);
  const { tone, iconClassName } = STAMP_STYLES[state];

  return (
    <IconCircle
      tone={tone}
      className={className}
      style={{ width: stampSize, height: stampSize }}
      icon={
        <>
          {state === 'stamped' && (
            <Box className="absolute inset-1 rounded-full border border-dashed border-white/90 dark:border-gray-1/90" />
          )}
          <Icon width={iconSize} height={iconSize} colorClassName={iconClassName} />
        </>
      }
    />
  );
};

function StampLine({ state }: { state: LineState }) {
  return (
    <Box
      className={cn(
        'h-0.5 flex-1 rounded-full',
        state === 'filled' && 'bg-main',
        state === 'empty' && 'bg-gray-3',
      )}
    />
  );
}
