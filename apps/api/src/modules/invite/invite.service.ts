import { Injectable, Logger } from "@nestjs/common";

import { USER_BRIEF_SELECT } from "@/common/database/selects";
import { DatabaseService } from "@/database/database.service";

export interface InviteUserPreview {
	userTag: string;
	name: string | null;
	profileImage: string | null;
}

@Injectable()
export class InviteService {
	readonly #logger = new Logger(InviteService.name);

	constructor(private readonly database: DatabaseService) {}

	async findUserByTag(userTag: string): Promise<InviteUserPreview | null> {
		const user = await this.database.user.findUnique({
			where: { userTag },
			select: USER_BRIEF_SELECT,
		});

		if (!user) {
			this.#logger.debug(`초대 페이지: 유저를 찾을 수 없음 (tag=${userTag})`);
			return null;
		}

		return {
			userTag: user.userTag,
			name: user.profile?.name ?? null,
			profileImage: user.profile?.profileImage ?? null,
		};
	}
}
