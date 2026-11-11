import { useIdGenerator, useVoiceNoteDraftRepository } from '@src/bootstrap/providers/di-context';
import { isFreeOfChargeError } from '@src/features/billing/subscription/domains/entitlement.error';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { isAiDataSharingConsentRequiredError } from '@src/features/identity/consent/domains/consent.error';
import { useAiDataSharingConsentGate } from '@src/features/identity/consent/hooks/use-ai-data-sharing-consent-gate';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { PlanRequestPolicy, type PreparedPlanRequest } from '../domains/plan-request.model';
import {
  type VoiceNoteDigestInput,
  VoiceNotePolicy,
  createDigestInput,
} from '../domains/voice-note.model';
import { getVoicePlanFailureCause, type VoicePlanFailureCause } from '../domains/voice.error';
import { useCreateVoiceNoteDigestMutationOptions } from '../queries/voice.mutations';
import { createPlanReviewDraft } from '../utils/plan-review-draft';

export interface VoiceNoteDigestFailure {
  cause: VoicePlanFailureCause;
  /** 서버가 차감하지 않았다고 알렸을 때만 true다. 아니면 차감에 대해 말하지 않는다 */
  isFreeOfCharge: boolean;
}

/** 멱등 키를 초안에 함께 저장해 떠나거나 앱을 다시 켜고 다시 눌러도 한 번만 차감된다 */
export function useVoiceNoteDigest({ accountId, draftId }: { accountId: string; draftId: string }) {
  const drafts = useVoiceNoteDraftRepository();
  const idGenerator = useIdGenerator();
  const gate = useEntitlementGate('VOICE_NOTE', { surface: 'voice_note' });
  const aiConsent = useAiDataSharingConsentGate();
  const mutation = useMutation(useCreateVoiceNoteDigestMutationOptions());
  const [failure, setFailure] = useState<VoiceNoteDigestFailure | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hasAskedConsentRef = useRef(false);

  useEffect(() => () => abortRef.current?.abort(), []);

  const saveRequest = (request: PreparedPlanRequest<VoiceNoteDigestInput> | null) => {
    const note = drafts.find(accountId, draftId);
    if (note != null) {
      drafts.save(
        accountId,
        VoiceNotePolicy.withDigestRequest(
          note,
          request == null ? null : { idempotencyKey: request.idempotencyKey },
        ),
      );
    }
  };

  const requestDigest = async (): Promise<void> => {
    const note = drafts.find(accountId, draftId);
    if (note == null) {
      return;
    }
    // 이미 키가 있으면 앞선 요청의 결과를 다시 받는 것이라 차감이 없다. 한도 판단은 서버에 맡긴다
    if (note.digestRequest == null && gate.promptIfBlocked()) {
      return;
    }

    setFailure(null);
    const input = createDigestInput(note);
    const request: PreparedPlanRequest<VoiceNoteDigestInput> = {
      fingerprint: JSON.stringify(input),
      input,
      idempotencyKey: note.digestRequest?.idempotencyKey ?? idGenerator.create(),
    };
    saveRequest(request);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const result = await mutation.mutateAsync({ ...request, signal: abortController.signal });
      // 기다리는 사이 초안을 지웠거나 로그아웃했으면 늦은 응답으로 되살리지 않는다
      const latest = drafts.find(accountId, draftId);
      if (latest != null) {
        drafts.save(
          accountId,
          VoiceNotePolicy.withDigestResult(latest, result, createPlanReviewDraft(result.plan)),
        );
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }
      saveRequest(PlanRequestPolicy.getRequestToRetry(request, error));
      if (isAiDataSharingConsentRequiredError(error) && !hasAskedConsentRef.current) {
        hasAskedConsentRef.current = true;
        if (await aiConsent.requestAgreement()) {
          return requestDigest();
        }
      }
      const cause = getVoicePlanFailureCause(error);
      setFailure(cause === 'limit' ? null : { cause, isFreeOfCharge: isFreeOfChargeError(error) });
    }
  };

  /** 누를 때마다 동의 안내를 한 번 볼 수 있다. 앞에서 나중에를 눌렀어도 다시 정리로 동의할 수 있어야 한다 */
  const digest = () => {
    hasAskedConsentRef.current = false;
    return requestDigest();
  };

  return { digest, isPending: mutation.isPending, failure };
}
