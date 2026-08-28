import type {
	NotificationCopy,
	NotificationCopyFactory,
	RetentionNotificationCopyCatalog,
	SchedulerNotificationCopyCatalog,
	SocialNotificationCopyCatalog,
	SystemNotificationCopyCatalog,
	WeatherFallbackCopyCatalog,
	WeatherNotificationCopyCatalog,
} from "../notification-copy.types";

export const SOCIAL_SENDER_FALLBACK = "A friend";

const staticCopy =
	(title: string, body: string): NotificationCopyFactory<undefined> =>
	() => ({
		title,
		body,
	});

const copy = (title: string, body: string): NotificationCopy => ({ title, body });

export const SCHEDULER_TEMPLATES = {
	TODO_REMINDER_60MIN: {
		variants: [
			({ todoTitle }) => copy("One hour until go time ⏰", `“${todoTitle}” is warming up`),
			({ todoTitle }) => copy("The to-do clock just moved", `${todoTitle} in one hour`),
			({ todoTitle }) => copy("A tiny one-hour heads-up", `Warm up for “${todoTitle}”`),
		],
	},
	TODO_REMINDER_10MIN: {
		variants: [
			({ todoTitle }) => copy("Ten minutes to go ⏰", `“${todoTitle}” in ten minutes`),
			({ todoTitle }) => copy("Your to-do is warming up", `Ten minutes until “${todoTitle}”`),
			({ todoTitle }) => copy("A to-do is almost at the door", `“${todoTitle}” starts in ten`),
		],
	},
	TODO_REMINDER_IMMEDIATE: {
		variants: [
			({ todoTitle }) => copy("It’s time to begin 🚀", `“${todoTitle}” starts now`),
			({ todoTitle }) => copy("A to-do just reached the door", `Start “${todoTitle}”?`),
			({ todoTitle }) => copy("The starting light is on", `One small step into “${todoTitle}”`),
		],
	},
	MORNING_REMINDER: {
		variants: [
			({ count }) => copy(`${count} to-dos today ☀️`, "Pick the friendliest one first"),
			({ count }) => copy(`${count} plans for today`, "The cat is already sitting beside the list"),
			({ count }) => copy(`${count} to-dos just woke up`, "The first check is waiting politely"),
			({ count }) =>
				copy(`Good morning — ${count} plans today`, "One paw-step is a perfectly good start"),
			({ count }) => copy(`${count} to-dos formed a line`, "You still get to choose the order 🐾"),
		],
	},
	EVENING_COMPLETE: {
		variants: [
			staticCopy("Every plan is done today 🎉", "The cat is applauding very quietly"),
			staticCopy("Today’s list is sparkling", "Not an empty checkbox in sight"),
			staticCopy("All today’s to-dos clocked out", "You can clock out too"),
			staticCopy("Completion stamp: very tidy", "You did excellent work today 🏆"),
			staticCopy("All clear has arrived", "That is one more paw-step forward"),
		],
	},
	EVENING_PARTIAL: {
		variants: [
			({ remaining }) =>
				copy(`${remaining} still holding their spots`, "If there’s room, meet one more"),
			({ remaining }) =>
				copy(`${remaining} to-dos remain`, "Everything you did finish is safely recorded"),
			({ remaining }) =>
				copy(`${remaining} checkboxes are blinking`, "Choosing the tiniest one is allowed 🐾"),
			({ remaining }) =>
				copy(`${remaining} left on today’s list`, "Wrap up only what fits tonight"),
		],
	},
	EVENING_NONE: {
		variants: [
			staticCopy("Today’s list is still quiet 🌙", "Rest is fine. Pick one only if it helps"),
			staticCopy("The checkboxes may have napped", "A tiny task can wake one up"),
			staticCopy("Still on the starting screen", "Starting now is still starting"),
			staticCopy("A quiet list still counts", "If you have room, meet one small task"),
		],
	},
	MORNING_NO_TODO: {
		variants: [
			staticCopy("Plenty of room today 📭", "Place one thing you want to remember"),
			staticCopy("The empty list wagged its tail", "One tiny plan is plenty"),
			staticCopy("Today has one open spot", "Add the first thing on your mind"),
		],
	},
	EVENING_STREAK: {
		variants: [
			({ streak, next }) =>
				copy(`${streak} all-clear days in a row 🔥`, `Tomorrow can make it ${next}`),
			({ streak, next }) =>
				copy(`${streak} days, stacked neatly`, `Day ${next} can join when it arrives`),
			({ streak }) =>
				copy(
					`That ${streak}-day trail is getting long`,
					"Consistency is following like a little tail 🐾",
				),
		],
	},
	EVENING_STREAK_7: {
		copy: staticCopy("Seven days, one full week 🎉", "You filled the week one day at a time"),
	},
	EVENING_STREAK_14: { copy: staticCopy("A 14-day trail 🏆", "Two weeks of steady paw prints") },
	EVENING_STREAK_30: {
		copy: ({ streak }) =>
			copy(`${streak} days and still growing 👑`, "Consistency looks at home here now"),
	},
	EVENING_STREAK_RISK_PARTIAL: {
		variants: [
			({ streak, remaining }) =>
				copy(
					`${remaining} left on a ${streak}-day trail`,
					"Choose a small one if you want to continue it",
				),
			({ streak, remaining }) =>
				copy(
					`Your ${streak}-day spark is waiting`,
					`${remaining} more can carry it through today 🔥`,
				),
			({ remaining }) =>
				copy(`${remaining} to-dos between here and the streak`, "Do only what fits"),
		],
	},
	EVENING_STREAK_RISK_NONE: {
		variants: [
			({ streak }) =>
				copy(`Your ${streak}-day trail is waiting`, "One completed to-do can continue it"),
			({ streak }) =>
				copy(`The ${streak}-day spark took a nap`, "One small finish can wake it up 🔥"),
			({ streak }) =>
				copy(`One blank after ${streak} paw prints`, "A single step can fill today’s spot"),
		],
	},
	LUNCH_NUDGE: {
		variants: [
			staticCopy("A tiny task after lunch? 🍚", "Start with the smallest one"),
			staticCopy("Your first afternoon check", "The cat usually chooses the easy one"),
			staticCopy("The afternoon opened the door", "Bring one little to-do inside"),
			staticCopy("A tiny post-lunch start", "One finish can get things rolling 🐾"),
		],
	},
	STREAK_AT_RISK: {
		variants: [
			({ streak }) =>
				copy(`Your ${streak}-day trail is waiting`, "One completed to-do can continue it"),
			({ streak }) =>
				copy(`The ${streak}-day spark took a nap`, "One small finish can wake it up 🔥"),
			({ streak }) =>
				copy(`One blank after ${streak} paw prints`, "A single step can fill today’s spot"),
		],
	},
} satisfies SchedulerNotificationCopyCatalog;

