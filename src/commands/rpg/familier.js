const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma, getMember, getGuildConfig } = require("../../lib/prisma");
const { getItem } = require("../../lib/items");
const { successEmbed, errorEmbed } = require("../../lib/embeds");

const SPECIES = [
  { name: "Chien", value: "Chien", emoji: "🐶" },
  { name: "Chat", value: "Chat", emoji: "🐱" },
  { name: "Dragon", value: "Dragon", emoji: "🐲" },
  { name: "Renard", value: "Renard", emoji: "🦊" },
  { name: "Hibou", value: "Hibou", emoji: "🦉" },
];
const SPECIES_EMOJI = Object.fromEntries(SPECIES.map((s) => [s.value, s.emoji]));

function petLevelFromXp(xp) {
  return Math.floor(Math.sqrt(xp / 20));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("familier")
    .setDescription("Adopte et prends soin d'un familier")
    .addSubcommand((s) =>
      s
        .setName("adopter")
        .setDescription("Adopte ton premier familier")
        .addStringOption((o) => o.setName("espece").setDescription("Espece du familier").setRequired(true).addChoices(...SPECIES))
        .addStringOption((o) => o.setName("nom").setDescription("Nom de ton familier").setRequired(true))
    )
    .addSubcommand((s) => s.setName("voir").setDescription("Affiche les infos de ton familier"))
    .addSubcommand((s) => s.setName("nourrir").setDescription("Nourrit ton familier (utilise des croquettes si tu en as)"))
    .addSubcommand((s) => s.setName("renommer").setDescription("Renomme ton familier").addStringOption((o) => o.setName("nom").setDescription("Nouveau nom").setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const member = await getMember(interaction.user.id, interaction.guild.id);
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    if (sub === "adopter") {
      if (member.petId) return interaction.reply({ embeds: [errorEmbed("Tu as deja un familier ! Utilise `/familier voir`.")], ephemeral: true });

      const species = interaction.options.getString("espece");
      const name = interaction.options.getString("nom").slice(0, 32);

      const pet = await prisma.pet.create({ data: { guildId: interaction.guild.id, userId: interaction.user.id, name, species } });
      await prisma.member.update({ where: { id: member.id }, data: { petId: pet.id } });

      return interaction.reply({ embeds: [successEmbed(`${SPECIES_EMOJI[species]} Tu as adopte **${name}** le ${species.toLowerCase()} !`)] });
    }

    const pet = member.petId ? await prisma.pet.findUnique({ where: { id: member.petId } }) : null;
    if (!pet) return interaction.reply({ embeds: [errorEmbed("Tu n'as pas encore de familier. Utilise `/familier adopter`.")], ephemeral: true });

    if (sub === "voir") {
      const embed = new EmbedBuilder()
        .setColor(guildConfig.embedColor || "#9B6FBF")
        .setTitle(`${SPECIES_EMOJI[pet.species] || "🐾"} ${pet.name}`)
        .setDescription(
          [
            `**Espece :** ${pet.species}`,
            `**Niveau :** ${petLevelFromXp(pet.xp)}`,
            `**Affection :** ${pet.affection}/100`,
            `**Faim :** ${pet.hunger}/100 ${pet.hunger > 70 ? "⚠️ a besoin d'etre nourri !" : ""}`,
          ].join("\n")
        );
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "nourrir") {
      const inventoryItem = await prisma.rpgInventoryItem.findFirst({ where: { memberId: member.id, itemKey: "croquettes", quantity: { gt: 0 } } });

      let affectionGain = 5;
      let hungerReduction = 15;
      let usedItem = false;

      if (inventoryItem) {
        const item = getItem("croquettes");
        affectionGain = item.affection;
        hungerReduction = Math.abs(item.hunger);
        usedItem = true;
        await prisma.rpgInventoryItem.update({ where: { id: inventoryItem.id }, data: { quantity: { decrement: 1 } } });
      }

      await prisma.pet.update({
        where: { id: pet.id },
        data: {
          affection: Math.min(100, pet.affection + affectionGain),
          hunger: Math.max(0, pet.hunger - hungerReduction),
          xp: { increment: 5 },
          lastFedAt: new Date(),
        },
      });

      return interaction.reply({
        embeds: [successEmbed(`${SPECIES_EMOJI[pet.species]} **${pet.name}** est content !${usedItem ? " (croquettes utilisees)" : ""}`)],
      });
    }

    if (sub === "renommer") {
      const name = interaction.options.getString("nom").slice(0, 32);
      await prisma.pet.update({ where: { id: pet.id }, data: { name } });
      return interaction.reply({ embeds: [successEmbed(`Ton familier s'appelle maintenant **${name}**.`)] });
    }
  },
};
