import { FeedListPane } from '@src/features/todo/components/feed-list-pane';
import { FeedTodoDetailPane } from '@src/features/todo/components/feed-todo-detail-pane';
import { CalendarProvider } from '@src/features/todo/components/providers/calendar-provider';
import { FeedRouteParamsProvider } from '@src/features/todo/components/providers/feed-route-params-provider';
import { AdaptivePane } from '@src/shared/ui';
import { Slot } from 'expo-router';

export default function FeedGroupLayout() {
  return (
    <FeedRouteParamsProvider>
      <CalendarProvider>
        <AdaptivePane
          primary={
            <FeedListPane>
              <Slot />
            </FeedListPane>
          }
          secondary={<FeedTodoDetailPane />}
        />
      </CalendarProvider>
    </FeedRouteParamsProvider>
  );
}
