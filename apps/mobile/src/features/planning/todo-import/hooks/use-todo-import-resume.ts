import { useTodoImportUploadSession } from '@src/bootstrap/providers/di-context';
import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { useTrack } from '@src/shared/analytics';
import { useOnAppForeground } from '@src/shared/hooks/use-on-app-foreground';
import { useTranslation } from '@src/shared/i18n';
import { readStoredValue } from '@src/shared/storage/define-stored-value';
import { useStoredValueStorage } from '@src/shared/storage/use-stored-value';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useEffectEvent } from 'react';

import type { TodoImportResumeTrigger } from '../constants/todo-import.events';
import { todoImportSessionStoredValue } from '../schemas/todo-import-session-storage.schema';

/**
 * 끊긴 캘린더 업로드를 앱을 열 때·앞으로 돌아올 때·다시 연결될 때 이어 간다. 오프라인이면 기다린다.
 * 백그라운드 작업(최소 15분 간격)은 쓰지 않는다. 확정 뒤의 무거운 일은 서버 잡이 한다
 */
export function useTodoImportResume(): void {
  const uploadSession = useTodoImportUploadSession();
  const accountId = useMyAccountId();
  const storage = useStoredValueStorage(todoImportSessionStoredValue);
  const { t } = useTranslation('todoImport');
  const { trackEvent } = useTrack();

  const resumeIfPending = (trigger: TodoImportResumeTrigger) => {
    if (accountId == null || !onlineManager.isOnline()) {
      return;
    }
    if (readStoredValue(storage, todoImportSessionStoredValue, accountId) == null) {
      return;
    }
    trackEvent('todo_import_resume_requested', { trigger });
    // 세션이 실패를 단계와 로그로 남겨 여기서는 기다리지 않는다
    uploadSession.resume({ accountId, untitledTitle: t('untitledEvent') });
  };
  const resumeFromEffect = useEffectEvent(resumeIfPending);

  // 앱 화면 묶음이 내려가면(로그아웃) 돌던 업로드를 멈춘다
  useEffect(() => () => uploadSession.dispose(), [uploadSession]);

  // 계정을 읽은 뒤에 한 번, 그다음은 다시 연결될 때마다 이어 간다
  useEffect(() => {
    resumeFromEffect('mount');
    return onlineManager.subscribe((isOnline) => {
      if (isOnline) {
        resumeFromEffect('online');
      }
    });
  }, [accountId]);

  useOnAppForeground(() => resumeIfPending('foreground'));
}
