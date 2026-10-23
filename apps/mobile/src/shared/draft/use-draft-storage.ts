import { useDraftService } from '@src/bootstrap/providers/di-context';
import { useCallback, useEffect, useEffectEvent, useState } from 'react';

import type { DraftKey } from './draft.model';

interface UseDraftStorageOptions {
  /** 편집 대상의 서버 수정 시각(epoch ms). 초안보다 새로우면 초안을 버린다. */
  sourceUpdatedAt?: number;
  onOutdatedDiscard?: () => void;
}

/**
 * 컴포넌트 밖(사용자 범위 로컬 저장소)에 둔 초안을 읽고 쓴다.
 * 폼 값의 원천은 react-hook-form이므로 React 상태를 두지 않는다. 저장해도 다시 렌더하지 않는다.
 * `restoredDraft`는 첫 렌더에서 동기적으로 한 번 읽은 값이라 빈 값으로 그린 뒤 채우는 깜박임이 없다.
 * 키는 마운트 시점에 고정된다. 대상이 바뀌면 사용처가 `key`로 다시 마운트한다.
 */
export function useDraftStorage<TValue>(
  draftKey: DraftKey<TValue>,
  { sourceUpdatedAt, onOutdatedDiscard }: UseDraftStorageOptions = {},
) {
  const draftService = useDraftService();
  const [mountedDraftKey] = useState(draftKey);
  const [restoreResult] = useState(() =>
    draftService.restore(mountedDraftKey, { sourceUpdatedAt }),
  );

  const discardRestoredDraft = useEffectEvent(() => {
    draftService.remove(mountedDraftKey);
    if (restoreResult.status === 'discarded' && restoreResult.reason === 'outdated') {
      onOutdatedDiscard?.();
    }
  });

  useEffect(() => {
    if (restoreResult.status === 'discarded') {
      discardRestoredDraft();
    }
  }, [restoreResult]);

  const saveDraft = useCallback(
    (value: TValue) => draftService.save(mountedDraftKey, value, { sourceUpdatedAt }),
    [draftService, mountedDraftKey, sourceUpdatedAt],
  );

  const clearDraft = useCallback(
    () => draftService.remove(mountedDraftKey),
    [draftService, mountedDraftKey],
  );

  return {
    restoredDraft: restoreResult.status === 'restored' ? restoreResult.value : undefined,
    saveDraft,
    clearDraft,
  };
}