export const WEATHER_TEMPLATES = {
	MORNING_CLEAR: {
		variants: [
			({ skyLabel, tempMin, tempMax }) =>
				copy(
					`${skyLabel} today, ${tempMin}–${tempMax}°C ☀️`,
					"The sky appears to have checked your plans",
				),
			({ skyLabel, tempMin, tempMax }) =>
				copy(
					`A ${skyLabel.toLowerCase()} morning, ${tempMin}–${tempMax}°C`,
					"Outdoor to-dos may consult the weather",
				),
		],
	},
	MORNING_RAIN: {
		variants: [
			({ precipProb, tempMin, tempMax }) =>
				copy(
					`${precipProb}% chance of rain today ☔`,
					`Bring an umbrella, ${tempMin}–${tempMax}°C`,
				),
			({ precipProb, tempMin, tempMax }) =>
				copy(
					`Rain checked in: ${precipProb}%`,
					`The cat votes indoors. ${tempMin}–${tempMax}°C 🌧️`,
				),
		],
	},
	MORNING_SNOW: {
		variants: [
			({ precipProb, tempMin, tempMax }) =>
				copy(`${precipProb}% chance of snow today ❄️`, `Bundle up, ${tempMin}–${tempMax}°C`),
			({ precipProb, tempMin, tempMax }) =>
				copy(`Snow may visit: ${precipProb}%`, `Take it slow, ${tempMin}–${tempMax}°C ☃️`),
		],
	},
	EVENING_CLEAR: {
		variants: [
			({ skyLabel, tempMin, tempMax }) =>
				copy(
					`${skyLabel} tomorrow, ${tempMin}–${tempMax}°C 🌙`,
					"Set tomorrow’s plans down beside the forecast",
				),
			({ skyLabel, tempMin, tempMax }) =>
				copy(
					`Tomorrow looks ${skyLabel.toLowerCase()}, ${tempMin}–${tempMax}°C`,
					"The weather peeked at tomorrow’s list first",
				),
		],
	},
	EVENING_RAIN: {
		variants: [
			({ precipProb, tempMin, tempMax }) =>
				copy(
					`${precipProb}% chance of rain tomorrow ☔`,
					`Umbrella by the door, ${tempMin}–${tempMax}°C`,
				),
			({ precipProb, tempMin, tempMax }) =>
				copy(
					`Rain tomorrow: ${precipProb}%`,
					`Indoor plans should fit nicely. ${tempMin}–${tempMax}°C`,
				),
		],
	},
	EVENING_SNOW: {
		variants: [
			({ precipProb, tempMin, tempMax }) =>
				copy(
					`${precipProb}% chance of snow tomorrow ❄️`,
					`Warm clothes ready, ${tempMin}–${tempMax}°C`,
				),
			({ precipProb, tempMin, tempMax }) =>
				copy(
					`Snow may visit tomorrow: ${precipProb}%`,
					`Leave a little early. ${tempMin}–${tempMax}°C`,
				),
		],
	},
} satisfies WeatherNotificationCopyCatalog;

