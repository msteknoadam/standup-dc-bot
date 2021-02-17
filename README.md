# standup-dc-bot

---

# First Time Install

In order to run the server in your local, you first need to install these:

-   Node.JS (v12.18+)
-   yarn

When you have installed the required things, you need to run this command on main directory to install libraries:

-   `yarn`

As the libraries have installed, you then should add your Discord Token by creating a ".env" file on main directory like this:
(Note: If you don't know how to get a Discord Token, then check [here](https://github.com/msteknoadam/standup-dc-bot/blob/master/GETTING_DISCORD_TOKEN.md))

-   `DISCORD_TOKEN = "YOUR_TOKEN_HERE"`

## Running the server on local

To run the server for **development** on your local computer, open terminal and run this command:

-   `yarn dev`

To run the server for **production** on a server, open terminal and run this command (Using tmux or screen etc. is recommended as this process will continuously run):

-   `yarn start`

If you want to run the server with monday standup check debugging, open terminal and run this command (Do not put <> characters when writing it, they are there to show you can write either dev or start so choose one of them and write without <> characters):

-   `npx cross-env DEBUG_MONDAY_CHECK=1 yarn <dev/start>`
