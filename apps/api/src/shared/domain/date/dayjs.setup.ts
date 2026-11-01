import dayjs from "dayjs";
import "dayjs/locale/ko.js";
import isLeapYear from "dayjs/plugin/isLeapYear.js";
import isoWeek from "dayjs/plugin/isoWeek.js";
import isoWeeksInYear from "dayjs/plugin/isoWeeksInYear.js";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);
dayjs.extend(isoWeeksInYear);
dayjs.extend(isLeapYear);
