import { debounce, type DebouncedFunction, isEqual } from 'es-toolkit';
import { useCallback, useEffect, useEffectEvent, useRef } from 'react';
import type { FieldValues, UseFormSubscribe } from 'react-hook-form';

export const DRAFT_SAVE_DELAY_MS = 400;

interface FormDraftAutosaveOptions<TValues extends FieldValues> {
  /** 초안이 없을 때의 값(빈 입력 또는 서버 원본). 같아지면 초안을 지운다. */
  initialValues: TValues;
  saveDraft: (values: TValues) => void;
  clearDraft: () => void;
}

/** 언마운트 직전에 대기 중인 저장을 즉시 반영한다 */
export function useFormDraftAutosave<TValues extends FieldValues>(
  subscribe: UseFormSubscribe<TValues>,
  { initialValues, saveDraft, clearDraft }: FormDraftAutosaveOptions<TValues>,
) {
  const pendingSaveRef = useRef<DebouncedFunction<(values: TValues) => void> | null>(null);

  const persistValues = useEffectEvent((values: TValues) => {
    if (isEqual(values, initialValues)) {
      clearDraft();
      return;
    }

    saveDraft(values);
  });

  useEffect(() => {
    const pendingSave = debounce((values: TValues) => persistValues(values), DRAFT_SAVE_DELAY_MS);
    pendingSaveRef.current = pendingSave;
    const unsubscribe = subscribe({
      formState: { values: true },
      callback: ({ values }) => pendingSave(values),
    });

    return () => {
      unsubscribe();
      // es-toolkit flush는 대기 인자만 실행하고 타이머는 남기므로 cancel로 타이머까지 정리한다.
      pendingSave.flush();
      pendingSave.cancel();
      pendingSaveRef.current = null;
    };
  }, [subscribe]);

  return useCallback(() => {
    pendingSaveRef.current?.cancel();
    clearDraft();
  }, [clearDraft]);
}
