import * as Discord from "discord.js";
import CONFIG from "./config";

/** Returns time until next monday in ms
 * @param mockMonday If set to true, the function will return 120 seconds instead of time until next monday. Useful while testing on local.
 */
export function getTimeUntilMonday(mockMonday = false): number {
	const monday = new Date();
	monday.setUTCDate(monday.getUTCDate() + ((1 + 7 - monday.getUTCDay()) % 7)); // Set date to monday
	monday.setUTCHours(10); // Set hour to exactly 10AM UTC
	monday.setUTCMinutes(0);
	monday.setUTCSeconds(0);
	monday.setUTCMilliseconds(0);
	return mockMonday ? 120 : monday.getTime() - new Date().getTime();
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
