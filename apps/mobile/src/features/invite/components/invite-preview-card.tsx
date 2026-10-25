import { ErrorCode } from '@aido/api/errors';
import { UserAvatar } from '@src/features/user/components/user-avatar';
import { isApiError } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Flex,
  H2,
  PauseIcon,
  PawIcon,
  RefreshIcon,
  type QueryErrorFallbackProps,
  Result,
  SearchIcon,
  Spacing,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Skeleton } from 'heroui-native';
import type { ReactNode } from 'react';
import { match, P } from 'ts-pattern';

import { InvitePreviewPolicy } from '../domains/invite-preview.model';
import type { InviteCode } from '../domains/invite.model';
import { useInviteRouteParams } from '../hooks/use-invite-route-params';
import { useGetInvitePreviewQueryOptions } from '../queries/get-invite-preview-query-options';
import { inviteCodeEntryHref } from '../utils/navigation/invite-href';

/** 초대 카드 위쪽. 누가 초대했는지를 가장 크게 보여 준다 */
export function InvitePreviewCard() {
  const { inviteCode } = useInviteRouteParams();

  if (inviteCode == null) {
    return <InvitePreviewCard.Empty />;
  }

  return <InvitePreviewCard.Contents inviteCode={inviteCode} />;
}

InvitePreviewCard.Contents = function Contents({ inviteCode }: { inviteCode: InviteCode }) {
  const { t } = useTranslation('invite');
  const { data: preview } = useSuspenseQuery(useGetInvitePreviewQueryOptions({ inviteCode }));
  const inviterName = InvitePreviewPolicy.inviterName(preview, t('card.unnamedInviter'));

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

      <Text size="b3" shade={7} align="center">
        {t('card.subtitle')}
      </Text>
    </VStack>
  );
};

InvitePreviewCard.Loading = function Loading() {
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
InvitePreviewCard.Empty = function Empty() {
  const { t } = useTranslation('invite');

  return (
    <InviteResult
      icon={<SearchIcon width={40} height={40} colorClassName="text-main" />}
      title={t('result.notFound.title')}
      description={t('result.notFound.description')}
      button={<EnterCodeButton />}
    />
  );
};

function EnterCodeButton() {
  const { t } = useTranslation('invite');

  return (
    <Result.Button
      testID="invite-result-enter-code"
      onPress={() => router.replace(inviteCodeEntryHref())}
    >
      {t('result.enterCode')}
    </Result.Button>
  );
}

InvitePreviewCard.Error = function ErrorState({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('invite');

  return match(isApiError(error) ? error.code : null)
    .with(ErrorCode.INVITE_2101, () => <InvitePreviewCard.Empty />)
    .with(ErrorCode.INVITE_2102, () => (
      <InviteResult
        icon={<RefreshIcon width={40} height={40} colorClassName="text-main" />}
        title={t('result.rotated.title')}
        description={t('result.rotated.description')}
        button={<EnterCodeButton />}
      />
    ))
    .with(ErrorCode.INVITE_2105, () => (
      <InviteResult
        icon={<PauseIcon width={40} height={40} colorClassName="text-main" />}
        title={t('result.disabled.title')}
        description={t('result.disabled.description')}
      />
    ))
    .with(P.string.or(P.nullish), () => (
      <InviteResult
        title={t('result.loadFailed.title')}
        description={t('result.loadFailed.description')}
        button={
          <Result.Button testID="invite-result-retry" onPress={reset}>
            {t('result.retry')}
          </Result.Button>
        }
      />
    ))
    .exhaustive();
};

interface InviteResultProps {
  icon?: ReactNode;
  title: string;
  description: string;
  button?: ReactNode;
}

/** 초대 카드의 빈·실패 상태. 화면 가운데에 둔다 */
function InviteResult({ icon, title, description, button }: InviteResultProps) {
  return (
    <Flex flex={1} justify="center" align="center" className="min-h-[420px]">
      <Result
        icon={
          icon == null ? undefined : (
            <Box className="size-[88px] items-center justify-center rounded-full bg-main/10">
              {icon}
            </Box>
          )
        }
        title={title}
        description={description}
        button={button}
      />
    </Flex>
  );
}
