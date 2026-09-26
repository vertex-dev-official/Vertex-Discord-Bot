const { Player } = require("discord-player");
const { DefaultExtractors } = require("@discord-player/extractor");

let player;

/**
 * Initialise (une seule fois) l'instance globale de discord-player,
 * attachee au client pour etre reutilisee par toutes les commandes musique.
 */
async function initPlayer(client) {
  if (player) return player;
  player = new Player(client);

  // Les versions de discord-player exposent parfois une API differente pour charger les
  // extracteurs par defaut (YouTube/Spotify/SoundCloud/...). On essaie la methode recommandee,
  // puis on se rabat sur l'ancienne, et on n'empeche jamais le reste du bot de demarrer si
  // les deux echouent (la musique sera juste indisponible, sans planter les autres commandes).
  try {
    if (typeof player.extractors.loadDefault === "function") {
      await player.extractors.loadDefault();
    } else if (typeof player.extractors.loadMulti === "function") {
      await player.extractors.loadMulti(DefaultExtractors);
    } else {
      throw new Error("Aucune methode de chargement des extracteurs trouvee sur cette version de discord-player.");
    }
  } catch (err) {
    console.error("[player] Impossible de charger les extracteurs audio (YouTube/Spotify/SoundCloud). La musique sera indisponible tant que ce n'est pas resolu.", err.message);
  }

  player.events.on("playerStart", (queue, track) => {
    queue.metadata?.channel?.send(`▶️ Lecture en cours : **${track.title}**`).catch(() => {});
  });
  player.events.on("emptyQueue", (queue) => {
    queue.metadata?.channel?.send("🏁 File d'attente terminee.").catch(() => {});
  });
  player.events.on("error", (queue, error) => console.error("[player error]", error));
  player.events.on("playerError", (queue, error) => console.error("[player error]", error));

  return player;
}

function getPlayer() {
  return player;
}

module.exports = { initPlayer, getPlayer };
