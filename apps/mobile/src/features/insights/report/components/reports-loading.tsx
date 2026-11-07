import { Box, ScallopedContainer, Spacing, StyledSafeAreaView, TextSkeleton } from '@src/shared/ui';
import { noop } from 'es-toolkit';
import { Tabs } from 'heroui-native';
import { ScrollView } from 'react-native';

import { ReportRow } from './report-row';

/** 받은 뒤 화면(머리 이미지·제목·탭·목록)과 같은 배치라 로딩이 끝나도 위 내용이 밀리지 않는다 */
export function ReportsLoading() {
  return (
    <ScrollView className="flex-1 px-4" scrollEnabled={false}>
      <StyledSafeAreaView edges={['left', 'right']}>
        <Spacing size={16} />

        <ScallopedContainer>
          <Box className="items-center px-5 pt-4">
            <Box className="size-[100px]" />
            <Spacing size={8} />
            <TextSkeleton size="t3" className="w-40" />
            <TextSkeleton size="b4" className="w-56" />
          </Box>

          <Spacing size={28} />

          <Box className="px-4">
            <Tabs value="WEEKLY" onValueChange={noop} variant="primary">
              <Tabs.List>
                <Tabs.Indicator />
                <Tabs.Trigger value="WEEKLY">
                  <TextSkeleton size="b4" className="w-10" />
                </Tabs.Trigger>
                <Tabs.Trigger value="MONTHLY">
                  <TextSkeleton size="b4" className="w-10" />
                </Tabs.Trigger>
              </Tabs.List>
            </Tabs>
          </Box>

          <Spacing size={8} />

          <Box className="px-4 pb-4">
            <ReportRow.Loading />
          </Box>
        </ScallopedContainer>
      </StyledSafeAreaView>
    </ScrollView>
  );
}
