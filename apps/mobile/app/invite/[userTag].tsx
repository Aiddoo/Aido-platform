import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useStorage } from '@src/bootstrap/providers/di-provider';
import { useAcceptInviteByTagMutationOptions } from '@src/features/friend/presentations/queries/use-accept-invite-by-tag-mutation-options';
import { useTrack } from '@src/shared/analytics';
import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';

const PENDING_INVITE_KEY = 'aido_pending_invite';

/**
 * 초대 딥링크 라우트 (aido://invite/{userTag})
 *
 * - 인증 상태: mutation 훅으로 즉시 친구 관계 생성 후 피드로 이동
 * - 미인증 상태: SecureStore에 저장 후 로그인 화면으로 이동
 */
export default function InviteScreen() {
  const { userTag } = useLocalSearchParams<{ userTag: string }>();
  const { status } = useAuth();
  const storage = useStorage();
  const { trackEvent } = useTrack();
  const processedRef = useRef(false);

  const acceptInviteMutation = useMutation({
    ...useAcceptInviteByTagMutationOptions(),
    onSettled: () => {
      router.replace('/feed');
    },
  });

  const handleUnauthenticatedInvite = useCallback(
    async (tag: string) => {
      await storage.set<string>(PENDING_INVITE_KEY, tag);
      router.replace('/');
    },
    [storage],
  );

  useEffect(() => {
    if (processedRef.current || !userTag) return;
    if (status === 'loading') return;

    processedRef.current = true;
    trackEvent('invite_deep_link_opened', { userTag });

    if (status === 'authenticated') {
      acceptInviteMutation.mutate(userTag);
    } else {
      handleUnauthenticatedInvite(userTag);
    }
  }, [userTag, status, trackEvent, acceptInviteMutation, handleUnauthenticatedInvite]);

  return <View />;
}
