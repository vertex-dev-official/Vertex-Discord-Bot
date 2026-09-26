const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma, getMember, getGuildConfig } = require("../../lib/prisma");
const { pickMonster } = require("../../lib/monsters");
const { applyRpgResult, healthBar } = require("../../lib/rpgHelpers");
const { incrementMission } = require("../../lib/missions");
const { levelFromXp } = require("../../lib/leveling");
const effectsLib = require("../../lib/effects");
const { errorEmbed } = require("../../lib/embeds");

const COOLDOWN_MS = 20 * 60 * 1000; // 20 min
const ENERGY_COST = 15;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("combat")
    .setDescription("Affronte un monstre en combat (ou un autre joueur)")
    .addSubcommand((s) => s.setName("monstre").setDescription("Affronte un monstre aleatoire"))
    .addSubcommand((s) =>
      s
        .setName("duel")
        .setDescription("Defie un autre joueur en duel, mise a la cle")
        .addUserOption((o) => o.setName("adversaire").setDescription("Le joueur a defier").setRequired(true))
        .addIntegerOption((o) => o.setName("mise").setDescription("Montant mise par chaque joueur").setRequired(true).setMinValue(1))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    if (sub === "monstre") return fightMonster(interaction, guildConfig);
    if (sub === "duel") return fightDuel(interaction, guildConfig);
  },
};

async function fightMonster(interaction, guildConfig) {
  const member = await getMember(interaction.user.id, interaction.guild.id);

  if (effectsLib.hasEffect(member, "blesse")) {
    return interaction.reply({ embeds: [errorEmbed("Tu es blesse et dois te soigner (potion ou repos) avant de combattre.")], ephemeral: true });
  }
  if (member.lastCombatAt && Date.now() - new Date(member.lastCombatAt).getTime() < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - new Date(member.lastCombatAt).getTime())) / 60000);
    return interaction.reply({ embeds: [errorEmbed(`Encore ${remaining} minute(s) avant de pouvoir combattre a nouveau.`)], ephemeral: true });
  }
  if (member.energy < ENERGY_COST) {
    return interaction.reply({ embeds: [errorEmbed(`Pas assez d'energie (${member.energy}/${ENERGY_COST} requis).`)], ephemeral: true });
  }

  const level = levelFromXp(member.xp).level;
  const monster = pickMonster(level);

  // Resolution simplifiee en un jet : la puissance du joueur (niveau + PV restants) est comparee
  // a celle du monstre pour determiner une chance de victoire, puis les degats sont tires au sort.
  const playerPower = 20 + level * 8 + member.health * 0.3;
  const monsterPower = monster.health * 0.6 + monster.damageMax * 2;
  const winChance = Math.max(0.15, Math.min(0.9, playerPower / (playerPower + monsterPower)));
  const won = Math.random() < winChance;

  const damageTaken = monster.damageMin + Math.floor(Math.random() * (monster.damageMax - monster.damageMin + 1));
  const result = { energy: -ENERGY_COST };

  let narration;
  if (won) {
    result.xp = monster.xp;
    result.money = monster.money;
    result.health = -Math.round(damageTaken * 0.4); // encaisse quelques degats meme en gagnant
    narration = `Tu affrontes un **${monster.name}** ${monster.emoji} et le vaincs !`;
  } else {
    result.health = -damageTaken;
    if (member.health - damageTaken <= 25) result.effect = "blesse";
    narration = `Tu affrontes un **${monster.name}** ${monster.emoji}... et perds le combat.`;
  }

  const { member: updated, levelBefore, levelAfter } = await applyRpgResult(interaction.guild.id, interaction.user.id, result);
  await prisma.member.update({ where: { id: updated.id }, data: { lastCombatAt: new Date() } });
  if (won) await incrementMission(interaction.guild.id, interaction.user.id, "combats-gagnes");

  const lines = [narration, "", `❤️ PV : ${healthBar(updated.health)} (${updated.health}/100)`];
  if (result.xp) lines.push(`✨ +${result.xp} XP`);
  if (result.money) lines.push(`💰 +${result.money} pieces`);
  if (!won) lines.push(`💔 -${damageTaken} PV`);

  const embed = new EmbedBuilder()
    .setColor(won ? "#57F287" : "#ED4245")
    .setTitle(won ? "⚔️ Victoire !" : "⚔️ Defaite...")
    .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
    .setDescription(lines.join("\n"));
  if (levelAfter > levelBefore) embed.addFields({ name: "🎉 Niveau superieur !", value: `Tu passes niveau **${levelAfter}** !` });

  return interaction.reply({ embeds: [embed] });
}

async function fightDuel(interaction, guildConfig) {
  const opponent = interaction.options.getUser("adversaire");
  const stake = interaction.options.getInteger("mise");

  if (opponent.id === interaction.user.id || opponent.bot) {
    return interaction.reply({ embeds: [errorEmbed("Choisis un autre joueur (humain) a defier.")], ephemeral: true });
  }

  const [challenger, defender] = await Promise.all([
    getMember(interaction.user.id, interaction.guild.id),
    getMember(opponent.id, interaction.guild.id),
  ]);

  if (challenger.balance < stake) return interaction.reply({ embeds: [errorEmbed("Tu n'as pas assez d'argent pour cette mise.")], ephemeral: true });
  if (defender.balance < stake) return interaction.reply({ embeds: [errorEmbed(`${opponent.username} n'a pas assez d'argent pour cette mise.`)], ephemeral: true });

  const challengerLevel = levelFromXp(challenger.xp).level;
  const defenderLevel = levelFromXp(defender.xp).level;
  const challengerPower = 10 + challengerLevel * 5 + Math.random() * 20;
  const defenderPower = 10 + defenderLevel * 5 + Math.random() * 20;
  const challengerWins = challengerPower >= defenderPower;

  const winner = challengerWins ? interaction.user : opponent;
  const loser = challengerWins ? opponent : interaction.user;

  await prisma.member.update({ where: { id: challenger.id }, data: { balance: { increment: challengerWins ? stake : -stake } } });
  await prisma.member.update({ where: { id: defender.id }, data: { balance: { increment: challengerWins ? -stake : stake } } });

  const embed = new EmbedBuilder()
    .setColor(guildConfig.embedColor || "#9B6FBF")
    .setTitle("⚔️ Duel")
    .setDescription(`${interaction.user} affronte ${opponent} pour **${stake}** pieces...\n\n🏆 **${winner.tag || winner.username}** remporte le duel et empoche ${stake} pieces !\n😩 ${loser.tag || loser.username} reste sur sa defaite.`);

  return interaction.reply({ embeds: [embed] });
}
