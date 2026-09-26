const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma, getMember, getGuildConfig } = require("../../lib/prisma");
const { rollAdventure } = require("../../lib/adventures");
const { applyRpgResult } = require("../../lib/rpgHelpers");
const { incrementMission } = require("../../lib/missions");
const { getItem } = require("../../lib/items");
const effectsLib = require("../../lib/effects");
const { errorEmbed } = require("../../lib/embeds");

const COOLDOWN_MS = 60 * 60 * 1000; // 1h
const ENERGY_COST = 10;

module.exports = {
  data: new SlashCommandBuilder().setName("aventure").setDescription("Pars a l'aventure : gagne de l'XP, de l'argent, des objets... ou des ennuis."),

  async execute(interaction) {
    const member = await getMember(interaction.user.id, interaction.guild.id);
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    if (effectsLib.hasEffect(member, "gele")) {
      return interaction.reply({ embeds: [errorEmbed("Tu es gele et ne peux pas partir a l'aventure pour le moment.")], ephemeral: true });
    }

    if (member.lastAdventureAt && Date.now() - new Date(member.lastAdventureAt).getTime() < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - new Date(member.lastAdventureAt).getTime())) / 60000);
      return interaction.reply({ embeds: [errorEmbed(`Tu dois encore attendre ${remaining} minute(s) avant ta prochaine aventure.`)], ephemeral: true });
    }

    if (member.energy < ENERGY_COST) {
      return interaction.reply({ embeds: [errorEmbed(`Tu n'as pas assez d'energie (${member.energy}/${ENERGY_COST} requis). Repose-toi ou utilise une ration.`)], ephemeral: true });
    }

    const { narration, result } = rollAdventure(member, effectsLib);
    result.energy = (result.energy || 0) - ENERGY_COST;

    const { member: updated, levelBefore, levelAfter } = await applyRpgResult(interaction.guild.id, interaction.user.id, result);
    await prisma.member.update({ where: { id: updated.id }, data: { lastAdventureAt: new Date() } });
    await incrementMission(interaction.guild.id, interaction.user.id, "aventures");

    const lines = [narration, ""];
    if (result.money) lines.push(result.money > 0 ? `💰 +${result.money} pieces` : `💸 ${result.money} pieces`);
    if (result.xp) lines.push(`✨ +${result.xp} XP`);
    if (result.health) lines.push(result.health > 0 ? `❤️ +${result.health} PV` : `💔 ${result.health} PV`);
    if (result.item) {
      const item = getItem(result.item);
      lines.push(`🎁 Objet obtenu : ${item.emoji} **${item.name}**`);
    }
    lines.push(`⚡ -${ENERGY_COST} energie (${updated.energy}/100 restant)`);

    const embed = new EmbedBuilder()
      .setColor(guildConfig.embedColor || "#9B6FBF")
      .setTitle("🗺️ Aventure")
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
      .setDescription(lines.join("\n"));

    if (levelAfter > levelBefore) embed.addFields({ name: "🎉 Niveau superieur !", value: `Tu passes niveau **${levelAfter}** !` });

    return interaction.reply({ embeds: [embed] });
  },
};
