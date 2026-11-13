import { useDraftService } from '@src/shared/di/shared-di-context';
import { useCallback, useEffect, useEffectEvent, useState } from 'react';

import type { DraftKey } from './draft.model';

interface UseDraftStorageOptions {
  /** 편집 대상의 서버 수정 시각(epoch ms). 초안보다 새로우면 초안을 버린다. */
  sourceUpdatedAt?: number;
  onOutdatedDiscard?: () => void;
}

/** restoredDraft는 첫 렌더에서 동기로 읽어 깜박임이 없고, 키는 마운트 시점에 고정되므로 대상이 바뀌면 `key`로 다시 마운트한다 */
export function useDraftStorage<TValue>(
  draftKey: DraftKey<TValue>,
  { sourceUpdatedAt, onOutdatedDiscard }: UseDraftStorageOptions = {},
) {
  const draftService = useDraftService();
  const [mountedDraftKey] = useState(draftKey);
  const [saveInSession] = useState(() => draftService.createSessionSave(mountedDraftKey));
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
    (value: TValue) => saveInSession(value, { sourceUpdatedAt }),
    [saveInSession, sourceUpdatedAt],
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
