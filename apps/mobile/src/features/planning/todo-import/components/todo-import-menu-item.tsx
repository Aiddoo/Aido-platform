import {
  useIsMyPageMenuItemSelected,
  useMyPageMenuNavigate,
} from '@src/features/identity/user/hooks/use-my-page-menu-navigation';
import { useTranslation } from '@src/shared/i18n';
import { CalendarImportDuoIcon, SettingsListGroup } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';

import { useGetActiveTodoImportQueryOptions } from '../queries/todo-import.queries';

const TODO_IMPORT_PATHNAME = '/todo-import';

export function TodoImportMenuItem() {
  const { t } = useTranslation('todoImport');
  const { data: activeImport } = useSuspenseQuery(useGetActiveTodoImportQueryOptions());
  const navigate = useMyPageMenuNavigate();
  const isSelected = useIsMyPageMenuItemSelected(TODO_IMPORT_PATHNAME);

  return (
    <SettingsListGroup.Item
      icon={<SettingsListGroup.Icon Icon={CalendarImportDuoIcon} />}
      label={t('entry.menu')}
      isSelected={isSelected}
      value={
        activeImport == null ? undefined : (
          <SettingsListGroup.Value numberOfLines={1}>
            {t('entry.inProgress')}
          </SettingsListGroup.Value>
        )
      }
      onPress={() =>
        activeImport == null
          ? navigate(TODO_IMPORT_PATHNAME)
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
  const isSelected = useIsMyPageMenuItemSelected(TODO_IMPORT_PATHNAME);

  return (
    <SettingsListGroup.Item
      icon={<SettingsListGroup.Icon Icon={CalendarImportDuoIcon} />}
      label={t('entry.menu')}
      isSelected={isSelected}
      onPress={() => navigate(TODO_IMPORT_PATHNAME)}
    />
  );
};
