import * as Discord from "discord.js";
import { dmCommands, exitTypes, userChatStatuses } from "./types";
import CONFIG from "./config";

const ongoingChats: {
	[s: string]: { currentStatus: userChatStatuses; yesterday: string; today: string; blocks: string };
} = {};
const prefix = CONFIG.commandPrefix;

async function createReportAndSend(userMessage: Discord.Message): Promise<void> {
	userMessage.channel.send("Thanks for your report, I will now send this information to the proper chat.");
	const uid = userMessage.author.id;
	const user = ongoingChats[uid];
	const reportsServer = bot.guilds.cache.find((guild) => guild.id === CONFIG.reportServerId);
	if (reportsServer) {
		const reportsChat = reportsServer.channels.cache.get(CONFIG.reportChannelId) as Discord.TextChannel | undefined;
		if (reportsChat) {
			const embedFields: Discord.EmbedField[] = [];
			embedFields.push({ name: "What did I do yesterday?", value: user.yesterday, inline: false });
			embedFields.push({ name: "What will I do today?", value: user.today, inline: false });
			embedFields.push({
				name: "Anything that will block me in my work today?",
				value: user.blocks,
				inline: false
			});
			const embed = new Discord.MessageEmbed({
				author: {
					name: userMessage.author.username,
					iconURL: userMessage.author.avatarURL() || userMessage.author.defaultAvatarURL
				},
				color: Math.floor(Math.random() * 16777215 /** Gets random color each time for each message :) */),
				fields: embedFields
			});
			delete ongoingChats[uid];
			try {
				return void (await reportsChat.send(embed));
			} catch (e) {
				return void userMessage.channel.send(
					`There has been an error. Please contact <@${CONFIG.developerUserId}> regarding this issue.`
				);
			}
		} else {
			delete ongoingChats[uid];
			return void userMessage.channel.send(
				`Standup reports server has not been set up. Please contact <@${CONFIG.developerUserId}> regarding this issue.`
			);
		}
	} else {
		delete ongoingChats[uid];
		return void userMessage.channel.send(
			`Standup reports server has not been set up. Please contact <@${CONFIG.developerUserId}> regarding this issue.`
		);
	}
}

function handleDMmessage(message: Discord.Message): void {
	let messageContent = message.content;
	const uid = message.author.id;
	const user = ongoingChats[uid];
	if (messageContent.startsWith(prefix)) {
		messageContent = messageContent.slice(prefix.length);
		if (!user && messageContent !== dmCommands.start)
			return void message.channel.send(
				`You haven't started a conversation yet, please type '${prefix}start' first!`
			);
		const messageSplit = user ? user[user.currentStatus].split("\n") : undefined;
		switch (messageContent as dmCommands) {
			case dmCommands.start:
				if (!user) {
					ongoingChats[uid] = {
						currentStatus: userChatStatuses.YESTERDAY,
						yesterday: "",
						today: "",
						blocks: ""
					};
					message.channel.send("What did you do yesterday?");
				} else {
					message.channel.send(
						`You already have started your conversation. Please either type your next item in the list or type '${prefix}end' to finish your report.`
					);
				}
				break;
			case dmCommands.next:
				if (user.currentStatus === userChatStatuses.YESTERDAY) {
					if (!user.yesterday)
						message.channel.send("You cannot leave yesterday's note empty, please type something.");
					else {
						user.currentStatus = userChatStatuses.TODAY;
						message.channel.send("What will you do today?");
					}
				} else if (user.currentStatus === userChatStatuses.TODAY) {
					if (!user.today)
						message.channel.send("You cannot leave today's note empty, please type something.");
					else {
						user.currentStatus = userChatStatuses.BLOCKS;
						message.channel.send("Anything that will block you in your work today?");
					}
				} else if (user.currentStatus === userChatStatuses.BLOCKS) {
					if (!user.blocks) user.blocks = "Nothing.";
					createReportAndSend(message);
				}
				break;
			case dmCommands.end:
				if (user.currentStatus === userChatStatuses.BLOCKS) {
					if (!user.blocks) user.blocks = "Nothing";
					createReportAndSend(message);
				} else {
					message.channel.send(
						`You haven't finished last question. If you have, please type '${prefix}next' to skip to the next question.`
					);
				}
				break;
			case dmCommands.delete:
				if (messageSplit && user[user.currentStatus].split("\n").length > 1) {
					const removed = messageSplit.pop();
					user[user.currentStatus] = messageSplit.join("\n");
					message.channel.send(
						`I have removed line: "${removed}". Please continue or type '${prefix}cancel' to cancel report.`
					);
				} else {
					message.channel.send(
						"You have nothing to save at the moment. Please type something for your report."
					);
				}
				break;
			case dmCommands.cancel:
				delete ongoingChats[uid];
				message.channel.send(
					`Successfully cancelled your report. Type '${prefix}start' if you want to start again.`
				);
				break;
		}
	} else {
		if (!user) {
			return void message.channel.send(
				`You haven't started a conversation yet, please type '${prefix}start' first!`
			);
		} else {
			messageContent = `${messageContent[0].toUpperCase()}${messageContent.slice(1)}`;
			messageContent = messageContent.startsWith("-") ? messageContent : `- ${messageContent}`;
			user[user.currentStatus] += `${messageContent}\n`;
			return void message.channel.send(
				`I have recorded this line: "${messageContent}". If you want to add more to ${user.currentStatus}'${
					user.currentStatus !== userChatStatuses.BLOCKS ? "s" : "" /** Prevent "blocks's" */
				} list, just type it or type '${prefix}${
					user.currentStatus === userChatStatuses.BLOCKS
						? "end' to end your report and get it sent"
						: "next' to switch to next question"
				}. You can also type '${prefix}delete' to remove the last line you saved. (Or type '${prefix}cancel' to cancel report.)`
			);
		}
	}
}

const bot = new Discord.Client();

bot.on("ready", () => {
	console.log("Bot has successfully logged in.");
});

bot.on("reconnecting", async () => {
	console.error("Bot is currently unavailable, trying to reconnect.");
});

bot.on("disconnect", async () => {
	console.error("Bot coulnd't reconnect, bot is not totally disconnected.");
});

bot.on("error", async (error) => {
	console.error(error);
});

bot.on("message", (message): void => {
	if (message.author.bot) return;
	if (message.content.startsWith(`${prefix}eval`) && message.author.id === CONFIG.developerUserId) {
		// Dev tool to let developer run commands live.
		try {
			const response = eval(message.content.slice(`${prefix}eval`.length));
			return void message.channel.send(`\`\`\`js\n${response}\n\`\`\``);
		} catch (err) {
			return void message.channel.send(`There has been an error. Error: \`\`\`js\n${err.message}\n\`\`\``);
		}
	} else if (message.channel.type === "dm") {
		return handleDMmessage(message);
	} // No need to handle other cases since this bot only checks DM messages and then sends message by itself.
});

bot.login(CONFIG.DISCORD_TOKEN);

// Add graceful exit so bot client doesn't look like it's online when the process is closed.

const gracefulShutdown = (exitType: exitTypes): void => {
	bot.destroy();
	console.log(`Gracefully shutting down the bot with reason '${exitType}'.`);
	process.exit();
};

Object.keys(exitTypes).forEach((exitType) => {
	process.on(exitType, () => {
		gracefulShutdown(exitType as exitTypes);
	});
	console.log(`Initialized exit listener for ${exitType}`);
});