export const SOCIAL_TEMPLATES = {
	FOLLOW_NEW: {
		variants: [
			({ senderName }) =>
				copy(`Friend request from ${senderName} 👋`, "They’d like to share a little encouragement"),
			({ senderName }) =>
				copy(`${senderName} knocked on the friend door`, "Accept to cheer on each other’s days"),
			({ senderName }) =>
				copy("A friend request just arrived", `${senderName} is waiting very politely outside 🐾`),
		],
	},
	FOLLOW_ACCEPTED: {
		variants: [
			({ senderName }) =>
				copy(`${senderName} is your friend now 🎉`, "You can send little cheers across your days"),
			({ senderName }) =>
				copy(
					`You and ${senderName} are connected`,
					"The cat drew a very straight line between you",
				),
			({ senderName }) => copy(`${senderName} accepted`, "Take the next paw-step together 🐾"),
		],
	},
	NUDGE_RECEIVED: {
		variants: [
			({ senderName, todoTitle }) =>
				copy(
					`${senderName} nudged you`,
					todoTitle ? `“${todoTitle}” got a tiny tap 🐾` : "One to-do just wiggled 🐾",
				),
			({ senderName, todoTitle }) =>
				copy(
					`A nudge from ${senderName}`,
					todoTitle
						? `They left a paw print on “${todoTitle}”`
						: "They left a little encouragement",
				),
			({ senderName, todoTitle }) =>
				copy(
					"A to-do just wiggled",
					todoTitle ? `${senderName} tapped “${todoTitle}”` : `${senderName} tapped the list`,
				),
		],
	},
	NUDGE_RECEIVED_WITH_MESSAGE: {
		copy: ({ senderName, todoTitle, message }) =>
			copy(`${senderName} nudged you`, todoTitle ? `“${todoTitle}” · ${message}` : message),
	},
	REMIND_NUDGE_RECEIVED: {
		variants: [
			({ senderName }) => copy(`${senderName} nudged you`, "A tiny plan would fit nicely today 🐾"),
			({ senderName }) =>
				copy(`A tiny reminder from ${senderName}`, "Maybe set down one thing you want to remember"),
			({ senderName }) =>
				copy("A nudge landed on the empty list", `${senderName} says one plan would fit nicely`),
		],
	},
	REMIND_NUDGE_RECEIVED_WITH_MESSAGE: {
		copy: ({ senderName, message }) => copy(`${senderName} nudged you`, message),
	},
	CHEER_RECEIVED: {
		copy: ({ senderName, message }) => copy(`A cheer from ${senderName}`, message),
	},
	CHEER_RECEIVED_NO_MESSAGE: {
		variants: [
			({ senderName }) =>
				copy(`${senderName} cheered you on 📣`, "A little extra strength has arrived"),
			({ senderName }) => copy(`A cheer from ${senderName}`, "The cat put it somewhere safe"),
			({ senderName }) =>
				copy(
					"One bag of encouragement arrived",
					`Sender: ${senderName}. Weight: delightfully light 🐾`,
				),
		],
	},
	FRIEND_COMPLETED: {
		variants: [
			({ friendName }) =>
				copy(`${friendName}’s day just sparkled ✨`, "A small cheer would fit nicely"),
			({ friendName }) =>
				copy(`${friendName}’s day had a little glow`, "A tiny hello suits the moment 🐾"),
			({ friendName }) =>
				copy(`${friendName} had a bright Aido day`, "Send a light little check-in"),
		],
	},
	SOCIAL_DIGEST_MULTI: {
		variants: [
			({ completedFriendCount }) =>
				copy(
					`${completedFriendCount} friends had sparkling days ✨`,
					"A few small cheers would fit nicely",
				),
			({ completedFriendCount }) =>
				copy(
					`Bright-day notes from ${completedFriendCount} friends`,
					"A tiny hello suits the moment 🐾",
				),
			({ completedFriendCount }) =>
				copy(
					`${completedFriendCount} friends had a bright moment`,
					"A small cheer would fit nicely",
				),
		],
	},
	SOCIAL_DIGEST_SINGLE: {
		variants: [
			({ friendName }) =>
				copy(`${friendName}’s day just sparkled ✨`, "A small cheer would fit nicely"),
			({ friendName }) =>
				copy(`${friendName}’s day had a little glow`, "A tiny hello suits the moment 🐾"),
			({ friendName }) =>
				copy(`${friendName} had a bright Aido day`, "A small cheer would fit nicely"),
		],
	},
	NUDGE_SUGGEST: {
		variants: [
			({ friendName }) =>
				copy(`A tiny nudge for ${friendName}?`, "A no-pressure nudge is ready 🐾"),
			({ friendName }) =>
				copy(`A tiny hello for ${friendName}?`, "Send a light check-in if you like"),
			({ friendName }) => copy(`Want to nudge ${friendName}?`, "The cat can carry it over 🐾"),
		],
	},
	TODO_COMMENT: {
		variants: [
			({ senderName }) => copy(`${senderName} commented`, "A new thought just padded in 🐾"),
			({ senderName }) =>
				copy(
					`A comment from ${senderName} arrived`,
					"Your to-do has one more line of conversation",
				),
			({ senderName }) =>
				copy(`${senderName} added to the conversation`, "The comment is waiting politely inside"),
		],
	},
	TODO_COMMENT_CHAIN: {
		variants: [
			({ senderName, count }) =>
				copy(`${senderName} left ${count} comments`, "The conversation grew a little tail 🐾"),
			({ senderName, count }) =>
				copy(
					`${count} comments from ${senderName} arrived`,
					"Things got pleasantly busy below your to-do",
				),
			({ senderName, count }) =>
				copy(`${senderName} added ${count} thoughts`, "The new comments are waiting inside"),
		],
	},
	TODO_COMMENT_REPLY: {
		variants: [
			({ senderName }) => copy(`${senderName} replied`, "The conversation grew by one paw-step 🐾"),
			({ senderName }) =>
				copy(`A reply from ${senderName} arrived`, "The comment thread grew a tiny tail"),
			({ senderName }) =>
				copy(`${senderName} kept the conversation going`, "A new reply is waiting inside"),
		],
	},
	TODO_COMMENT_REPLY_CHAIN: {
		variants: [
			({ senderName, count }) =>
				copy(`${senderName} added ${count} replies`, "The conversation grew a proper tail 🐾"),
			({ senderName, count }) =>
				copy(
					`${count} replies from ${senderName} arrived`,
					"The comment thread got a little longer",
				),
			({ senderName, count }) =>
				copy(
					`${senderName} extended the conversation ${count} times`,
					"The new replies are waiting inside",
				),
		],
	},
	TODO_COMMENT_LIKE: {
		variants: [
			({ senderName }) => copy(`${senderName} liked your comment`, "A small heart just arrived ❤️"),
			({ senderName }) =>
				copy(`A heart from ${senderName} arrived`, "Your comment is acting very casual about it"),
			({ senderName }) => copy(`${senderName} added a heart`, "It landed on your comment"),
		],
	},
} satisfies SocialNotificationCopyCatalog;

