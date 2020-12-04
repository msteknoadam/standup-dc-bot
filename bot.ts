import * as dotenv from "dotenv";
import * as Discord from "discord.js";

dotenv.config();

if (!process.env.DISCORD_TOKEN) {
	throw Error("Please add your Discord token using .env file. Check documentation to see how you can do see.");
}

const bot = new Discord.Client();

bot.on("ready", () => {
	console.log("Bot has successfully logged in.");
});

bot.login(process.env.DISCORD_TOKEN);

// Add graceful exit so bot client doesn't look like it's online when the process is closed.

enum exitTypes {
	"exit" = "exit",
	"SIGINT" = "SIGINT",
	"SIGUSR1" = "SIGUSR1",
	"SIGUSR2" = "SIGUSR2",
	"SIGTERM" = "SIGTERM"
}

const gracefulShutdown = (exitType: exitTypes) => {
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
