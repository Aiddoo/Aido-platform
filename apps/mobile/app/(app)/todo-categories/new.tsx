import { CategoryCreateBottomSheet } from '@src/features/planning/todo/components/category-create-bottom-sheet';
import { SheetRouteScreen } from '@src/shared/ui';

export default function TodoCategoryCreateSheetRoute() {
  return (
    <SheetRouteScreen>
      <CategoryCreateBottomSheet />
    </SheetRouteScreen>
  );
}
