import { type Dispatch, type SetStateAction, useState } from 'react';

export const useStepper = <T extends readonly string[]>(steps: T) => {
  const [step, setStep] = useState<T[number]>(steps[0] as T[number]);

  return { step, setStep } as {
    step: T[number];
    setStep: Dispatch<SetStateAction<T[number]>>;
  };
};
