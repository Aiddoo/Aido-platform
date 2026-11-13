import { useEffect, useEffectEvent, useRef } from 'react';

interface UseFocusOnStepBackOptions<Step extends string> {
  step: Step;
  /** 칸이 늘어나기 전 단계. 다음 단계에서 이리로 돌아오면 포커스를 옮긴다 */
  firstStep: Step;
  focus: () => void;
}

/** 같은 렌더러로 이어진 단계는 다시 마운트되지 않아 autoFocus가 다시 돌지 않는다. 뒤로 와도 키보드가 남게 앞 칸에 포커스를 준다 */
export function useFocusOnStepBack<Step extends string>({
  step,
  firstStep,
  focus,
}: UseFocusOnStepBackOptions<Step>) {
  const previousStepRef = useRef(step);
  const focusFirstField = useEffectEvent(focus);

  useEffect(() => {
    const previousStep = previousStepRef.current;
    previousStepRef.current = step;
    if (previousStep !== firstStep && step === firstStep) {
      focusFirstField();
    }
  }, [step, firstStep]);
}
