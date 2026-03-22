import { useStorage } from '@src/bootstrap/providers/di-provider';
import { useTrack } from '@src/shared/analytics';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useAcceptInviteByTagMutationOptions } from '../queries/use-accept-invite-by-tag-mutation-options';

const PENDING_INVITE_KEY = 'aido_pending_invite';

/**
 * 미처리 초대를 확인하고 처리하는 훅.
 *
 * 미인증 상태에서 초대 딥링크를 받은 경우 SecureStore에 저장해두고,
 * 로그인 후 이 훅이 마운트될 때 자동으로 초대를 수락한다.
 *
 * (app)/_layout.tsx에서 호출 (인증된 유저만 접근 가능한 레이아웃)
 */
export const usePendingInvite = () => {
  const storage = useStorage();
  const { trackEvent } = useTrack();
  const processedRef = useRef(false);

  const acceptInviteMutation = useMutation({
    ...useAcceptInviteByTagMutationOptions(),
    onSuccess: (data, userTag) => {
      trackEvent('invite_pending_resolved', { userTag, autoAccepted: data.autoAccepted });
      router.push('/friends');
    },
  });

  useEffect(() => {
    if (processedRef.current) return;

    const processPendingInvite = async () => {
      const pendingTag = await storage.get<string>(PENDING_INVITE_KEY);
      if (!pendingTag) return;

      processedRef.current = true;

      // 저장된 태그 즉시 삭제 (중복 처리 방지)
      await storage.remove(PENDING_INVITE_KEY);

      acceptInviteMutation.mutate(pendingTag);
    };

    processPendingInvite();
  }, [storage, acceptInviteMutation]);
};
