import { useIdGenerator } from '@src/bootstrap/providers/di-context';
import { isAiDataSharingConsentRequiredError } from '@src/features/identity/consent/domains/consent.error';
import { useAiDataSharingConsentGate } from '@src/features/identity/consent/hooks/use-ai-data-sharing-consent-gate';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { PlanRequestPolicy, type PreparedPlanRequest } from '../domains/plan-request.model';
import type { CapturedPlan } from '../domains/voice-capture.model';
import { useCreateQuickPlanMutationOptions } from '../queries/voice.mutations';
import type { CreateQuickPlanInput } from '../schemas/quick-plan-request.schema';

interface UseQuickPlanRequestOptions {
  /** 한도 안내에서 구독 화면으로 갈 때. 시트는 닫고 떠난다 */
  onSubscribe: () => void;
}

/** 들은 글자로 계획을 요청한다. 같은 글자의 재시도는 같은 키로 보내고, 동의가 막으면 한 번 묻고 이어서 보낸다 */
export function useQuickPlanRequest({ onSubscribe }: UseQuickPlanRequestOptions) {
  const idGenerator = useIdGenerator();
  const aiConsent = useAiDataSharingConsentGate();
  const planMutation = useMutation(useCreateQuickPlanMutationOptions({ onSubscribe }));
  const hasAskedConsentRef = useRef(false);
  const [isConsentRequired, setIsConsentRequired] = useState(false);
  const planRequestRef = useRef<PreparedPlanRequest<CreateQuickPlanInput> | null>(null);
  const planAbortRef = useRef<AbortController | null>(null);

  useEffect(() => () => planAbortRef.current?.abort(), []);

  const send = async (text: string): Promise<CapturedPlan> => {
    const request = PlanRequestPolicy.preparePlanRequest<CreateQuickPlanInput>({
      previous: planRequestRef.current,
      input: { text, source: 'quick-voice' },
      createIdempotencyKey: idGenerator.create,
    });
    planRequestRef.current = request;
    setIsConsentRequired(false);
    const abortController = new AbortController();
    planAbortRef.current = abortController;

    try {
      const { plan, isCharged } = await planMutation.mutateAsync({
        ...request,
        signal: abortController.signal,
      });
      planRequestRef.current = null;
      return { plan, isCharged };
    } catch (error) {
      planRequestRef.current = PlanRequestPolicy.getRequestToRetry(request, error);
      if (isAiDataSharingConsentRequiredError(error) && !hasAskedConsentRef.current) {
        hasAskedConsentRef.current = true;
        if (await aiConsent.requestAgreement()) {
          return send(text);
        }
      }
      // 이번 시도는 끝났다. 앞에서 나중에를 눌렀어도 다시 정리하면 안내를 다시 본다
      hasAskedConsentRef.current = false;
      setIsConsentRequired(isAiDataSharingConsentRequiredError(error));
      throw error;
    }
  };

  return {
    send,
    isConsentRequired,
    rememberConsentAsked: (wasAsked: boolean) => {
      hasAskedConsentRef.current = wasAsked;
    },
    abort: () => planAbortRef.current?.abort(),
    forget: () => {
      planRequestRef.current = null;
    },
  };
}
