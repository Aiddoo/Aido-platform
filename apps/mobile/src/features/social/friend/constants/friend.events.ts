import type { FriendSearchLengthBucket } from '../utils/friend-search-length-bucket';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    friend_request_sent: undefined;
    friend_request_cancelled: undefined;
    friend_request_accepted: undefined;
    friend_request_rejected: undefined;
    friend_removed: undefined;
    friend_reordered: undefined;
    friend_search_submitted: { query_length_bucket: FriendSearchLengthBucket };
    friend_strip_hint_dismissed: { hint: 'invite' | 'search' };
  }
}

export {};
