import { useTranslation } from '@src/shared/i18n';
import { match, P } from 'ts-pattern';

import {
  type ImportCollection,
  TodoImportCollectionPolicy,
} from '../domains/todo-import-collection.model';
import { findAccountEmail } from '../utils/todo-import.view-model';

/**
 * 캘린더가 어디서 왔는지 캘린더 단계의 묶음 이름과 같게 보인다. 계정 캘린더는 계정 이름이고,
 * 공휴일·생일·구독 캘린더는 계정과 상관없이 따로 모은 묶음 이름이다
 */
export function useFormatCalendarSource() {
  const { t } = useTranslation('todoImport');

  return (collection: ImportCollection) => {
    if (TodoImportCollectionPolicy.isSubscribedCalendar(collection)) {
      return t('calendars.accounts.received');
    }
    const email = findAccountEmail(collection);
    return match(collection.accountProvider)
      .with('icloud', () => t('calendars.accounts.icloud'))
      .with('google', () =>
        email == null
          ? t('calendars.accounts.google')
          : t('calendars.accounts.googleWithEmail', { email }),
      )
      .with('outlook', () =>
        email == null
          ? t('calendars.accounts.outlook')
          : t('calendars.accounts.outlookWithEmail', { email }),
      )
      .with('device', () => t('calendars.accounts.device'))
      .with(P.union('subscribed', 'birthdays'), () => t('calendars.otherAccount'))
      .with('other', () => collection.accountName ?? t('calendars.otherAccount'))
      .exhaustive();
  };
}
