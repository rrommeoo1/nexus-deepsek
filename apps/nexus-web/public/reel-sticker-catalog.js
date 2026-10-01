export const STICKER_CATEGORIES = Object.freeze(['Trending', 'Funny', 'Emoji', 'Reactions', 'Love', 'Animals', 'Food', 'Travel', 'Celebration', 'Memes', 'Weather', 'Time', 'Location']);

const SEEDS = Object.freeze({
  Trending: ['🔥','✨','💫','🚀','💜','⭐','🌈','🪩','⚡','🎯','💎','🫶'],
  Funny: ['😂','🤣','🤪','😜','🙃','🫠','🥸','🤡','👻','💩','🙈','🦄'],
  Emoji: ['😀','😍','😎','🥳','🤩','😇','🥹','😴','🤯','🫡','🤗','🫢'],
  Reactions: ['👍','👏','🙌','💪','👀','💯','🤝','🙏','🫶','🤌','✌️','👌'],
  Love: ['❤️','💗','💖','💕','💘','💝','💞','💟','😘','🥰','🌹','🫂'],
  Animals: ['🐶','🐱','🐼','🦊','🐵','🐸','🦁','🐯','🐰','🐨','🦋','🐙'],
  Food: ['🍕','🍔','🍟','🌮','🍣','🍩','🍰','🍓','🥑','☕','🍹','🍿'],
  Travel: ['✈️','🚗','🚆','🛵','⛵','🏝️','🏔️','🗺️','🧳','📸','🌍','🧭'],
  Celebration: ['🎉','🎊','🥂','🎂','🎁','🎈','🏆','🥇','🎆','🎇','🪅','🕺'],
  Memes: ['👁️','🗿','🐸','☕','💀','🧠','🤨','😏','🙄','🫨','🧐','🫣'],
  Weather: ['☀️','🌤️','⛅','🌧️','⛈️','❄️','🌪️','🌈','🌙','🌊','💨','☔'],
  Time: ['⏰','⌛','⏳','🕐','🕕','🕛','📅','🗓️','⏱️','🕰️','🌅','🌃'],
  Location: ['📍','🗺️','🏠','🏙️','🌆','🏨','🍽️','☕','🏖️','🏞️','🎡','🛣️'],
});
const FRAMES = Object.freeze(['','✨','💥','💫','⭐','🌈','🔥','💜','💙','💚','💛','🧡','🤍','🖤','〰️','‼️','❣️','➕','🔸','🔹']);
const BADGES = Object.freeze(['','WOW','LOL','YES','MOOD','NICE','OMG','HEY','GO!','FUN','LOVE','COOL']);
export const STICKER_CATALOG_SIZE = STICKER_CATEGORIES.length * 12 * FRAMES.length * BADGES.length;

function stickerAt(category, index) {
  const seeds = SEEDS[category] || SEEDS.Trending;
  const seed = seeds[index % seeds.length];
  const frame = FRAMES[Math.floor(index / seeds.length) % FRAMES.length];
  const badge = BADGES[Math.floor(index / (seeds.length * FRAMES.length)) % BADGES.length];
  const content = `${frame}${seed}${badge ? ` ${badge}` : ''}${frame}`;
  return Object.freeze({ id: `${category.toLowerCase()}-${index}`, category, content, label: `${category} ${seed} ${badge || 'sticker'}` });
}

export function stickerCatalogPage({ category = 'Trending', query = '', page = 0, pageSize = 48 } = {}) {
  const safePage = Math.max(0, Math.floor(Number(page) || 0)); const safeSize = Math.max(12, Math.min(72, Math.floor(Number(pageSize) || 48)));
  const normalized = String(query || '').normalize('NFKC').trim().toLowerCase();
  const categories = category === 'All' ? STICKER_CATEGORIES : STICKER_CATEGORIES.includes(category) ? [category] : ['Trending'];
  const matches = [];
  for (const group of categories) {
    const count = 12 * FRAMES.length * BADGES.length;
    for (let index = 0; index < count; index += 1) {
      const sticker = stickerAt(group, index);
      if (!normalized || `${sticker.label} ${sticker.content}`.toLowerCase().includes(normalized)) matches.push(sticker);
    }
  }
  const start = safePage * safeSize;
  return Object.freeze({ items: matches.slice(start, start + safeSize), page: safePage, total: matches.length, hasMore: start + safeSize < matches.length });
}
