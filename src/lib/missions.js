const { prisma } = require("./prisma");

// Pool de missions journalieres (comme les missions quotidiennes de DraftBot).
// `key` doit rester stable : c'est ce qui est incremente depuis les autres commandes.
const MISSION_POOL = [
  { key: "aventures", label: "Partir 3 fois a l'aventure", goal: 3, reward: { money: 40, xp: 20 } },
  { key: "combats-gagnes", label: "Gagner 2 combats", goal: 2, reward: { money: 50, xp: 25 } },
  { key: "messages", label: "Envoyer 20 messages", goal: 20, reward: { money: 20, xp: 15 } },
  { key: "daily", label: "Reclamer sa recompense quotidienne", goal: 1, reward: { money: 30, xp: 10 } },
  { key: "travail", label: "Travailler 2 fois (/work)", goal: 2, reward: { money: 35, xp: 15 } },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10); // "AAAA-MM-JJ"
}

/**
 * Retourne les 3 missions du jour pour ce membre (deterministe par jour+utilisateur pour que
 * tout le monde ne tire pas exactement le meme trio, sans avoir besoin de les stocker en base).
 */
function pickDailyMissions(userId) {
  const seed = `${todayKey()}-${userId}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;

  const pool = [...MISSION_POOL];
  const picked = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const index = hash % pool.length;
    picked.push(pool.splice(index, 1)[0]);
    hash = (hash * 7 + 13) >>> 0;
  }
  return picked;
}

/**
 * Incremente la progression d'une mission pour ce membre si elle fait partie de son trio du jour.
 * A appeler depuis les commandes concernees (aventure, combat, work, daily, messageCreate...).
 */
async function incrementMission(guildId, userId, missionKey, amount = 1) {
  const missions = pickDailyMissions(userId);
  if (!missions.some((m) => m.key === missionKey)) return; // pas une mission du jour pour ce joueur

  const member = await prisma.member.upsert({
    where: { userId_guildId: { userId, guildId } },
    update: {},
    create: { userId, guildId },
  });

  const today = todayKey();
  const progress = member.missionsDate === today ? member.missionsProgress || {} : {};
  progress[missionKey] = (progress[missionKey] || 0) + amount;

  await prisma.member.update({ where: { id: member.id }, data: { missionsDate: today, missionsProgress: progress } });
}

module.exports = { MISSION_POOL, pickDailyMissions, incrementMission, todayKey };
