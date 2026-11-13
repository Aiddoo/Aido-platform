import { EditNameForm } from '@src/features/identity/user/components/edit-name-form';
import { useTranslation } from '@src/shared/i18n';
import { Box, QueryErrorBoundary, ReadableContent } from '@src/shared/ui';
import { Stack } from 'expo-router';
import { Suspense } from 'react';

export default function EditNameRoute() {
  const { t } = useTranslation(['user', 'settings']);

  return (
    <>
      <Stack.Screen options={{ title: t('settings:titles.editName') }} />

      <Box className="flex-1 bg-white">
        <ReadableContent flex={1}>
          <QueryErrorBoundary>
            {/* 내 정보는 마이페이지에서 이미 불러와 캐시에서 바로 읽혀 따로 보여 줄 로딩이 없다 */}
            <Suspense fallback={<Box className="flex-1" />}>
              <EditNameForm title={t('editName.header')} />
            </Suspense>
          </QueryErrorBoundary>
        </ReadableContent>
      </Box>
    </>
  );
}
