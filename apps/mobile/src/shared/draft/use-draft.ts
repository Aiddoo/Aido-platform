import { useDraftService } from '@src/bootstrap/providers/di-context';
import { useCallback, useEffect, useEffectEvent, useState } from 'react';

import type { DraftKey } from './draft.model';

interface UseDraftOptions {
  /** 편집 대상의 서버 수정 시각. 초안보다 새로우면 초안을 버린다. */
  sourceUpdatedAt?: Date;
  onOutdatedDiscard?: () => void;
}

/**
 * 컴포넌트 밖(사용자 범위 로컬 저장소)에 두는 `useState`.
 * 첫 렌더에서 동기적으로 복원하므로 빈 값으로 그린 뒤 채우는 깜박임이 없다.
 * 키는 마운트 시점에 고정된다. 대상이 바뀌면 사용처가 `key={draftKey.id}`로 다시 마운트한다.
 */
export function useDraft<TValue>(
  draftKey: DraftKey<TValue>,
  { sourceUpdatedAt, onOutdatedDiscard }: UseDraftOptions = {},
) {
  const draftService = useDraftService();
  const [mountedDraftKey] = useState(draftKey);
  const [restoreResult] = useState(() =>
    draftService.restore(mountedDraftKey, { sourceUpdatedAt }),
  );
  const [draft, setDraftState] = useState(
    restoreResult.status === 'restored' ? restoreResult.value : undefined,
  );
  const sourceUpdatedAtTime = sourceUpdatedAt?.getTime();

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

  const setDraft = useCallback(
    (value: TValue) => {
      setDraftState(value);
      draftService.save(mountedDraftKey, value, {
        sourceUpdatedAt:
          sourceUpdatedAtTime === undefined ? undefined : new Date(sourceUpdatedAtTime),
      });
    },
    [draftService, mountedDraftKey, sourceUpdatedAtTime],
  );

  const clearDraft = useCallback(() => {
    setDraftState(undefined);
    draftService.remove(mountedDraftKey);
  }, [draftService, mountedDraftKey]);

  return [draft, setDraft, clearDraft] as const;
}
