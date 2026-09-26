const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma, getMember, getGuildConfig } = require("../../lib/prisma");
const { pickDailyMissions, todayKey } = require("../../lib/missions");
const { applyRpgResult } = require("../../lib/rpgHelpers");
const { successEmbed, errorEmbed } = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("missions")
    .setDescription("Missions journalieres et leurs recompenses")
    .addSubcommand((s) => s.setName("voir").setDescription("Affiche tes missions du jour"))
    .addSubcommand((s) => s.setName("reclamer").setDescription("Reclame les recompenses des missions terminees")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const member = await getMember(interaction.user.id, interaction.guild.id);
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    const today = todayKey();
    const progress = member.missionsDate === today ? member.missionsProgress || {} : {};
    const claimed = member.missionsDate === today ? member.missionsProgress?.__claimed || [] : [];
    const missions = pickDailyMissions(interaction.user.id);

    if (sub === "voir") {
      const lines = missions.map((m) => {
        const count = Math.min(m.goal, progress[m.key] || 0);
        const done = count >= m.goal;
        const isClaimed = claimed.includes(m.key);
        const status = isClaimed ? "✅ reclamee" : done ? "🎁 prete a reclamer !" : `${count}/${m.goal}`;
        return `**${m.label}** — ${status}`;
      });

      const embed = new EmbedBuilder()
        .setColor(guildConfig.embedColor || "#9B6FBF")
        .setTitle("📋 Missions du jour")
        .setDescription(lines.join("\n"))
        .setFooter({ text: "Nouvelles missions chaque jour a minuit. Utilise /missions reclamer une fois terminees." });

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "reclamer") {
      const readyToClaim = missions.filter((m) => (progress[m.key] || 0) >= m.goal && !claimed.includes(m.key));
      if (!readyToClaim.length) return interaction.reply({ embeds: [errorEmbed("Aucune mission terminee a reclamer pour le moment.")], ephemeral: true });

      let totalMoney = 0;
      let totalXp = 0;
      for (const mission of readyToClaim) {
        totalMoney += mission.reward.money || 0;
        totalXp += mission.reward.xp || 0;
      }

      await applyRpgResult(interaction.guild.id, interaction.user.id, { money: totalMoney, xp: totalXp });

      const newProgress = { ...progress, __claimed: [...claimed, ...readyToClaim.map((m) => m.key)] };
      await prisma.member.update({ where: { id: member.id }, data: { missionsDate: today, missionsProgress: newProgress } });

      return interaction.reply({
        embeds: [successEmbed(`🎉 ${readyToClaim.length} mission(s) reclamee(s) : +${totalMoney} pieces, +${totalXp} XP.`)],
      });
    }
  },
};
