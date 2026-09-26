const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma, getMember, getGuildConfig } = require("../../lib/prisma");
const { successEmbed, errorEmbed } = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("guilde")
    .setDescription("Cree ou rejoins une guilde de joueurs sur ce serveur")
    .addSubcommand((s) => s.setName("creer").setDescription("Cree une nouvelle guilde").addStringOption((o) => o.setName("nom").setDescription("Nom de la guilde").setRequired(true)))
    .addSubcommand((s) => s.setName("rejoindre").setDescription("Rejoint une guilde existante").addStringOption((o) => o.setName("nom").setDescription("Nom de la guilde").setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName("quitter").setDescription("Quitte ta guilde actuelle"))
    .addSubcommand((s) => s.setName("info").setDescription("Affiche les infos d'une guilde").addStringOption((o) => o.setName("nom").setDescription("Nom (par defaut : la tienne)").setRequired(false).setAutocomplete(true)))
    .addSubcommand((s) => s.setName("classement").setDescription("Classement des guildes du serveur par XP")),

  async autocomplete(interaction) {
    const factions = await prisma.faction.findMany({ where: { guildId: interaction.guild.id }, take: 25 });
    const focused = interaction.options.getFocused().toLowerCase();
    return interaction.respond(factions.filter((f) => f.name.toLowerCase().includes(focused)).map((f) => ({ name: f.name, value: f.name })));
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const member = await getMember(interaction.user.id, interaction.guild.id);
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    if (sub === "creer") {
      if (member.factionId) return interaction.reply({ embeds: [errorEmbed("Tu es deja dans une guilde. Quitte-la d'abord avec `/guilde quitter`.")], ephemeral: true });

      const name = interaction.options.getString("nom").trim().slice(0, 32);
      const existing = await prisma.faction.findFirst({ where: { guildId: interaction.guild.id, name } });
      if (existing) return interaction.reply({ embeds: [errorEmbed("Une guilde avec ce nom existe deja.")], ephemeral: true });

      const faction = await prisma.faction.create({ data: { guildId: interaction.guild.id, name, ownerId: interaction.user.id } });
      await prisma.member.update({ where: { id: member.id }, data: { factionId: faction.id } });

      return interaction.reply({ embeds: [successEmbed(`🏰 Guilde **${name}** creee ! Utilise \`/guilde rejoindre nom:${name}\` pour inviter tes amis.`)] });
    }

    if (sub === "rejoindre") {
      if (member.factionId) return interaction.reply({ embeds: [errorEmbed("Tu es deja dans une guilde. Quitte-la d'abord avec `/guilde quitter`.")], ephemeral: true });

      const name = interaction.options.getString("nom");
      const faction = await prisma.faction.findFirst({ where: { guildId: interaction.guild.id, name } });
      if (!faction) return interaction.reply({ embeds: [errorEmbed("Guilde introuvable.")], ephemeral: true });

      await prisma.member.update({ where: { id: member.id }, data: { factionId: faction.id } });
      return interaction.reply({ embeds: [successEmbed(`Tu as rejoint la guilde **${faction.name}** !`)] });
    }

    if (sub === "quitter") {
      if (!member.factionId) return interaction.reply({ embeds: [errorEmbed("Tu n'es dans aucune guilde.")], ephemeral: true });
      await prisma.member.update({ where: { id: member.id }, data: { factionId: null } });
      return interaction.reply({ embeds: [successEmbed("Tu as quitte ta guilde.")] });
    }

    if (sub === "info") {
      const name = interaction.options.getString("nom");
      let faction;
      if (name) {
        faction = await prisma.faction.findFirst({ where: { guildId: interaction.guild.id, name }, include: { members: true } });
      } else if (member.factionId) {
        faction = await prisma.faction.findUnique({ where: { id: member.factionId }, include: { members: true } });
      }
      if (!faction) return interaction.reply({ embeds: [errorEmbed("Guilde introuvable (ou tu n'en as pas — precise un nom).")], ephemeral: true });

      const embed = new EmbedBuilder()
        .setColor(guildConfig.embedColor || "#9B6FBF")
        .setTitle(`🏰 Guilde ${faction.name}`)
        .setDescription([`**XP de guilde :** ${faction.xp}`, `**Membres :** ${faction.members.length}`, `**Fondateur :** <@${faction.ownerId}>`].join("\n"));
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "classement") {
      const factions = await prisma.faction.findMany({ where: { guildId: interaction.guild.id }, include: { members: true }, orderBy: { xp: "desc" }, take: 10 });
      if (!factions.length) return interaction.reply({ embeds: [errorEmbed("Aucune guilde sur ce serveur pour l'instant.")], ephemeral: true });

      const lines = factions.map((f, i) => `**${i + 1}.** ${f.name} — ${f.xp} XP (${f.members.length} membre(s))`);
      const embed = new EmbedBuilder().setColor(guildConfig.embedColor || "#9B6FBF").setTitle("🏆 Classement des guildes").setDescription(lines.join("\n"));
      return interaction.reply({ embeds: [embed] });
    }
  },
};
