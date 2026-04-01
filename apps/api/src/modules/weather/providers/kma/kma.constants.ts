import { toCompactDateString } from "@/common/date/utils/format";

/** 기상청 단기예보 API Base URL */
export const KMA_BASE_URL =
	"https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";

/** 엔드포인트 */
export const KMA_ENDPOINTS = {
	/** 단기예보 조회 (3일, 3시간 간격) */
	VILLAGE_FORECAST: "/getVilageFcst",
	/** 초단기예보 조회 (6시간, 1시간 간격) */
	ULTRA_SHORT_FORECAST: "/getUltraSrtFcst",
	/** 초단기실황 조회 */
	ULTRA_SHORT_LIVE: "/getUltraSrtNcst",
} as const;

/**
 * 단기예보 발표 시각 (Base Time)
 * 하루 8회: 0200, 0500, 0800, 1100, 1400, 1700, 2000, 2300
 * API 제공 시간은 발표 시각 + 약 10분 이후
 */
export const KMA_BASE_TIMES = [
	"0200",
	"0500",
	"0800",
	"1100",
	"1400",
	"1700",
	"2000",
	"2300",
] as const;

/**
 * 기상청 카테고리 코드 → 의미 매핑
 *
 * @see https://www.data.go.kr/data/15084084/openapi.do
 */
export const KMA_CATEGORY = {
	/** 강수확률 (%) */
	POP: "POP",
	/** 강수형태: 0=없음, 1=비, 2=비/눈, 3=눈, 4=소나기 */
	PTY: "PTY",
	/** 1시간 강수량 (mm) */
	PCP: "PCP",
	/** 습도 (%) */
	REH: "REH",
	/** 1시간 신적설 (cm) */
	SNO: "SNO",
	/** 하늘상태: 1=맑음, 3=구름많음, 4=흐림 */
	SKY: "SKY",
	/** 1시간 기온 (°C) */
	TMP: "TMP",
	/** 일 최저기온 (°C) */
	TMN: "TMN",
	/** 일 최고기온 (°C) */
	TMX: "TMX",
	/** 풍속 (m/s) */
	WSD: "WSD",
} as const;

/** 하늘상태 코드 → 도메인 타입 매핑 */
export const SKY_CODE_MAP: Record<
	string,
	"CLEAR" | "PARTLY_CLOUDY" | "CLOUDY"
> = {
	"1": "CLEAR",
	"3": "PARTLY_CLOUDY",
	"4": "CLOUDY",
};

/** 강수형태 코드 → 도메인 타입 매핑 */
export const PTY_CODE_MAP: Record<
	string,
	"NONE" | "RAIN" | "RAIN_SNOW" | "SNOW" | "SHOWER"
> = {
	"0": "NONE",
	"1": "RAIN",
	"2": "RAIN_SNOW",
	"3": "SNOW",
	"4": "SHOWER",
};

/** 기상청 API base_date + base_time 쌍 */
export interface KmaBaseDateTime {
	baseDate: string; // YYYYMMDD
	baseTime: string; // HHmm
}

/**
 * 주어진 시각 기준으로 가장 최근 발표 base_date + base_time을 반환
 *
 * - 안전 마진 +15분 (공식 +10분이지만 실무에서 지연 빈번)
 * - 자정~02:14: 전날 23시 발표 → base_date도 하루 전으로 보정
 */
export function getKmaBaseDateTime(date: Date): KmaBaseDateTime {
	const hours = date.getHours();
	const minutes = date.getMinutes();
	const currentTime = hours * 100 + minutes;

	const availableTimes = KMA_BASE_TIMES.filter((bt) => {
		const btNum = Number.parseInt(bt, 10);
		return currentTime >= btNum + 15;
	});

	if (availableTimes.length === 0) {
		// 자정~02:14: 전날 23시 발표 데이터 → base_date도 하루 전
		const yesterday = new Date(date);
		yesterday.setDate(yesterday.getDate() - 1);
		return {
			baseDate: toCompactDateString(yesterday),
			baseTime: "2300",
		};
	}

	return {
		baseDate: toCompactDateString(date),
		baseTime: availableTimes.at(-1) ?? "2300",
	};
}
