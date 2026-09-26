// Effets de statut temporaires (comme les "alterations" de DraftBot: blesse, ivre, gele...).
// Stockes dans Member.activeEffects (Json) sous la forme [{ type, expiresAt }].

const EFFECTS = {
  blesse: { label: "🩸 Blesse", description: "Empeche de combattre le temps de se soigner." },
  gele: { label: "🥶 Gele", description: "Empeche de partir a l'aventure quelques minutes." },
  ivre: { label: "🍺 Ivre", description: "Reduit les gains de la prochaine aventure." },
  chanceux: { label: "🍀 Chanceux", description: "Ameliore les gains de la prochaine aventure." },
};

function activeEffects(member) {
  const list = Array.isArray(member.activeEffects) ? member.activeEffects : [];
  const now = Date.now();
  return list.filter((e) => !e.expiresAt || new Date(e.expiresAt).getTime() > now);
}

function hasEffect(member, type) {
  return activeEffects(member).some((e) => e.type === type);
}

/**
 * Retourne la nouvelle valeur de activeEffects (a sauvegarder telle quelle en base) avec
 * l'effet ajoute/rafraichi. durationMs = null -> effet permanent jusqu'a suppression explicite.
 */
function withEffect(member, type, durationMs) {
  const clean = activeEffects(member).filter((e) => e.type !== type);
  clean.push({ type, expiresAt: durationMs ? new Date(Date.now() + durationMs).toISOString() : null });
  return clean;
}

function withoutEffect(member, type) {
  return activeEffects(member).filter((e) => e.type !== type);
}

function formatEffects(member) {
  const list = activeEffects(member);
  if (!list.length) return "Aucun";
  return list.map((e) => EFFECTS[e.type]?.label || e.type).join(", ");
}

module.exports = { EFFECTS, activeEffects, hasEffect, withEffect, withoutEffect, formatEffects };
