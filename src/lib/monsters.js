// Pool de monstres pour /combat (PvE), façon bestiaire DraftBot : plus le monstre est fort,
// plus il rapporte, mais plus il fait mal en cas de defaite.
const MONSTERS = [
  { name: "Rat geant", emoji: "🐀", health: 25, damageMin: 3, damageMax: 8, xp: 10, money: 8, minLevel: 0 },
  { name: "Gobelin", emoji: "👺", health: 40, damageMin: 5, damageMax: 12, xp: 18, money: 15, minLevel: 0 },
  { name: "Loup sauvage", emoji: "🐺", health: 55, damageMin: 8, damageMax: 15, xp: 25, money: 20, minLevel: 2 },
  { name: "Squelette", emoji: "💀", health: 70, damageMin: 10, damageMax: 18, xp: 35, money: 30, minLevel: 3 },
  { name: "Ogre", emoji: "👹", health: 100, damageMin: 15, damageMax: 25, xp: 55, money: 45, minLevel: 5 },
  { name: "Dragon des cavernes", emoji: "🐉", health: 160, damageMin: 20, damageMax: 35, xp: 100, money: 80, minLevel: 8 },
];

function pickMonster(memberLevel) {
  const eligible = MONSTERS.filter((m) => m.minLevel <= memberLevel);
  const pool = eligible.length ? eligible : [MONSTERS[0]];
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = { MONSTERS, pickMonster };