export const SYSTEM_TEMPLATES = {
	WINBACK_DAY3: {
		variants: [
			staticCopy("The to-dos took a nap 💤", "Your list saved you a quiet seat"),
			staticCopy("A breeze crossed your list", "Set down one thing you need today"),
			staticCopy("The Aido cat saved your spot", "One paw-step whenever you’re ready 🐾"),
		],
	},
	WINBACK_DAY7: {
		variants: [
			staticCopy("The list stayed quiet all week", "One new plan will get it moving again 🐾"),
			staticCopy("The cat turned a calendar page", "Write down whatever matters today"),
			staticCopy("Your spot is still here", "One tiny to-do is a fine return"),
		],
	},
	WINBACK_DAY14: {
		variants: [
			staticCopy("The list saw a couple moons 🌕", "Today can be a brand-new day one"),
			staticCopy("A rested plan is stretching", "Set down the one thing you need now"),
			staticCopy("Restart is always right here", "Come back with one easy paw-step 🐾"),
		],
	},
	WINBACK_DAY21: {
		variants: [
			staticCopy("A few calendar pages passed", "One plan is enough to come back 🐾"),
			staticCopy("A fresh starting line appeared", "Write only what fits today"),
			staticCopy("The cat remembers your spot", "Begin again with one small thing"),
		],
	},
	WINBACK_DAY30: {
		variants: [
			staticCopy("The calendar made a full lap 🗓️", "A new today only needs one to-do"),
			staticCopy("The list dusted itself off", "Place one plan you need right now"),
			staticCopy("Call today a new first day?", "One paw-step is enough 🐾"),
		],
	},
	WEEKLY_ACHIEVEMENT: {
		variants: [
			({ completedCount }) =>
				copy(
					`${completedCount} completed this week 📊`,
					"Those little checks look excellent together",
				),
			({ completedCount }) =>
				copy(`You finished ${completedCount} this week`, "The cat counted twice, professionally"),
			({ completedCount }) =>
				copy(
					`${completedCount} completions, all in a row`,
					"This week’s paw prints are easy to see 🐾",
				),
		],
	},
	WEEKLY_ACHIEVEMENT_PERFECT: {
		variants: [
			staticCopy("A 100% week 🏆", "No empty checkboxes found"),
			staticCopy("Every plan is complete", "That is one beautifully tidy record"),
			staticCopy("Perfect week delivered", "The cat briefly sat up straighter 🐾"),
		],
	},
	WEEKLY_ACHIEVEMENT_ALMOST: {
		variants: [
			({ rate }) =>
				copy(`${rate}% complete this week 📊`, "Everything you did is clearly recorded"),
			({ rate }) => copy(`You finished ${rate}% of the plan`, "That was a very full week"),
			({ rate }) =>
				copy(`This week filled up to ${rate}%`, "The cat looks appropriately pleased 🐾"),
		],
	},
	WEEKLY_REPORT: {
		copy: staticCopy("Your weekly report is here 📊", "See the paw prints you left this week"),
	},
	MONTHLY_REPORT: {
		copy: staticCopy("Your monthly report is here 📈", "See what gathered over the month"),
	},
	AI_SUGGESTION: {
		copy: staticCopy("A repeating pattern appeared ✨", "Aido can make that routine easier"),
	},
	BILLING_ISSUE: {
		copy: staticCopy("Check your payment method", "Update it to keep your plan active."),
	},
	ONBOARDING_DAY0: {
		copy: staticCopy("Your first to-do is ready 🌱", "Write down one small thing on your mind"),
	},
	ONBOARDING_DAY1: {
		copy: staticCopy("Today’s checkboxes are ready", "Continue with only what fits today 🐾"),
	},
	ONBOARDING_DAY2: {
		copy: staticCopy("There’s room for a friend 🤝", "Share small cheers across your days"),
	},
	ONBOARDING_DAY3: {
		copy: staticCopy("Your reminder clock is ready ⏰", "Choose when you want Aido to check in"),
	},
	ONBOARDING_DAY5: {
		copy: ({ completedCount }) =>
			copy(`${completedCount} completed already`, "The cat counted very carefully 🐾"),
	},
	ONBOARDING_DAY7: {
		copy: ({ completedCount }) =>
			copy(
				"Your first-week record is ready 🎉",
				`${completedCount} completions gathered along the way`,
			),
	},
	MILESTONE_FIRST_COMPLETE: {
		copy: staticCopy("Your first completion glowed ✨", "That first paw-step landed beautifully"),
	},
	MILESTONE_10: {
		copy: staticCopy("Ten completions gathered 🎉", "Double-digit paw prints. Very official."),
	},
	MILESTONE_50: {
		copy: staticCopy("You passed 50 completions 🐾", "That record has some pleasant weight now"),
	},
	MILESTONE_100: {
		copy: staticCopy("100 completions reached 👑", "The cat ran out of toes while counting"),
	},
	MILESTONE_STREAK_3: {
		copy: staticCopy("Three days of paw prints 🔥", "Consistency is growing a tiny tail"),
	},
	MILESTONE_FIRST_FRIEND: {
		copy: staticCopy("Your first friend is here 🎉", "Tiny cheers can cross the day"),
	},
} satisfies SystemNotificationCopyCatalog;

