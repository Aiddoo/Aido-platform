import { debounce, isEqual } from 'es-toolkit';
import { useCallback, useEffect, useEffectEvent, useRef } from 'react';
import type { FieldValues, UseFormSubscribe } from 'react-hook-form';

export const DRAFT_SAVE_DELAY_MS = 400;

interface FormDraftAutosaveOptions<TValues extends FieldValues> {
  /** 초안이 없을 때의 값(빈 입력 또는 서버 원본). 같아지면 초안을 지운다. */
  initialValues: TValues;
  setDraft: (values: TValues) => void;
  clearDraft: () => void;
}

/**
 * react-hook-form 값 변경을 초안 저장소에 디바운스해 옮긴다.
 * 언마운트(폴더블 전환 등) 직전에 대기 중인 저장을 즉시 반영한다.
 * 반환하는 함수는 제출 성공·명시적 취소 때 대기 중인 저장까지 취소하고 초안을 지운다.
 */
export function useFormDraftAutosave<TValues extends FieldValues>(
  subscribe: UseFormSubscribe<TValues>,
  { initialValues, setDraft, clearDraft }: FormDraftAutosaveOptions<TValues>,
) {
  const pendingSaveRef = useRef<ReturnType<typeof debounce> | null>(null);

  const persistValues = useEffectEvent((values: TValues) => {
    if (isEqual(values, initialValues)) {
      clearDraft();
      return;
    }

    setDraft(values);
  });

  useEffect(() => {
    const pendingSave = debounce(persistValues, DRAFT_SAVE_DELAY_MS);
    pendingSaveRef.current = pendingSave;
    const unsubscribe = subscribe({
      formState: { values: true },
      callback: ({ values }) => pendingSave(values),
    });

    return () => {
      unsubscribe();
      pendingSave.flush();
      pendingSaveRef.current = null;
    };
  }, [subscribe]);

  return useCallback(() => {
    pendingSaveRef.current?.cancel();
    clearDraft();
  }, [clearDraft]);
}
