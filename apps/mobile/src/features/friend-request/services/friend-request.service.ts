import type { ReceivedRequestsResult, SentRequestsResult } from '../models/friend-request.model';
import type {
  FriendRequestRepository,
  PaginationParams,
} from '../repositories/friend-request.repository';
import { toReceivedRequestsResult, toSentRequestsResult } from './friend-request.mapper';

export class FriendRequestService {
  constructor(private readonly _repository: FriendRequestRepository) {}

  getReceivedRequests = async (params?: PaginationParams): Promise<ReceivedRequestsResult> => {
    const dto = await this._repository.getReceivedRequests(params);
    return toReceivedRequestsResult(dto);
  };

  getSentRequests = async (params?: PaginationParams): Promise<SentRequestsResult> => {
    const dto = await this._repository.getSentRequests(params);
    return toSentRequestsResult(dto);
  };

  acceptRequest = async (userId: string): Promise<void> => {
    await this._repository.acceptRequest(userId);
  };

  rejectRequest = async (userId: string): Promise<void> => {
    await this._repository.rejectRequest(userId);
  };

  cancelRequest = async (userId: string): Promise<void> => {
    await this._repository.cancelRequest(userId);
  };
}
