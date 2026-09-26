require("dotenv").config();
const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const { loadCommands } = require("./handlers/loadCommands");
const { loadEvents } = require("./handlers/loadEvents");
const { initPlayer } = require("./lib/player");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
});

client.commands = new Collection();
// Map<guildId, Map<userId, timestamp>> pour le cooldown d'XP
client.xpCooldowns = new Collection();

loadCommands(client);
loadEvents(client);
initPlayer(client)
  .then(() => console.log("[player] discord-player initialise."))
  .catch((err) => console.error("[player] Initialisation echouee (le reste du bot continue de fonctionner).", err));

process.on("unhandledRejection", (err) => console.error("[unhandledRejection]", err));
process.on("uncaughtException", (err) => console.error("[uncaughtException]", err));

client.login(process.env.DISCORD_TOKEN);
