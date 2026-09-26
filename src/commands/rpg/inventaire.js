const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma, getMember, getGuildConfig } = require("../../lib/prisma");
const { getItem, formatItemLine } = require("../../lib/items");
const { applyRpgResult } = require("../../lib/rpgHelpers");
const { successEmbed, errorEmbed } = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("inventaire")
    .setDescription("Consulte ou utilise tes objets d'aventure")
    .addSubcommand((s) => s.setName("voir").setDescription("Affiche ton inventaire"))
    .addSubcommand((s) => s.setName("utiliser").setDescription("Utilise un objet").addStringOption((o) => o.setName("objet").setDescription("Objet a utiliser").setRequired(true).setAutocomplete(true))),

  async autocomplete(interaction) {
    const member = await getMember(interaction.user.id, interaction.guild.id);
    const items = await prisma.rpgInventoryItem.findMany({ where: { memberId: member.id, quantity: { gt: 0 } } });
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = items
      .map((i) => ({ key: i.itemKey, item: getItem(i.itemKey), quantity: i.quantity }))
      .filter((i) => i.item)
      .filter((i) => i.item.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((i) => ({ name: `${i.item.emoji} ${i.item.name} (x${i.quantity})`, value: i.key }));
    return interaction.respond(choices);
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const member = await getMember(interaction.user.id, interaction.guild.id);
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    if (sub === "voir") {
      const items = await prisma.rpgInventoryItem.findMany({ where: { memberId: member.id, quantity: { gt: 0 } } });
      const embed = new EmbedBuilder().setColor(guildConfig.embedColor || "#9B6FBF").setTitle(`🎒 Inventaire de ${interaction.user.username}`);

      if (!items.length) {
        embed.setDescription("Vide pour le moment. Pars a l'aventure ou combats pour trouver des objets !");
      } else {
        embed.setDescription(items.map((i) => formatItemLine(i.itemKey, i.quantity)).join("\n"));
      }
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "utiliser") {
      const itemKey = interaction.options.getString("objet");
      const item = getItem(itemKey);
      if (!item) return interaction.reply({ embeds: [errorEmbed("Objet inconnu.")], ephemeral: true });

      const inventoryItem = await prisma.rpgInventoryItem.findUnique({ where: { memberId_itemKey: { memberId: member.id, itemKey } } });
      if (!inventoryItem || inventoryItem.quantity < 1) {
        return interaction.reply({ embeds: [errorEmbed("Tu ne possedes pas cet objet.")], ephemeral: true });
      }

      if (item.type !== "consumable") {
        return interaction.reply({ embeds: [errorEmbed("Cet objet ne peut pas etre utilise directement (objet de collection/materiau).")], ephemeral: true });
      }

      const result = {};
      if (item.heal) result.health = item.heal;
      if (item.energy) result.energy = item.energy;

      await applyRpgResult(interaction.guild.id, interaction.user.id, result);
      await prisma.rpgInventoryItem.update({ where: { id: inventoryItem.id }, data: { quantity: { decrement: 1 } } });

      const gains = [];
      if (item.heal) gains.push(`❤️ +${item.heal} PV`);
      if (item.energy) gains.push(`⚡ +${item.energy} energie`);

      return interaction.reply({ embeds: [successEmbed(`${item.emoji} Tu utilises **${item.name}**. ${gains.join(" · ")}`)] });
    }
  },
};
