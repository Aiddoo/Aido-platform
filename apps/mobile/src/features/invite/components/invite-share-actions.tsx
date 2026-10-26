import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import {
  Box,
  Button,
  CheckIcon,
  CopyIcon,
  HStack,
  KakaoIcon,
  ShareIcon,
  Text,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import type { ComponentProps, ReactNode } from 'react';

import { createInviteShareContent, type InviteShareChannel } from '../domains/invite-share.model';
import { useCopiedFeedback } from '../hooks/use-copied-feedback';
import { useGetInviteQueryOptions } from '../queries/get-invite-query-options';
import { useShareInviteMutationOptions } from '../queries/use-share-invite-mutation-options';

/** 카카오톡 / 링크 복사 / 다른 앱 공유 */
export function InviteShareActions(props: ComponentProps<typeof VStack>) {
  const [{ data: myInvite }, { data: me }] = useSuspenseQueries({
    queries: [useGetInviteQueryOptions(), useGetMeQueryOptions()],
  });
  const share = useMutation(useShareInviteMutationOptions());
  const [isCopied, showCopied] = useCopiedFeedback();

  const handleShare = (channel: InviteShareChannel) =>
    share.mutate(
      { channel, content: createInviteShareContent(myInvite, me.name) },
      {
        onSuccess: ({ outcome }) => {
          if (outcome === 'copied') {
            showCopied();
          }
        },
      },
    );

  return (
    <InviteShareButtons
      isDisabled={share.isPending}
      isCopied={isCopied}
      onShare={handleShare}
      {...props}
    />
  );
}

/** 요약을 불러오는 동안 같은 자리에 비활성 버튼을 둔다 */
InviteShareActions.Loading = function Loading() {
  return <InviteShareButtons isDisabled isCopied={false} onShare={noop} />;
};

/** 초대가 꺼져 있으면 버튼 자리만 비활성으로 남긴다. 안내는 링크 카드가 한다 */
InviteShareActions.Unavailable = function Unavailable() {
  return <InviteShareButtons isDisabled isCopied={false} onShare={noop} />;
};

interface InviteShareButtonsProps extends ComponentProps<typeof VStack> {
  isDisabled: boolean;
  isCopied: boolean;
  onShare: (channel: InviteShareChannel) => void;
}

function InviteShareButtons({
  isDisabled,
  isCopied,
  onShare,
  className,
  ...props
}: InviteShareButtonsProps) {
  const { t } = useTranslation('invite');

  return (
    <VStack gap={10} className={className} {...props}>
      <Button
        testID="invite-share-kakao"
        className="h-[54px] bg-kakao"
        isDisabled={isDisabled}
        onPress={() => onShare('kakao')}
      >
        <HStack align="center" gap={8}>
          <KakaoIcon width={20} height={20} />
          <Text size="b2" weight="bold" shade={9} className="dark:text-gray-1">
            {t('share.kakao')}
          </Text>
        </HStack>
      </Button>

      <SecondaryShareActions
        copyLink={
          <InviteSecondaryShareButton
            icon={
              isCopied ? (
                <CheckIcon width={18} height={18} colorClassName="text-main" />
              ) : (
                <CopyIcon width={18} height={18} colorClassName="text-gray-8" />
              )
            }
            testID="invite-share-copy-link"
            label={t('share.copyLink')}
            isDisabled={isDisabled}
            onPress={() => onShare('copy_link')}
          />
        }
        system={
          <InviteSecondaryShareButton
            icon={<ShareIcon width={18} height={18} colorClassName="text-gray-8" />}
            testID="invite-share-system"
            label={t('share.system')}
            isDisabled={isDisabled}
            onPress={() => onShare('system')}
          />
        }
      />
    </VStack>
  );
}

/** 가장 큰 글자 크기에서는 반폭 두 버튼에 라벨이 들어가지 않아 전체 폭으로 세로로 쌓는다 */
function SecondaryShareActions({ copyLink, system }: { copyLink: ReactNode; system: ReactNode }) {
  const { fontScale } = useFontScale();

  if (fontScale === 'xlarge') {
    return (
      <VStack gap={10}>
        {copyLink}
        {system}
      </VStack>
    );
  }

  // Grid의 GridItem은 50% 폭이라 columnGap을 더하면 한 줄을 넘쳐 두 번째 버튼이 다음 줄로 내려간다
  return (
    <HStack gap={10}>
      <Box className="flex-1">{copyLink}</Box>
      <Box className="flex-1">{system}</Box>
    </HStack>
  );
}

interface InviteSecondaryShareButtonProps extends Omit<
  ComponentProps<typeof Button>,
  'children' | 'variant' | 'color'
> {
  icon: ReactNode;
  label: string;
}

function InviteSecondaryShareButton({
  icon,
  label,
  className,
  ...props
}: InviteSecondaryShareButtonProps) {
  return (
    <Button variant="weak" color="dark" className={cn('h-[50px] bg-gray-2', className)} {...props}>
      <HStack align="center" gap={6}>
        {icon}
        <Text size="b3" weight="semibold" shade={9}>
          {label}
        </Text>
      </HStack>
    </Button>
  );
}
