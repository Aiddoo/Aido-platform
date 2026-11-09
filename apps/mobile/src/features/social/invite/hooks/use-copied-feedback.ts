import { debounce } from 'es-toolkit';
import { useCallback, useEffect, useState } from 'react';

const COPIED_FEEDBACK_MS = 1500;

/** 복사 버튼 아이콘을 잠깐 체크로 바꾼다. 다시 누르면 시간을 새로 센다 */
export function useCopiedFeedback() {
  const [isCopied, setIsCopied] = useState(false);
  const [hideCopied] = useState(() => debounce(() => setIsCopied(false), COPIED_FEEDBACK_MS));

  useEffect(() => () => hideCopied.cancel(), [hideCopied]);

  const showCopied = useCallback(() => {
    setIsCopied(true);
    hideCopied();
  }, [hideCopied]);

  return [isCopied, showCopied] as const;
}
