import {
  useIsMyPageMenuItemSelected,
  useMyPageMenuNavigate,
} from '@src/features/identity/user/hooks/use-my-page-menu-navigation';
import { useTranslation } from '@src/shared/i18n';
import { CalendarImportDuoIcon, SettingsListGroup } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';

import { useGetActiveTodoImportQueryOptions } from '../queries/todo-import.queries';

const TODO_IMPORT_PATHNAME = '/todo-import';

/** 행은 바로 그리고 진행 중인지는 받은 뒤 값만 더한다. 못 받으면 시작 화면으로 가고, 시작하면 서버가 진행 중인 가져오기를 알려 준다 */
export function TodoImportMenuItem() {
  const { t } = useTranslation('todoImport');
  const { data: activeImport } = useQuery(useGetActiveTodoImportQueryOptions());
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
