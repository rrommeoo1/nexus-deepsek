export const STICKER_CATEGORIES = Object.freeze(['Recommended', 'GIF', 'Emoji', 'Funny', 'Reactions', 'Love', 'Animals', 'Food', 'Travel', 'Celebration', 'Memes', 'Weather', 'Time', 'Location']);

const THEMES = Object.freeze({
  Recommended: ['🔥','✨','💫','🚀','💜','⭐','🌈','🪩','⚡','🎯','💎','🫶'],
  GIF: ['WOW','LOL','YES!','MOOD','NICE','OMG','HEY','GO!','FUN','LOVE','COOL','WILD'],
  Emoji: ['😀','😍','😎','🥳','🤩','😇','🥹','😴','🤯','🫡','🤗','🫢'], Funny: ['😂','🤣','🤪','😜','🙃','🫠','🥸','🤡','👻','💩','🙈','🦄'],
  Reactions: ['👍','👏','🙌','💪','👀','💯','🤝','🙏','🫶','🤌','✌️','👌'], Love: ['❤️','💗','💖','💕','💘','💝','💞','💟','😘','🥰','🌹','🫂'],
  Animals: ['🐶','🐱','🐼','🦊','🐵','🐸','🦁','🐯','🐰','🐨','🦋','🐙'], Food: ['🍕','🍔','🍟','🌮','🍣','🍩','🍰','🍓','🥑','☕','🍹','🍿'],
  Travel: ['✈️','🚗','🚆','🛵','⛵','🏝️','🏔️','🗺️','🧳','📸','🌍','🧭'], Celebration: ['🎉','🎊','🥂','🎂','🎁','🎈','🏆','🥇','🎆','🎇','🪅','🕺'],
  Memes: ['SIDE EYE','NOPE','SAME','BRUH','ICONIC','CHAOS','OKAY','SUS','VIBE','POV','SLAY','REAL'], Weather: ['☀️','🌤️','⛅','🌧️','⛈️','❄️','🌪️','🌈','🌙','🌊','💨','☔'],
  Time: ['NOW','LIVE','TODAY','LATE','EARLY','AM','PM','WEEKEND','NIGHT','DAY','SOON','PAST'], Location: ['📍','🗺️','🏠','🏙️','🌆','🏨','🍽️','☕','🏖️','🏞️','🎡','🛣️'],
});
const COLORS = Object.freeze([['#ff315c','#ff9b43'],['#7647ff','#19d3cf'],['#0f172a','#475569'],['#ff48c4','#834dff'],['#00b894','#ffeaa7'],['#f6d365','#fda085'],['#30cfd0','#330867'],['#fa709a','#fee140']]);
const SHAPES = Object.freeze(['blob','burst','pill','cloud','badge','ring','tile','splash']);
const CAPTIONS = Object.freeze(['','WOW','LOL','YES','MOOD','NICE','OMG','HEY','GO!','FUN','LOVE','COOL']);
export const STICKER_CATALOG_SIZE = STICKER_CATEGORIES.length * 12 * COLORS.length * SHAPES.length * CAPTIONS.length;

