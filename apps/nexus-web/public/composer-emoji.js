export const emojiGroups = [
  ['😀', 'faces smile happy sad fete zambet trist emoții', '😀 😃 😄 😁 😆 😅 😂 🤣 😊 🙂 🙃 😉 😍 🥰 😘 😋 😎 🤩 🥳 😏 😌 😔 😢 😭 😤 😠 🤬 😱 😨 😰 😥 😓 🤔 🫡 🤗 🤭 🫢 🤫 🫠 🙄 😴 🥱 🤒 🤕 🤢 🤮 🤧 😷'],
  ['👋', 'people hands gestures oameni maini gesturi', '👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🙏 💪 🫶'],
  ['❤️', 'hearts love symbols dragoste inima iubire simboluri', '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 💕 💞 💓 💗 💖 💘 💝 💟 💯 ✅ ❌ ❓ ❗ 💬 💭 🔔 🎵 🎶 ✨ ⭐ 🌟 💫 🔥 🎉 🎊 🎁'],
  ['🌿', 'nature food travel natura mancare calatorie', '🌿 🌱 🌲 🌳 🌴 🌵 🌷 🌸 🌹 🌻 🌼 🍀 🐶 🐱 🐼 🦊 🐻 🦋 🐝 🌞 🌙 🌈 ☀️ 🌧️ ❄️ 🌊 🍎 🍓 🍕 🍔 🍰 ☕ 🍵 🥂 🏠 🚗 ✈️ 🚲 ⛰️ 🏖️ 📷 🎧 ⚽ 🎮'],
];
export function searchEmojis(query = '', category = -1) {
  const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const q = fold(query.trim());
  return emojiGroups.flatMap(([icon, words, values], index) => category !== -1 && category !== index ? [] : !q || fold(words).includes(q) ? values.split(' ') : values.split(' ').filter((emoji) => emoji.includes(q)));
}
export function mountEmojiPicker(palette, { choose, t }) {
  let category = -1; const recent = [];
  const search = document.createElement('input'); search.type = 'search'; search.placeholder = t('composer.searchEmoji'); search.setAttribute('aria-label', t('composer.searchEmoji')); search.maxLength = 80;
  const tabs = document.createElement('div'); tabs.className = 'emojiTabs';
  const grid = document.createElement('div'); grid.className = 'emojiGrid';
  const paint = () => { grid.innerHTML = ''; const values = category === -2 ? recent : searchEmojis(search.value, category); for (const value of values) { const button = document.createElement('button'); button.type = 'button'; button.textContent = value; button.onclick = () => { const old = recent.indexOf(value); if (old !== -1) recent.splice(old, 1); recent.unshift(value); recent.length = Math.min(recent.length, 24); choose(value); }; grid.append(button); } };
  for (const [index, label] of [[-1, '☺'], [-2, '◷'], ...emojiGroups.map((g, i) => [i, g[0]])]) { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.setAttribute('aria-label', t('composer.emojiCategory' + index)); button.setAttribute('aria-pressed', String(index === -1)); button.onclick = () => { category = index; for (const item of tabs.children) item.setAttribute('aria-pressed', String(item === button)); paint(); }; tabs.append(button); }
  search.oninput = paint;
  search.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); } });
  palette.append(search, tabs, grid); paint();
}
