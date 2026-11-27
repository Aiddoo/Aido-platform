import { useIdGenerator } from '@src/bootstrap/providers/di-context';
import { useMutation } from '@tanstack/react-query';
import { useRef } from 'react';

import { PlanRequestPolicy } from '../domains/plan-request.model';
import {
  PlanReviewDraftPolicy,
  type SelectablePlannedAction,
} from '../domains/plan-review-draft.model';
import { type VoicePlan, VoicePlanPolicy } from '../domains/voice-plan.model';
import { isPlanKeyConflictError, isSourceMemoMissingError } from '../domains/voice.error';
import { useApplyActionPlanMutationOptions } from '../queries/voice.mutations';
import { sortPlanActionsByGroup } from '../utils/plan-action-group.view-model';

interface PlanApplyRequest {
  idempotencyKey: string;
  fingerprint: string;
}

interface PlanApplyRequestStore {
  find: () => PlanApplyRequest | null;
  save: (request: PlanApplyRequest | null) => void;
}

interface UsePlanApplyOptions {
  plan: VoicePlan;
  fallbackCategoryId: number;
  /** 저장 요청의 키를 화면 밖에 남길 곳. 없으면 이 화면이 떠 있는 동안만 기억한다 */
  requestStore?: PlanApplyRequestStore;
  /** 저장이 끝났다. 화면이 내려간 뒤에 응답이 와도 불리므로 저장 표시를 여기서 남긴다 */
  onSaved?: (saved: { todoCount: number }) => void;
  /** 메모가 생기거나 원본 메모가 사라졌다. 메모 목록은 메모를 아는 쪽이 다시 읽는다 */
  onMemoChanged: () => void;
  /** 화면이 떠 있을 때 저장이 끝났다. 초안 정리와 화면 닫기는 화면이 맡는다 */
  onApplied?: () => void;
  onSourceMissing?: () => void;
}

interface PlanApply {
  apply: (actions: readonly SelectablePlannedAction[]) => void;
  isPending: boolean;
  /** 성공하면 키를 잊어 같은 카드를 다시 보내면 또 저장된다. 시트가 내려가거나 화면이 바뀌는 동안 카드가 남아 있으니 그동안 막는다 */
  isApplied: boolean;
}

/** 고른 카드를 저장한다. 같은 카드를 다시 보내도 두 번 저장되지 않게 요청 키를 기억한다 */
export function usePlanApply({
  plan,
  fallbackCategoryId,
  requestStore,
  onSaved,
  onMemoChanged,
  onApplied,
  onSourceMissing,
}: UsePlanApplyOptions): PlanApply {
  const idGenerator = useIdGenerator();
  const applyMutation = useMutation(useApplyActionPlanMutationOptions({ onSaved, onMemoChanged }));
  const memoryRequestRef = useRef<PlanApplyRequest | null>(null);

  // 두 번 보내지 않게 막는 일은 부르는 쪽이 한다: 같은 프레임의 탭은 `useSingleTap`, 응답 대기와 성공 뒤는 버튼의 `isPending || isApplied`
  const apply = (actions: readonly SelectablePlannedAction[]) => {
    const selected = sortPlanActionsByGroup(
      VoicePlanPolicy.getSelectedActions(
        { ...plan, actions: PlanReviewDraftPolicy.getPlannedActions(actions) },
        PlanReviewDraftPolicy.getSelection(actions),
      ),
      fallbackCategoryId,
    );
    const input = { source: plan.source, actions: selected, fallbackCategoryId };
    const previous = requestStore == null ? memoryRequestRef.current : requestStore.find();
    // 같은 카드를 다시 보내면 처음 키를 다시 써 두 번 저장되지 않고, 고쳐서 보내면 새 키를 쓴다
    const prepared = PlanRequestPolicy.preparePlanRequest({
      previous: previous == null ? null : { ...previous, input },
      input,
      createIdempotencyKey: idGenerator.create,
    });
    const rememberRequest = (request: PlanApplyRequest | null) => {
      memoryRequestRef.current = request;
      requestStore?.save(request);
    };
    rememberRequest({
      idempotencyKey: prepared.idempotencyKey,
      fingerprint: prepared.fingerprint,
    });

    applyMutation.mutate(
      {
        source: plan.source,
        sourceMemoId: plan.sourceMemoId,
        actions: selected,
        fallbackCategoryId,
        skippedCount: actions.length - selected.length,
        idempotencyKey: prepared.idempotencyKey,
      },
      {
        onSuccess: () => {
          memoryRequestRef.current = null;
          onApplied?.();
        },
        // 같은 키로 다른 내용을 보낸 경우처럼 키를 바꿔야 하면 다음에 새 키로 보낸다. 고친 카드는 그대로 남는다
        onError: (error) => {
          if (isPlanKeyConflictError(error)) {
            rememberRequest(null);
          }
          if (isSourceMemoMissingError(error)) {
            onSourceMissing?.();
          }
        },
      },
    );
  };

  return { apply, isPending: applyMutation.isPending, isApplied: applyMutation.isSuccess };
}
