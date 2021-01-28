import * as Discord from "discord.js";
import { dmCommands, exitTypes, userChatStatuses } from "./types";
import CONFIG from "./config";

let lastPosted = new Date();

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkIfCanPost() {
	const now = new Date();
	// posts once a week
	const isMonday = now.getDay() == 1;
	return isMonday && lastPosted.getDate() !== now.getDate();
}

const ongoingChats: {
	[s: string]: { currentStatus: userChatStatuses; yesterday: string[]; today: string[]; blocks: string[] };
} = {};
const prefix = CONFIG.commandPrefix;
let ongoingMessages: Discord.MessageEmbed[] = [];
async function sendErrorMessage(
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

async function createReportAndSend(userMessage: Discord.Message): Promise<void> {
	userMessage.channel.send("Thanks for your report, I will now send this information to the proper chat.");
	const uid = userMessage.author.id;
	const user = ongoingChats[uid];
	const reportServers = Object.keys(CONFIG.reportServers);
	if (reportServers.length === 0) {
		return sendErrorMessage(userMessage, { cause: "Report servers are not configured", code: 500, silent: true });
	}
	const embedFields: Discord.EmbedField[] = [];
	embedFields.push({ name: "What did I do yesterday?", value: user.yesterday.join("\n"), inline: false });
	embedFields.push({ name: "What will I do today?", value: user.today.join("\n"), inline: false });
	embedFields.push({
		name: "Anything that will block me in my work today?",
		value: user.blocks.join("\n"),
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
	reportServers.forEach(async (serverId) => {
		const reportsServer = bot.guilds.cache.find((guild) => guild.id === serverId);
		if (reportsServer) {
			const channelId = CONFIG.reportServers[serverId];
			const reportsChat = reportsServer.channels.cache.get(channelId) as Discord.TextChannel | undefined;
			if (reportsChat) {
				try {
					await reportsChat.send(embed);
					return;
				} catch (e) {
					console.error(e);
					return sendErrorMessage(
						userMessage,
						e.message && e.message.includes("Missing Access")
							? {
									cause: `Bot doesn't have access to channel '${channelId}' inside server '${serverId}'.`,
									code: 401,
									silent: true
							  }
							: undefined
					);
				}
			} else {
				delete ongoingChats[uid];
				return sendErrorMessage(userMessage, {
					cause: `Couldn't find the report channel '${channelId}' inside server '${serverId}'. Make sure you set channelId correctly.`,
					code: 404,
					silent: true
				});
			}
		} else {
			delete ongoingChats[uid];
			return sendErrorMessage(userMessage, {
				cause: `Couldn't find the report server '${serverId}'. Maybe you forgot to invite bot to that server? `,
				code: 404,
				silent: true
			});
		}
	});
}

async function handleDMmessage(message: Discord.Message): Promise<void> {
	let messageContent = message.content;
	const uid = message.author.id;
	const user = ongoingChats[uid];
	try {
		if (messageContent.startsWith(prefix)) {
			messageContent = messageContent.slice(prefix.length);
			if (!user && messageContent !== dmCommands.start) {
				await message.channel.send(
					`You haven't started a conversation yet, please type '${prefix}start' first!`
				);
				return;
			}
			switch (messageContent as dmCommands) {
				case dmCommands.start:
					if (!user) {
						ongoingChats[uid] = {
							currentStatus: userChatStatuses.YESTERDAY,
							yesterday: [],
							today: [],
							blocks: []
						};
						await message.channel.send("What did you do yesterday?");
					} else {
						await message.channel.send(
							`You already have started your conversation. Please either type your next item in the list or type '${prefix}end' to finish your report.`
						);
					}
					break;
				case dmCommands.next:
					if (user.currentStatus === userChatStatuses.YESTERDAY) {
						if (!user.yesterday)
							await message.channel.send(
								"You cannot leave yesterday's note empty, please type something."
							);
						else {
							user.currentStatus = userChatStatuses.TODAY;
							await message.channel.send("What will you do today?");
						}
					} else if (user.currentStatus === userChatStatuses.TODAY) {
						if (!user.today)
							await message.channel.send("You cannot leave today's note empty, please type something.");
						else {
							user.currentStatus = userChatStatuses.BLOCKS;
							await message.channel.send("Anything that will block you in your work today?");
						}
					} else if (user.currentStatus === userChatStatuses.BLOCKS) {
						if (user.blocks.length === 0) user.blocks = ["- Nothing"];
						await createReportAndSend(message);
					}
					break;
				case dmCommands.end:
					if (user.currentStatus === userChatStatuses.BLOCKS) {
						if (user.blocks.length === 0) user.blocks = ["- Nothing"];
						await createReportAndSend(message);
					} else {
						await message.channel.send(
							`You haven't finished last question. If you have, please type '${prefix}next' to skip to the next question.`
						);
					}
					break;
				case dmCommands.delete:
					if (user[user.currentStatus].length > 0) {
						const removed = user[user.currentStatus].pop();
						await message.channel.send(
							`I have removed line: "${removed}". Please continue or type '${prefix}cancel' to cancel report.`
						);
					} else {
						await message.channel.send(
							"You haven't added anything to response for your last question. Please type something for your report."
						);
					}
					break;
				case dmCommands.cancel:
					delete ongoingChats[uid];
					await message.channel.send(
						`Successfully cancelled your report. Type '${prefix}start' if you want to start again.`
					);
					break;
			}
		} else {
			if (!user) {
				await message.channel.send(
					`You haven't started a conversation yet, please type '${prefix}start' first!`
				);
				return;
			} else {
				const messageSplit = messageContent.split("\n");
				if (messageSplit.length > 1) {
					messageSplit.forEach((line) => {
						const messageCopy = message;
						messageCopy.content = line;
						handleDMmessage(messageCopy);
					});
					return;
				}
				messageContent = `${messageContent[0].toUpperCase()}${messageContent.slice(1)}`;
				messageContent = messageContent.startsWith("-") ? messageContent : `- ${messageContent}`;
				user[user.currentStatus].push(messageContent);
				await message.channel.send(
					`I have recorded this line: "${messageContent}". If you want to add more to ${user.currentStatus}'${
						user.currentStatus !== userChatStatuses.BLOCKS ? "s" : "" /** Prevent "blocks's" */
					} list, just type it or type '${prefix}${
						user.currentStatus === userChatStatuses.BLOCKS
							? "end' to end your report and get it sent"
							: "next' to switch to next question"
					}. You can also type '${prefix}delete' to remove the last line you saved. (Or type '${prefix}cancel' to cancel report.)`
				);
				return;
			}
		}
	} catch (e) {
		console.error(e);
		await sendErrorMessage(message);
		return;
	}
}

async function handlePublicMsg(message: Discord.Message): Promise<void> {
	let messageContent = message.content;
	if (!messageContent.startsWith(prefix)) {
		return;
	}
	const args = messageContent.slice(1).split(" ");
	const shifted = args.shift();
	if (!shifted) return;
	const cmd = shifted.toLowerCase();

	switch (cmd) {
		case "add":
			const embedFields = [];
			embedFields.push({ name: "I noted: ", value: args.join(" "), inline: false });
			embedFields.push({ name: "Date ", value: new Date(), inline: false });

			const embed = new Discord.MessageEmbed({
				author: {
					name: message.author.username,
					iconURL: message.author.avatarURL() || message.author.defaultAvatarURL
				},
				color: Math.floor(Math.random() * 16777215),
				fields: embedFields
			});

			ongoingMessages.push(embed);
			break;

		case "get":
			ongoingMessages.map((el) => message.channel.send(el));
			break;
		case "delete":
			const index = +args[0];
			if (isNaN(index)) return;
			if (ongoingMessages.length - 1 < index) return;
			ongoingMessages.splice(index, 1);
			break;
	}
}
const bot = new Discord.Client();

bot.on("ready", async () => {
	console.log("Bot has successfully logged in.");
	while (true) {
		await sleep(5 * 60 * 1000);
		if (checkIfCanPost()) {
			const reportServers = Object.keys(CONFIG.reportServers);

			reportServers.forEach(async (serverId) => {
				const reportsServer = bot.guilds.cache.find((guild) => guild.id === serverId);
				if (reportsServer) {
					const channelId = CONFIG.reportServers[serverId];
					const reportsChat = reportsServer.channels.cache.get(channelId) as Discord.TextChannel | undefined;
					if (reportsChat) {
						ongoingMessages.map((el) => reportsChat.send(el));
					}
				}
			});

			lastPosted = new Date();
			ongoingMessages = [];
		}
	}
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

bot.on(
	"message",
	async (message): Promise<void> => {
		if (message.author.bot) return;

		if (message.content.startsWith(`${prefix}eval`) && message.author.id === CONFIG.developerUserId) {
			// Dev tool to let developer run commands live.
			try {
				const response = eval(message.content.slice(`${prefix}eval`.length));
				await message.channel.send(`\`\`\`js\n${response}\n\`\`\``);
				return;
			} catch (err) {
				message.channel.send(`There has been an error. Error: \`\`\`js\n${err.message}\n\`\`\``);
				return;
			}
		}

		if (message.channel.type !== "dm") {
			return handlePublicMsg(message);
		}
		return handleDMmessage(message);
		/*
		if (message.author.bot) return;
		if (message.content.startsWith(`${prefix}eval`) && message.author.id === CONFIG.developerUserId) {
			// Dev tool to let developer run commands live.
			try {
				const response = eval(message.content.slice(`${prefix}eval`.length));
				await message.channel.send(`\`\`\`js\n${response}\n\`\`\``);
				return;
			} catch (err) {
				message.channel.send(`There has been an error. Error: \`\`\`js\n${err.message}\n\`\`\``);
				return;
			}
		} else 
		*/
		// No need to handle other cases since this bot only checks DM messages and then sends message by itself.
	}
);

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
