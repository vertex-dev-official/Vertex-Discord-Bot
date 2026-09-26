const { prisma, getMember } = require("./prisma");
const { withEffect } = require("./effects");

const MAX_HEALTH = 100;
const MAX_ENERGY = 100;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Applique un objet de deltas ({ money, xp, health, energy, item, effect }) issu d'une aventure ou
 * d'un combat au membre, en une seule transaction Prisma. Retourne le membre a jour + le niveau
 * avant/apres (pour detecter un passage de niveau) et l'objet obtenu le cas echeant.
 */
async function applyRpgResult(guildId, userId, result) {
  const member = await getMember(userId, guildId);
  const { levelFromXp } = require("./leveling");
  const levelBefore = levelFromXp(member.xp).level;

  const data = {};
  if (result.money) data.balance = Math.max(0, member.balance + result.money);
  if (result.xp) data.xp = member.xp + result.xp;
  if (result.health) data.health = clamp(member.health + result.health, 0, MAX_HEALTH);
  if (result.energy) data.energy = clamp(member.energy + result.energy, 0, MAX_ENERGY);
  if (result.effect) data.activeEffects = withEffect(member, result.effect, 30 * 60 * 1000); // 30 min

  if (result.xp) data.level = levelFromXp(member.xp + result.xp).level;

  const updated = await prisma.member.update({ where: { id: member.id }, data });

  if (result.item) {
    await prisma.rpgInventoryItem.upsert({
      where: { memberId_itemKey: { memberId: member.id, itemKey: result.item } },
      update: { quantity: { increment: 1 } },
      create: { memberId: member.id, itemKey: result.item, quantity: 1 },
    });
  }

  return { member: updated, levelBefore, levelAfter: levelFromXp(updated.xp).level };
}

function healthBar(current, max = MAX_HEALTH, length = 10) {
  const filled = Math.round((clamp(current, 0, max) / max) * length);
  return "❤️".repeat(Math.max(0, filled)) + "🖤".repeat(length - filled);
}

function energyBar(current, max = MAX_ENERGY, length = 10) {
  const filled = Math.round((clamp(current, 0, max) / max) * length);
  return "⚡".repeat(Math.max(0, filled)) + "▫️".repeat(length - filled);
}

module.exports = { applyRpgResult, clamp, healthBar, energyBar, MAX_HEALTH, MAX_ENERGY };
