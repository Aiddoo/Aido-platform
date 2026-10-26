import { useCallback, useEffect, useRef, useState } from 'react';

const COPIED_FEEDBACK_MS = 1500;

/** 복사 버튼 아이콘을 잠깐 체크로 바꾼다. 다시 누르면 시간을 새로 센다 */
export function useCopiedFeedback() {
  const [isCopied, setIsCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCopied = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
    }

    setIsCopied(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setIsCopied(false);
    }, COPIED_FEEDBACK_MS);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  return [isCopied, showCopied] as const;
}
