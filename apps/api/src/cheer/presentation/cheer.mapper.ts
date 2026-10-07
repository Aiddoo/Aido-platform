/**
 * Cheer 프레젠테이션 매퍼 — 애플리케이션 타입 → API 응답(@aido/api). 계약 불변.
 */
import type { Cheer, CheerDetail, CheerLimitInfo } from "@aido/api";

import { toISOString, toISOStringOrNull } from "#api/shared/domain/date/utils/format";
import { resolveProfileImage } from "#api/shared/presentation/profile/profile-image.resolver";

import type { CheerWithRelations } from "../application/ports/cheer.repository.port.js";
import type { CheerLimitInfo as ReaderLimitInfo } from "../application/services/cheer.reader.js";

export abstract class CheerMapper {
  static toDetailDto(cheer: CheerWithRelations, appVersion?: string): CheerDetail {
    return {
      id: cheer.id,
      senderId: cheer.senderId,
      receiverId: cheer.receiverId,
      message: cheer.message,
      createdAt: toISOString(cheer.createdAt),
      readAt: toISOStringOrNull(cheer.readAt ?? null),
      sender: {
        id: cheer.sender.id,
        userTag: cheer.sender.userTag,
        name: cheer.sender.profile?.name ?? null,
        profileImage: resolveProfileImage(cheer.sender.profile?.profileImage ?? null, appVersion),
      },
    };
  }

  static toDto(cheer: CheerWithRelations): Cheer {
    return {
      id: cheer.id,
      senderId: cheer.senderId,
      receiverId: cheer.receiverId,
      message: cheer.message,
      createdAt: toISOString(cheer.createdAt),
      readAt: toISOStringOrNull(cheer.readAt ?? null),
    };
  }

  static toDetailDtoList(cheers: CheerWithRelations[], appVersion?: string): CheerDetail[] {
    return cheers.map((cheer) => CheerMapper.toDetailDto(cheer, appVersion));
  }

  static toLimitInfoDto(limitInfo: ReaderLimitInfo): CheerLimitInfo {
    return {
      dailyLimit: limitInfo.dailyLimit,
      usedToday: limitInfo.used,
      remainingToday: limitInfo.remaining,
      isUnlimited: limitInfo.dailyLimit === null,
    };
  }
}
