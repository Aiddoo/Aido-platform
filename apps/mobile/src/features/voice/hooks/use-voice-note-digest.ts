import { useVoiceNoteStorageService } from '@src/bootstrap/providers/di-context';
import { isAiDataSharingConsentRequiredError } from '@src/features/ai/domains/ai.error';
import { useAiDataSharingConsentGate } from '@src/features/ai/hooks/use-ai-data-sharing-consent-gate';
import { isNotChargedError } from '@src/features/subscription/apis/entitlement.mapper';
import { useEntitlementGate } from '@src/features/subscription/hooks/use-entitlement-gate';
import { useMutation } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';

import { PlanRequestPolicy, type PreparedPlanRequest } from '../domains/plan-request.model';
import {
  createDigestInput,
  type VoiceNoteDigestInput,
  withDigestRequest,
  withDigestResult,
} from '../domains/voice-note.model';
import { getVoicePlanFailureCause, type VoicePlanFailureCause } from '../domains/voice.error';
import { useCreateVoiceNoteDigestMutationOptions } from '../queries/use-create-voice-note-digest-mutation-options';

export interface VoiceNoteDigestFailure {
  cause: VoicePlanFailureCause;
  /** 서버가 차감하지 않았다고 알렸을 때만 true다. 아니면 차감에 대해 말하지 않는다 */
  isNotCharged: boolean;
}

/**
 * 글자를 요약·핵심 포인트·계획으로 정리해 초안에 담는다. 멱등 키를 초안에 함께 저장해 화면을 떠나거나
 * 앱을 다시 켜고 다시 눌러도 한 번만 차감된다. 실패해도 글자는 그대로다.
 */
export function useVoiceNoteDigest({ accountId, draftId }: { accountId: string; draftId: string }) {
  const { drafts } = useVoiceNoteStorageService();
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
        withDigestRequest(
          note,
          request == null
            ? null
            : { idempotencyKey: request.idempotencyKey, hasExpired: request.hasExpired === true },
        ),
      );
    }
  };

  const digest = async (): Promise<void> => {
    const note = drafts.find(accountId, draftId);
    if (note == null) {
      return;
    }
    // 이미 키가 있으면 앞선 요청의 결과를 다시 받는 것이라 차감이 없다. 한도 판단은 서버에 맡긴다
    if (note.digestRequest == null && !gate.guard()) {
      return;
    }

    setFailure(null);
    const input = createDigestInput(note);
    const request = PlanRequestPolicy.prepare<VoiceNoteDigestInput>({
      previous:
        note.digestRequest == null
          ? null
          : { fingerprint: JSON.stringify(input), input, ...note.digestRequest },
      input,
      createIdempotencyKey: randomUUID,
    });
    saveRequest(request);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const result = await mutation.mutateAsync({ ...request, signal: abortController.signal });
      drafts.save(accountId, withDigestResult(drafts.find(accountId, draftId) ?? note, result));
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }
      saveRequest(PlanRequestPolicy.getAfterFailure(request, error));
      if (isAiDataSharingConsentRequiredError(error) && !hasAskedConsentRef.current) {
        hasAskedConsentRef.current = true;
        if (await aiConsent.requestAgreement()) {
          return digest();
        }
      }
      const cause = getVoicePlanFailureCause(error);
      // 한도는 안내 창이 맡는다
      setFailure(cause === 'limit' ? null : { cause, isNotCharged: isNotChargedError(error) });
    }
  };

  return { digest, isPending: mutation.isPending, failure };
}
