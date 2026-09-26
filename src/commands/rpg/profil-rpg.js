const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma, getMember, getGuildConfig } = require("../../lib/prisma");
const { levelFromXp } = require("../../lib/leveling");
const { healthBar, energyBar } = require("../../lib/rpgHelpers");
const { formatEffects } = require("../../lib/effects");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profil-rpg")
    .setDescription("Affiche la fiche de personnage RPG complete (niveau, PV, familier, guilde...)")
    .addUserOption((o) => o.setName("joueur").setDescription("Voir le profil d'un autre joueur").setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser("joueur") || interaction.user;
    const member = await getMember(target.id, interaction.guild.id);
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    const { level, currentLevelXp, xpNeededForNext } = levelFromXp(member.xp);

    const pet = member.petId ? await prisma.pet.findUnique({ where: { id: member.petId } }) : null;
    const faction = member.factionId ? await prisma.faction.findUnique({ where: { id: member.factionId } }) : null;

    const embed = new EmbedBuilder()
      .setColor(guildConfig.embedColor || "#9B6FBF")
      .setAuthor({ name: `Fiche de ${target.tag || target.username}`, iconURL: target.displayAvatarURL() })
      .addFields(
        { name: "Niveau", value: `**${level}** (${currentLevelXp}/${xpNeededForNext} XP)`, inline: true },
        { name: "Pieces", value: `💰 ${member.balance} · 🏦 ${member.bank}`, inline: true },
        { name: "Effets actifs", value: formatEffects(member), inline: true },
        { name: "Points de vie", value: `${healthBar(member.health)}\n${member.health}/100`, inline: true },
        { name: "Energie", value: `${energyBar(member.energy)}\n${member.energy}/100`, inline: true },
        { name: "Guilde", value: faction ? `🏰 ${faction.name}` : "*Aucune*", inline: true },
        { name: "Familier", value: pet ? `${pet.species} **${pet.name}**` : "*Aucun*", inline: true }
      );

    return interaction.reply({ embeds: [embed] });
  },
};
