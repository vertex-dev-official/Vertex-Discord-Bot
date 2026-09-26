// Catalogue statique des objets RPG (aventures/combats/familiers). Pas de configuration
// admin necessaire : ce sont des objets de jeu fixes, comme dans DraftBot.
const ITEMS = {
  "potion-sante": { name: "Potion de sante", emoji: "🧪", description: "Restaure 40 PV.", type: "consumable", heal: 40 },
  "grande-potion-sante": { name: "Grande potion de sante", emoji: "🍶", description: "Restaure 100 PV.", type: "consumable", heal: 100 },
  ration: { name: "Ration de voyage", emoji: "🍖", description: "Restaure 30 points d'energie.", type: "consumable", energy: 30 },
  croquettes: { name: "Croquettes", emoji: "🦴", description: "Nourrit ton familier (+15 affection, -30 faim).", type: "pet-food", affection: 15, hunger: -30 },
  "amulette-chance": { name: "Amulette de chance", emoji: "🍀", description: "Un porte-bonheur. Objet de collection.", type: "trophy" },
  "eclat-de-cristal": { name: "Eclat de cristal", emoji: "💎", description: "Un materiau rare trouve en aventure.", type: "material" },
  "vieille-botte": { name: "Vieille botte", emoji: "🥾", description: "Ne sert a rien, mais on ne sait jamais.", type: "material" },
  "piece-ancienne": { name: "Piece ancienne", emoji: "🪙", description: "Une monnaie oubliee. Se revend cher au marche noir.", type: "material" },
};

function getItem(key) {
  return ITEMS[key] || null;
}

function formatItemLine(key, quantity) {
  const item = getItem(key);
  if (!item) return `❓ Objet inconnu (${key}) x${quantity}`;
  return `${item.emoji} **${item.name}** x${quantity} — *${item.description}*`;
}

module.exports = { ITEMS, getItem, formatItemLine };
