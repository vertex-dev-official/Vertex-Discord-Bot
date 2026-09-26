// Pool d'evenements d'aventure aleatoires, façon "/journee" ou "/aventure" de DraftBot :
// chaque evenement a un poids (frequence relative) et un effet applique au joueur.
// `result` est calcule au moment du tirage pour pouvoir varier les montants.

const ADVENTURES = [
  {
    weight: 20,
    narrate: (m) => `Tu explores les environs sans rien trouver de particulier. Ce n'est pas la journee la plus excitante...`,
    result: () => ({ money: 5, xp: 5 }),
  },
  {
    weight: 15,
    narrate: (m) => `Tu trouves une bourse abandonnee sur le chemin !`,
    result: () => ({ money: 30 + Math.floor(Math.random() * 50), xp: 8 }),
  },
  {
    weight: 12,
    narrate: (m) => `Tu aides un villageois a reparer sa charrette. Il te remercie chaleureusement.`,
    result: () => ({ money: 15, xp: 15 }),
  },
  {
    weight: 10,
    narrate: (m) => `Tu decouvres une petite grotte et y trouves un objet interessant.`,
    result: () => ({ xp: 10, item: Math.random() < 0.5 ? "eclat-de-cristal" : "piece-ancienne" }),
  },
  {
    weight: 10,
    narrate: (m) => `Tu glisses en traversant une riviere et te blesses legerement.`,
    result: () => ({ health: -15, xp: 5, effect: "blesse" }),
  },
  {
    weight: 8,
    narrate: (m) => `Un groupe de brigands te tend une embuscade et te derobe quelques pieces !`,
    result: (m) => ({ money: -Math.min(m.balance, 20 + Math.floor(Math.random() * 30)), health: -10 }),
  },
  {
    weight: 8,
    narrate: (m) => `Tu partages un repas avec des voyageurs et fais bonne fete.`,
    result: () => ({ energy: -10, xp: 5, effect: "ivre" }),
  },
  {
    weight: 8,
    narrate: (m) => `Un vieux sage te confie un conseil precieux qui t'aide a progresser.`,
    result: () => ({ xp: 25 }),
  },
  {
    weight: 5,
    narrate: (m) => `Tu trouves une vieille botte perdue au bord du chemin. Bon, au moins c'est un souvenir.`,
    result: () => ({ item: "vieille-botte", xp: 3 }),
  },
  {
    weight: 4,
    narrate: (m) => `🍀 Un trefle a quatre feuilles ! La chance te sourit pour la prochaine aventure.`,
    result: () => ({ xp: 10, effect: "chanceux" }),
  },
];

const TOTAL_WEIGHT = ADVENTURES.reduce((sum, a) => sum + a.weight, 0);

/**
 * Tire un evenement d'aventure au hasard (pondere), applique les modificateurs "ivre"/"chanceux"
 * du joueur si presents, et retourne { narration, result } ou result contient les deltas a appliquer.
 */
function rollAdventure(member, effectsLib) {
  let roll = Math.random() * TOTAL_WEIGHT;
  let chosen = ADVENTURES[0];
  for (const adventure of ADVENTURES) {
    if (roll < adventure.weight) {
      chosen = adventure;
      break;
    }
    roll -= adventure.weight;
  }

  const result = chosen.result(member);

  // Modificateurs des effets actifs du joueur au moment du tirage
  if (effectsLib.hasEffect(member, "chanceux") && result.money) result.money = Math.round(result.money * 1.5);
  if (effectsLib.hasEffect(member, "ivre") && result.money) result.money = Math.round(result.money * 0.6);

  return { narration: chosen.narrate(member), result };
}

module.exports = { rollAdventure };
