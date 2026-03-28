import { Injectable, Logger } from "@nestjs/common";

import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";
import { WeatherService } from "@/modules/weather/services/weather.service";

import type {
	ITimezoneStrategy,
	TimezoneContext,
} from "./timezone-reminder-strategy.interface";

interface UserWithLocation {
	id: string;
	location: {
		latitude: number;
		longitude: number;
		gridX: number;
		gridY: number;
	} | null;
}

interface VerifiedUserWithLocation {
	id: string;
	location: {
		latitude: number;
		longitude: number;
		gridX: number;
		gridY: number;
	};
}

@Injectable()
export class WeatherMorningStrategy implements ITimezoneStrategy {
	readonly #logger = new Logger(WeatherMorningStrategy.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
		private readonly weatherService: WeatherService,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz, localHour, localMinute, today } = ctx;

		// 1. 단일 쿼리: User + UserPreference(WHERE) + UserLocation(SELECT)
		const users = await this.database.user.findMany({
			where: {
				...(ctx.userId ? { id: ctx.userId } : {}),
				status: "ACTIVE",
				deletedAt: null,
				preference: {
					pushEnabled: true,
					weatherMorningEnabled: true,
					timezone: tz,
					weatherMorningHour: localHour,
					weatherMorningMinute: localMinute,
				},
				location: { isNot: null },
			},
			select: {
				id: true,
				location: {
					select: {
						latitude: true,
						longitude: true,
						gridX: true,
						gridY: true,
					},
				},
			},
		});

		// location null 필터 (WHERE isNot null이지만 Prisma 타입은 nullable)
		const usersWithLocation = users.filter(
			(u): u is VerifiedUserWithLocation => u.location !== null,
		);
		if (usersWithLocation.length === 0) return { sent: 0 };

		// 2. Dedup
		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: usersWithLocation.map((u) => u.id),
				type: "WEATHER_MORNING",
				notificationDate: today,
			});
		const filtered = usersWithLocation.filter(
			(u) => !alreadyNotified.has(u.id),
		);
		if (filtered.length === 0) return { sent: 0 };

		// 3. 격자별 그룹핑 → 배치 날씨 조회
		const gridGroups = this.#groupByGrid(filtered);
		const gridInputs = [...gridGroups.values()].flatMap((group) => {
			const first = group[0];
			if (!first) return [];
			return [
				{
					gridX: first.location.gridX,
					gridY: first.location.gridY,
					lat: first.location.latitude,
					lon: first.location.longitude,
				},
			];
		});
		const forecasts = await this.weatherService.getForecastsByGridBatch(
			gridInputs,
			today,
		);

		// 4. 알림 생성
		const notifications = filtered.map((user) => {
			const loc = user.location;
			const key = `${loc.gridX}:${loc.gridY}`;
			const forecast = forecasts.get(key);
			if (!forecast) return null;

			const message = NotificationMessageBuilder.weatherMorning(forecast);
			return {
				userId: user.id,
				type: "WEATHER_MORNING" as const,
				title: message.title,
				body: message.body,
				notificationDate: today,
			};
		});

		const valid = notifications.filter(
			(n): n is NonNullable<typeof n> => n !== null,
		);
		if (valid.length === 0) return { sent: 0 };

		// 5. 일괄 발송
		await this.notificationService.createAndSendBatch(valid);

		this.#logger.log(
			`Weather morning: tz=${tz}, time=${localHour}:${String(localMinute).padStart(2, "0")}, grids=${gridGroups.size}, count=${valid.length}`,
		);
		return { sent: valid.length };
	}

	#groupByGrid(
		users: VerifiedUserWithLocation[],
	): Map<string, VerifiedUserWithLocation[]> {
		const groups = new Map<string, VerifiedUserWithLocation[]>();
		for (const user of users) {
			const loc = user.location;
			const key = `${loc.gridX}:${loc.gridY}`;
			const arr = groups.get(key) ?? [];
			arr.push(user);
			groups.set(key, arr);
		}
		return groups;
	}
}
