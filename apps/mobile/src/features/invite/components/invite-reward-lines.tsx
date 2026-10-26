import { useTranslation } from '@src/shared/i18n';
import { Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import type { ComponentProps } from 'react';

import { InviteRewardPolicy } from '../domains/invite-reward.model';
import { InvitedFriendPolicy } from '../domains/invited-friend.model';

/** 내 초대 화면에서 친구와 내가 각각 무엇을 언제 받는지 한 줄씩 나눠 보여 준다 */
export function InviteRewardLines({ className, ...props }: ComponentProps<typeof VStack>) {
  const { t } = useTranslation('invite');
  const lines = [
    t('myInvite.rewardInvitee', { days: InviteRewardPolicy.welcomePremiumDays() }),
    t('myInvite.rewardInviter', {
      activeDays: InvitedFriendPolicy.requiredActiveDays(),
      days: InviteRewardPolicy.inviterPremiumDays(),
    }),
  ];

  return (
    <VStack
      gap={8}
      className={cn('rounded-3xl border border-gray-2 bg-white px-[18px] py-4', className)}
      {...props}
    >
      {lines.map((line) => (
        <Text
          key={line}
          size="b3"
          shade={8}
          lineBreakStrategyIOS="hangul-word"
          textBreakStrategy="highQuality"
        >
          {line}
        </Text>
      ))}
    </VStack>
  );
}
