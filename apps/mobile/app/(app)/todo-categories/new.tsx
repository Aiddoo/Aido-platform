import { CategoryCreateBottomSheet } from '@src/features/todo/components/category-create-bottom-sheet';
import { SheetRouteScreen } from '@src/shared/ui';

export default function TodoCategoryCreateSheetRoute() {
  return (
    <SheetRouteScreen>
      <CategoryCreateBottomSheet />
    </SheetRouteScreen>
  );
}
