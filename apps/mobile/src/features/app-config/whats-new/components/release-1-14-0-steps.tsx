import catHiImage from '@assets/images/ido_cat_hi.webp';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, Image, PawIcon, Spacing, Steps } from '@src/shared/ui';

import { RELEASE_1_14_0 } from '../constants/releases';
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
    initial: { step: 'friendInvite', context: {} },
    onStepChange: flow.trackStepViewed,
  });

  return (
    <>
      <WhatsNewStep.Header isNew={false} onClose={flow.close} />

      <Spacing size={8} />

      <stepper.Render
        friendInvite={() => (
          <WhatsNewStep
            media={<FriendInviteMedia />}
            title={t('v1_14_0.friendInvite.title')}
            description={t('v1_14_0.friendInvite.description')}
            actionLabel={isInviteAvailable ? t('v1_14_0.friendInvite.action') : undefined}
            onAction={() => {
              flow.trackCta({ step: 'friendInvite', feature: 'friend_invite' });
              flow.leaveTo('/friends/invite');
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

/** 찍힌 발자국과 기다리는 발자국, 인사하는 고양이 */
function FriendInviteMedia() {
  return (
    <Box
      flex={1}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="justify-center overflow-hidden rounded-3xl bg-highlight px-[18px]"
    >
      <HStack align="center" gap={10}>
        <Box className="size-11 -rotate-6 items-center justify-center rounded-full bg-main">
          <PawIcon width={22} height={22} colorClassName="text-white dark:text-gray-1" />
        </Box>
        <Box className="h-0.5 w-7 bg-main/50" />
        <Box className="size-11 items-center justify-center rounded-full border-[1.5px] border-dashed border-main bg-main/10">
          <PawIcon width={22} height={22} colorClassName="text-main opacity-40" />
        </Box>
      </HStack>
      <Image
        source={catHiImage}
        accessibilityIgnoresInvertColors
        className="absolute -bottom-6 -right-2.5 size-[140px]"
        contentFit="contain"
      />
    </Box>
  );
}