function escapeSvg(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;' })[character]); }
function shapeMarkup(shape) {
  if (shape === 'pill') return '<rect x="10" y="32" width="140" height="96" rx="48" fill="url(#g)"/>';
  if (shape === 'ring') return '<circle cx="80" cy="80" r="58" fill="none" stroke="url(#g)" stroke-width="18"/><circle cx="80" cy="80" r="42" fill="#171717aa"/>';
  if (shape === 'tile') return '<rect x="18" y="18" width="124" height="124" rx="30" fill="url(#g)" transform="rotate(-7 80 80)"/>';
  if (shape === 'burst') return '<path d="M80 5 96 34 128 18 126 52 158 55 133 80 158 105 126 108 128 142 96 126 80 155 64 126 32 142 34 108 2 105 27 80 2 55 34 52 32 18 64 34Z" fill="url(#g)"/>';
  if (shape === 'cloud') return '<path d="M31 119c-22 0-30-29-12-41-5-29 31-46 50-27 17-28 62-14 60 20 29 3 28 48-3 48Z" fill="url(#g)"/>';
  if (shape === 'badge') return '<path d="M80 8c18 0 25 15 38 23 15 8 32 5 38 21 6 17-8 27-10 43-2 17 8 31-5 43-13 12-28 2-45 7-16 5-26 20-42 12-16-8-12-26-22-39C22 104 4 99 5 81c1-18 20-22 31-35C47 33 47 8 80 8Z" fill="url(#g)"/>';
  if (shape === 'splash') return '<path d="M15 91c17-13 12-29 27-39 13-9 25 2 40-14 16-18 39-6 39 13 0 13 25 11 25 31 0 19-18 21-26 34-11 19-27 4-43 15-18 12-33-3-31-18-16 1-43-4-31-22Z" fill="url(#g)"/>';
  return '<path d="M30 30c25-23 45-10 50 0 12-24 54-19 54 15 25 8 17 43 1 48 12 31-30 46-49 26-17 28-57 16-54-14-29-5-30-44-8-51-12-13-6-17 6-24Z" fill="url(#g)"/>';
}
function stickerSvg({ seed, caption, colors, shape, animated }) {
  const label = escapeSvg(caption || seed); const emojiOnly = /[^\p{L}\p{N}!?. ]/u.test(seed); const content = emojiOnly ? escapeSvg(seed) : escapeSvg(caption || seed);
  const fontSize = emojiOnly ? 58 : Math.max(20, 40 - content.length); const motion = animated ? '<style>@keyframes p{50%{transform:scale(1.08) rotate(2deg)}}.m{transform-origin:80px 80px;animation:p .8s ease-in-out infinite}</style>' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">${motion}<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient><filter id="s"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity=".45"/></filter></defs><g class="m" filter="url(#s)">${shapeMarkup(shape)}<text x="80" y="90" text-anchor="middle" fill="white" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="900" stroke="#111" stroke-width="2" paint-order="stroke">${content}</text>${caption && emojiOnly ? `<text x="80" y="124" text-anchor="middle" fill="white" font-family="system-ui,sans-serif" font-size="17" font-weight="900" stroke="#111" stroke-width="3" paint-order="stroke">${label}</text>` : ''}</g></svg>`;
}
function svgData(value) { return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`; }

function stickerAt(category, index, withImage = true) {
  const seeds = THEMES[category] || THEMES.Recommended; const seed = seeds[index % seeds.length]; const colors = COLORS[Math.floor(index / seeds.length) % COLORS.length];
  const shape = SHAPES[Math.floor(index / (seeds.length * COLORS.length)) % SHAPES.length]; const caption = CAPTIONS[Math.floor(index / (seeds.length * COLORS.length * SHAPES.length)) % CAPTIONS.length];
  const animated = category === 'GIF' || index % 9 === 0; const id = `${category.toLowerCase()}-${index}`;
  const item = { id, assetId: id, category, content: seed, label: `${category} ${seed} ${caption || 'sticker'}`, animated };
  return Object.freeze(withImage ? { ...item, image: svgData(stickerSvg({ seed, caption, colors, shape, animated })) } : item);
}

export function stickerById(id) {
  const match = /^([a-z]+)-(\d+)$/.exec(String(id || '')); if (!match) return null;
  const category = STICKER_CATEGORIES.find((entry) => entry.toLowerCase() === match[1]); return category ? stickerAt(category, Number(match[2])) : null;
}

export function stickerCatalogPage({ category = 'Recommended', query = '', page = 0, pageSize = 48 } = {}) {
  const safePage = Math.max(0, Math.floor(Number(page) || 0)); const safeSize = Math.max(12, Math.min(72, Math.floor(Number(pageSize) || 48)));
  const normalized = String(query || '').normalize('NFKC').trim().toLowerCase(); const categories = category === 'All' ? STICKER_CATEGORIES : STICKER_CATEGORIES.includes(category) ? [category] : ['Recommended']; const matches = [];
  for (const group of categories) for (let index = 0; index < 12 * COLORS.length * SHAPES.length * CAPTIONS.length; index += 1) { const sticker = stickerAt(group, index, false); if (!normalized || sticker.label.toLowerCase().includes(normalized)) matches.push(sticker); }
  const start = safePage * safeSize; const items = matches.slice(start, start + safeSize).map((item) => stickerAt(item.category, Number(item.id.slice(item.id.lastIndexOf('-') + 1)))); return Object.freeze({ items, page: safePage, total: matches.length, hasMore: start + safeSize < matches.length });
}