export const SKY_LABEL_MAP = { CLEAR: "Clear", PARTLY_CLOUDY: "Partly cloudy", CLOUDY: "Cloudy" };

export const WEATHER_FALLBACK = {
	MORNING: {
		copy: staticCopy("Want today’s weather too? ☀️", "Set your location for a morning forecast"),
	},
	EVENING: {
		copy: staticCopy("Tomorrow’s weather awaits 🌙", "Set your location for tomorrow’s weather"),
	},
} satisfies WeatherFallbackCopyCatalog;

export const RETENTION_TEMPLATES = {
	"D0:d0_no_todo": {
		variants: [
			staticCopy("Your first to-do is ready 🌱", "Write down one thing on your mind"),
			staticCopy("The empty list wagged its tail", "One tiny plan is enough to begin 🐾"),
			staticCopy("Set down today’s first plan", "Start with the easiest thing"),
		],
	},
	"D1:d1_no_todo": {
		variants: [
			staticCopy("Plenty of room today 📝", "Place one thing you want to do"),
			staticCopy("One plan-shaped spot is open", "The smallest to-do is enough"),
			staticCopy("The cat joined the empty list", "Give it one thing to remember 🐾"),
		],
	},
	"D1:d1_has_todo_no_completion": {
		variants: [
			staticCopy("Your first check is waiting ✅", "Choose the friendliest to-do"),
			staticCopy("Your plans are stretching", "A five-minute task is a fine start"),
			staticCopy("The list is ready when you are", "One paw-step is enough to begin 🐾"),
		],
	},
	"D3:d3_restart": {
		variants: [
			staticCopy("Today can be a new day one 🌱", "Write down the one thing you need now"),
			staticCopy("A fresh planner page opened", "Begin with only what fits today"),
			staticCopy("The cat found the start line", "One easy paw-step is plenty 🐾"),
		],
	},
	"D7:d7_has_progress": {
		variants: [
			staticCopy("Week one left paw prints 🎉", "See the changes you made this week"),
			staticCopy("Your first weekly recap", "Look through the things you completed"),
			staticCopy("We walked through week one", "Your finished tasks are all here 🐾"),
		],
	},
	"D7:d7_restart": {
		variants: [
			staticCopy("A fresh week has room 🌱", "Write down the one thing you need now"),
			staticCopy("The list made a Monday face", "One doable plan is enough for today"),
			staticCopy("Restart is still right here", "Come back with one easy paw-step 🐾"),
		],
	},
} satisfies RetentionNotificationCopyCatalog;
