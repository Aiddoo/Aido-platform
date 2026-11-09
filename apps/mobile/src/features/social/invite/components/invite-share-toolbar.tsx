import ShareIcon from '@expo/material-symbols/share.xml';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useTranslation } from '@src/shared/i18n';
import { useMutation, useQueries } from '@tanstack/react-query';
import { Stack } from 'expo-router';

import { useCreateInviteShareContent } from '../hooks/use-create-invite-share-content';
import { useShareInviteMutationOptions } from '../queries/invite.mutations';
import { useGetInviteQueryOptions } from '../queries/invite.queries';

const SHARE_ICON = process.env.EXPO_OS === 'ios' ? 'square.and.arrow.up' : ShareIcon;

/** 툴바 공유 버튼. 요약이 오기 전에는 숨긴다(레일·가로 바로 OS가 옮긴다) */
export function InviteShareToolbar() {
  const { t } = useTranslation('invite');
  const createInviteShareContent = useCreateInviteShareContent();
  const share = useMutation(useShareInviteMutationOptions());
  const [{ data: myInvite }, { data: me }] = useQueries({
    queries: [
      { ...useGetInviteQueryOptions(), throwOnError: false },
      { ...useGetMeQueryOptions(), throwOnError: false },
    ],
  });

  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        icon={SHARE_ICON}
        hidden={myInvite == null || me == null}
        accessibilityLabel={t('share.toolbarLabel')}
        onPress={() => {
          if (myInvite == null || me == null) {
            return;
          }

          share.mutate({
            channel: 'system',
            content: createInviteShareContent(myInvite, me.name),
          });
        }}
      />
    </Stack.Toolbar>
  );
}
