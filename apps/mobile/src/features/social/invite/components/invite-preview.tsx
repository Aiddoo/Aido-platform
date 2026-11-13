import { UserAvatar } from '@src/features/identity/user/components/user-avatar';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  ErrorIllustration,
  FriendIllustration,
  H2,
  HStack,
  PawIcon,
  QueryErrorActions,
  type QueryErrorFallbackProps,
  Result,
  SearchIllustration,
  Spacing,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Skeleton } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import { match } from 'ts-pattern';

import type { InviteCode } from '../domains/invite-code.model';
import { toRedeemFailureReason } from '../domains/invite.error';
import { useInviteParams } from '../hooks/use-invite-params';
import { useGetInvitePreviewQueryOptions } from '../queries/invite.queries';

/** 초대 카드 위쪽. 누가 초대했는지를 가장 크게 보여 준다 */
export function InvitePreview() {
  const [{ inviteCode }] = useInviteParams();

  if (inviteCode == null) {
    return <InvitePreview.Empty />;
  }

  return <InvitePreview.Inviter inviteCode={inviteCode} />;
}

InvitePreview.Inviter = function Inviter({ inviteCode }: { inviteCode: InviteCode }) {
  const { t } = useTranslation('invite');
  const { data: preview } = useSuspenseQuery(useGetInvitePreviewQueryOptions({ inviteCode }));
  const inviterName = preview.inviter.name ?? t('card.unnamedInviter');

  return (
    <VStack align="center">
      <Box className="relative">
        <UserAvatar
          alt={t('card.inviterAvatar', { name: inviterName })}
          profileImage={preview.inviter.profileImage}
          className="size-[104px] border-4 border-white bg-main/10"
        />
        <Box
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="absolute -right-0.5 bottom-0.5 size-9 -rotate-6 items-center justify-center rounded-full border-[3px] border-white bg-main"
        >
          <PawIcon width={20} height={20} colorClassName="text-white dark:text-gray-1" />
        </Box>
      </Box>

      <Spacing size={14} />

      <H2 className="text-center">{t('card.title', { name: inviterName })}</H2>

      <Spacing size={8} />

      <Text
        size="b3"
        shade={7}
        align="center"
        lineBreakStrategyIOS="hangul-word"
        textBreakStrategy="highQuality"
      >
        {t('card.subtitle')}
      </Text>
    </VStack>
  );
};

InvitePreview.Loading = function Loading() {
  return (
    <VStack align="center" accessibilityState={{ busy: true }}>
      <Skeleton className="size-[104px] rounded-full" />
      <Spacing size={14} />
      <TextSkeleton size="t1" className="w-56" />
      <TextSkeleton size="t1" className="w-40" />
      <Spacing size={8} />
      <TextSkeleton size="b3" className="w-64" />
    </VStack>
  );
};

/** 코드 형식이 틀렸거나 서버에 없는 코드일 때 */
InvitePreview.Empty = function Empty() {
  const { t } = useTranslation('invite');

  return (
    <InviteResult
      icon={<SearchIllustration />}
      title={t('result.notFound.title')}
      description={t('result.notFound.description')}
      testID="invite-result-not-found"
      button={<EnterCodeButton />}
    />
  );
};

function EnterCodeButton() {
  const { t } = useTranslation('invite');
  const replace = useSingleTap(router.replace);

  return (
    <Result.Button testID="invite-result-enter-code" onPress={() => replace('/invite')}>
      {t('result.enterCode')}
    </Result.Button>
  );
}

InvitePreview.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('invite');
  return match(toRedeemFailureReason(error))
    .with('not_found', () => <InvitePreview.Empty />)
    .with('rotated', () => (
      <InviteResult
        icon={<FriendIllustration />}
        title={t('result.rotated.title')}
        description={t('result.rotated.description')}
        testID="invite-result-rotated"
        button={<EnterCodeButton />}
      />
    ))
    .with('disabled', () => (
      <InviteResult
        icon={<FriendIllustration />}
        title={t('result.disabled.title')}
        description={t('result.disabled.description')}
        testID="invite-result-disabled"
      />
    ))
    .otherwise(() => (
      <InviteResult
        icon={<ErrorIllustration />}
        title={t('result.loadFailed.title')}
        description={t('result.loadFailed.description')}
        button={<QueryErrorActions testID="invite-result-retry" onRetry={reset} />}
      />
    ));
};

interface InviteResultProps extends Pick<ComponentProps<typeof Result>, 'testID'> {
  icon?: ReactNode;
  title: string;
  description: string;
  button?: ReactNode;
}

/** 초대 카드의 빈·실패 상태. 화면 가운데에 둔다 */
function InviteResult({ icon, title, description, button, testID }: InviteResultProps) {
  return (
    <HStack flex={1} justify="center" align="center" className="min-h-[420px]">
      <Result icon={icon} title={title} description={description} button={button} testID={testID} />
    </HStack>
  );
}
