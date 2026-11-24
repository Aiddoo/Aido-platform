import { useMyPageMenuNavigate } from '@src/features/identity/user/hooks/use-my-page-menu-navigation';
import { useTranslation } from '@src/shared/i18n';
import { CalendarImportDuoIcon, SettingsListGroup } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';

import { useGetActiveTodoImportQueryOptions } from '../queries/todo-import.queries';

/** 설정의 "캘린더 가져오기". 처리 중인 가져오기가 있으면 "가져오는 중"과 그 진행 화면으로, 없으면 새로 시작한다 */
export function TodoImportMenuItem() {
  const { t } = useTranslation('todoImport');
  const { data: activeImport } = useSuspenseQuery(useGetActiveTodoImportQueryOptions());
  const navigate = useMyPageMenuNavigate();

  return (
    <SettingsListGroup.Item
      icon={<SettingsListGroup.Icon Icon={CalendarImportDuoIcon} />}
      label={t('entry.menu')}
      value={
        activeImport == null ? undefined : (
          <SettingsListGroup.Value numberOfLines={1}>
            {t('entry.inProgress')}
          </SettingsListGroup.Value>
        )
      }
      onPress={() =>
        activeImport == null
          ? navigate('/todo-import')
          : navigate({ pathname: '/todo-import/[importId]', params: { importId: activeImport.id } })
      }
    />
  );
}

TodoImportMenuItem.Loading = function Loading() {
  return <SettingsListGroup.Item.Loading />;
};

/** 진행 중인지 묻지 못해도 시작 화면으로는 갈 수 있다. 시작하면 서버가 진행 중인 가져오기를 알려 준다 */
TodoImportMenuItem.Error = function ErrorFallback() {
  const { t } = useTranslation('todoImport');
  const navigate = useMyPageMenuNavigate();

  return (
    <SettingsListGroup.Item
      icon={<SettingsListGroup.Icon Icon={CalendarImportDuoIcon} />}
      label={t('entry.menu')}
      onPress={() => navigate('/todo-import')}
    />
  );
};
