import * as Discord from "discord.js";
import CONFIG from "./config";
import { OngoingChats, userChatStatuses } from "./types";
import * as fns from "date-fns";
import { logger } from "./logger";

const prefix = CONFIG.commandPrefix;
const firstStandupDate = new Date(CONFIG.firstMeetingDay);

/** Returns time until next standup in ms */
export function getTimeUntilNextStandup(): number {
	const today = new Date();
	let meetingDate = fns.nextTuesday(today);
	while (fns.differenceInDays(meetingDate, firstStandupDate) % 14 !== 0) {
		meetingDate = fns.nextTuesday(meetingDate); // meeting is every 2 weeks
	}
	meetingDate.setUTCHours(CONFIG.meeting.hour, CONFIG.meeting.minute, 0, 0);
	logger.info(
		`Next StandUp will be held in ${(timeUntilMonday / 60 / 1000).toFixed(2)} minutes. (At ${meetingDate})`
	);
	return meetingDate.getTime() - Date.now();
}

export async function sendErrorMessage(
	userMessageThatCausedError: Discord.Message,
	specificError?: { cause: string; code: number; silent?: boolean }
): Promise<void> {
	console.error(
		`Error happened.${
			specificError ? ` Error details: ${JSON.stringify(specificError)} |||` : ""
		} User message: ${JSON.stringify(userMessageThatCausedError)}`
	);
	// Make sure error cause ends with "." or "!" or "?" so the message to be sent back to user doesn't look like it's coming from someone who doesn't know punctuation rules.
	if (specificError && !specificError.cause.match(/[.!?]$/)) specificError.cause += ".";
	return void userMessageThatCausedError.channel.send(
		`${specificError && !specificError.silent ? specificError.cause : "Unknown error happened."} Please contact <@${
			CONFIG.developerUserId
		}> regarding this issue with this code: #${specificError ? `S${specificError.code}` : new Date().getTime()}.` // Error codes starting with S mean that they are special error codes.
	);
}

export function dailyStatusChange(
	action: "recorded" | "deleted",
	user: Pick<OngoingChats["user"], "currentStatus">,
	currentLine: string,
	thingsYouCanDoNow: { delete: boolean; addMore: boolean; next: boolean; cancel: boolean }
): Discord.MessageEmbed {
	const embedFields: Discord.EmbedField[] = [];
	embedFields.push({ name: `I have ${action} this line:`, value: currentLine, inline: false });
	embedFields.push({ name: "Things you can do now", value: "----------------------------------", inline: false });
	if (thingsYouCanDoNow.delete)
		embedFields.push({
			name: `Delete ${action === "recorded" ? "this" : "previous line you wrote"} from the report`,
			value: `Just type '${prefix}delete'`,
			inline: false
		});
	const isCurrentlyBlocks = user.currentStatus === userChatStatuses.BLOCKS;
	if (thingsYouCanDoNow.addMore)
		embedFields.push({
			name: `Add more to your ${user.currentStatus}'${!isCurrentlyBlocks ? "s" : ""} list`,
			value: "Just type what you want to add if you want to do this.",
			inline: false
		});
	if (thingsYouCanDoNow.next)
		embedFields.push({
			name: `${isCurrentlyBlocks ? "End your report and get it sent" : "Switch to next question"}`,
			value: `Just type '${prefix}${isCurrentlyBlocks ? "end" : "next"}'`,
			inline: false
		});
	if (thingsYouCanDoNow.cancel)
		embedFields.push({ name: "Cancel your report", value: `Just type '${prefix}cancel'`, inline: false });
	return new Discord.MessageEmbed({ color: 7960960, fields: embedFields });
}
