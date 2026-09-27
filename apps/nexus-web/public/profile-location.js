// Nexus profile location — the city the owner chose for this profile.
//
// Honest boundaries: there is no geolocation call, no IP lookup and no network request here. The
// suggestions come from a small built-in list of city names, and a name that is not in it can still
// be used exactly as typed. Nothing in this file reads the device position.
const GAZETTEER = Object.freeze([
  // Romania first: the picker is meant to be useful where the app is being built and read.
  'Alba Iulia, România', 'Arad, România', 'Bacău, România', 'Baia Mare, România', 'Bistrița, România',
  'Botoșani, România', 'Brașov, România', 'Brăila, România', 'București, România', 'Buzău, România',
  'Cluj-Napoca, România', 'Constanța, România', 'Craiova, România', 'Deva, România', 'Drobeta-Turnu Severin, România',
  'Focșani, România', 'Galați, România', 'Giurgiu, România', 'Iași, România', 'Miercurea Ciuc, România',
  'Oradea, România', 'Pitești, România', 'Ploiești, România', 'Reșița, România', 'Satu Mare, România',
  'Sfântu Gheorghe, România', 'Sibiu, România', 'Slatina, România', 'Slobozia, România', 'Suceava, România',
  'Târgu Jiu, România', 'Târgu Mureș, România', 'Timișoara, România', 'Tulcea, România', 'Vaslui, România',
  'Zalău, România', 'Alexandria, România', 'Bârlad, România', 'Mediaș, România', 'Sighișoara, România',
  'Sinaia, România', 'Bragadiru, România', 'Otopeni, România',
  // Europe
  'Chișinău, Moldova', 'Tiraspol, Moldova', 'Bălți, Moldova', 'Sofia, Bulgaria', 'Varna, Bulgaria',
  'Burgas, Bulgaria', 'Ruse, Bulgaria', 'Budapesta, Ungaria', 'Debrecen, Ungaria', 'Szeged, Ungaria',
  'Belgrad, Serbia', 'Novi Sad, Serbia', 'Niș, Serbia', 'Zagreb, Croația', 'Split, Croația',
  'Ljubljana, Slovenia', 'Sarajevo, Bosnia și Herțegovina', 'Skopje, Macedonia de Nord', 'Podgorica, Muntenegru',
  'Tirana, Albania', 'Atena, Grecia', 'Salonic, Grecia', 'Istanbul, Turcia', 'Ankara, Turcia',
  'Viena, Austria', 'Salzburg, Austria', 'Graz, Austria', 'Praga, Cehia', 'Brno, Cehia',
  'Bratislava, Slovacia', 'Košice, Slovacia', 'Varșovia, Polonia', 'Kraków, Polonia', 'Gdańsk, Polonia',
  'Wrocław, Polonia', 'Łódź, Polonia', 'Poznań, Polonia', 'Berlin, Germania', 'München, Germania',
  'Hamburg, Germania', 'Köln, Germania', 'Frankfurt, Germania', 'Stuttgart, Germania', 'Düsseldorf, Germania',
  'Leipzig, Germania', 'Dresden, Germania', 'Paris, Franța', 'Lyon, Franța', 'Marsilia, Franța',
  'Toulouse, Franța', 'Nisa, Franța', 'Bordeaux, Franța', 'Lille, Franța', 'Strasbourg, Franța',
  'Bruxelles, Belgia', 'Anvers, Belgia', 'Amsterdam, Olanda', 'Rotterdam, Olanda', 'Haga, Olanda',
  'Utrecht, Olanda', 'Copenhaga, Danemarca', 'Aarhus, Danemarca', 'Stockholm, Suedia', 'Göteborg, Suedia',
  'Malmö, Suedia', 'Oslo, Norvegia', 'Bergen, Norvegia', 'Helsinki, Finlanda', 'Tampere, Finlanda',
  'Reykjavík, Islanda', 'Dublin, Irlanda', 'Cork, Irlanda', 'Londra, Regatul Unit', 'Manchester, Regatul Unit',
  'Birmingham, Regatul Unit', 'Glasgow, Regatul Unit', 'Edinburgh, Regatul Unit', 'Cardiff, Regatul Unit',
  'Belfast, Regatul Unit', 'Lisabona, Portugalia', 'Porto, Portugalia', 'Madrid, Spania', 'Barcelona, Spania',
  'Valencia, Spania', 'Sevilia, Spania', 'Bilbao, Spania', 'Málaga, Spania', 'Roma, Italia',
  'Milano, Italia', 'Napoli, Italia', 'Torino, Italia', 'Florența, Italia', 'Veneția, Italia',
  'Bologna, Italia', 'Palermo, Italia', 'Berna, Elveția', 'Zürich, Elveția', 'Geneva, Elveția',
  'Basel, Elveția', 'Lausanne, Elveția', 'Luxemburg, Luxemburg', 'Monaco, Monaco', 'Valletta, Malta',
  'Nicosia, Cipru', 'Limassol, Cipru', 'Riga, Letonia', 'Vilnius, Lituania', 'Kaunas, Lituania',
  'Tallinn, Estonia', 'Kiev, Ucraina', 'Lviv, Ucraina', 'Odesa, Ucraina', 'Harkov, Ucraina',
  'Minsk, Belarus', 'Moscova, Rusia', 'Sankt Petersburg, Rusia', 'Tbilisi, Georgia', 'Erevan, Armenia',
  'Baku, Azerbaidjan',
  // World
  'New York, Statele Unite', 'Los Angeles, Statele Unite', 'Chicago, Statele Unite', 'San Francisco, Statele Unite',
  'Seattle, Statele Unite', 'Boston, Statele Unite', 'Austin, Statele Unite', 'Miami, Statele Unite',
  'Washington, Statele Unite', 'Toronto, Canada', 'Vancouver, Canada', 'Montreal, Canada',
  'Ciudad de México, Mexic', 'Guadalajara, Mexic', 'São Paulo, Brazilia', 'Rio de Janeiro, Brazilia',
  'Buenos Aires, Argentina', 'Santiago, Chile', 'Lima, Peru', 'Bogotá, Columbia', 'Quito, Ecuador',
  'Montevideo, Uruguay', 'Cairo, Egipt', 'Alexandria, Egipt', 'Casablanca, Maroc', 'Rabat, Maroc',
  'Marrakech, Maroc', 'Tunis, Tunisia', 'Alger, Algeria', 'Lagos, Nigeria', 'Abuja, Nigeria',
  'Nairobi, Kenya', 'Addis Ababa, Etiopia', 'Accra, Ghana', 'Dakar, Senegal', 'Cape Town, Africa de Sud',
  'Johannesburg, Africa de Sud', 'Pretoria, Africa de Sud', 'Dubai, Emiratele Arabe Unite', 'Abu Dhabi, Emiratele Arabe Unite',
  'Doha, Qatar', 'Riad, Arabia Saudită', 'Jeddah, Arabia Saudită', 'Kuweit, Kuweit', 'Amman, Iordania',
  'Beirut, Liban', 'Damasc, Siria', 'Bagdad, Irak', 'Teheran, Iran', 'Tel Aviv, Israel',
  'Ierusalim, Israel', 'Delhi, India', 'Mumbai, India', 'Bengaluru, India', 'Chennai, India',
  'Kolkata, India', 'Hyderabad, India', 'Karachi, Pakistan', 'Lahore, Pakistan', 'Islamabad, Pakistan',
  'Dhaka, Bangladesh', 'Colombo, Sri Lanka', 'Kathmandu, Nepal', 'Bangkok, Thailanda', 'Phuket, Thailanda',
  'Singapore, Singapore', 'Kuala Lumpur, Malaysia', 'Jakarta, Indonezia', 'Bali, Indonezia', 'Manila, Filipine',
  'Hanoi, Vietnam', 'Ho Chi Minh, Vietnam', 'Phnom Penh, Cambodgia', 'Yangon, Myanmar', 'Hong Kong, China',
  'Shanghai, China', 'Beijing, China', 'Shenzhen, China', 'Taipei, Taiwan', 'Seoul, Coreea de Sud',
  'Busan, Coreea de Sud', 'Tokyo, Japonia', 'Osaka, Japonia', 'Kyoto, Japonia', 'Sydney, Australia',
  'Melbourne, Australia', 'Brisbane, Australia', 'Perth, Australia', 'Auckland, Noua Zeelandă', 'Wellington, Noua Zeelandă',
  'Honolulu, Statele Unite', 'Anchorage, Statele Unite', 'Nuuk, Groenlanda', 'Ulaanbaatar, Mongolia', 'Almaty, Kazahstan',
  'Tașkent, Uzbekistan',
]);

// People type city names in whichever language they think in, so the names that differ most between
// English and the label in this list are searchable too. The saved value is always the city label.
const ALIASES = Object.freeze({
  bucharest: 'București, România', bucuresti: 'București, România',
  vienna: 'Viena, Austria', munich: 'München, Germania', munchen: 'München, Germania',
  copenhagen: 'Copenhaga, Danemarca', zurich: 'Zürich, Elveția', warsaw: 'Varșovia, Polonia', varsovia: 'Varșovia, Polonia',
  krakow: 'Kraków, Polonia', rome: 'Roma, Italia', milan: 'Milano, Italia', naples: 'Napoli, Italia',
  florence: 'Florența, Italia', venice: 'Veneția, Italia', athens: 'Atena, Grecia', thessaloniki: 'Salonic, Grecia',
  moscow: 'Moscova, Rusia', kiev: 'Kiev, Ucraina', kyiv: 'Kiev, Ucraina', prague: 'Praga, Cehia',
  brussels: 'Bruxelles, Belgia', lisbon: 'Lisabona, Portugalia', seville: 'Sevilia, Spania', turin: 'Torino, Italia',
  gothenburg: 'Göteborg, Suedia',
});

// Typing "Buch" has to find "București" and typing "Bucharest" has to find "București" too, so the
// search folds case and diacritics before it compares anything.
export function foldLocation(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const INDEX = GAZETTEER.map((city) => {
  const keys = [foldLocation(city)];
  for (const [alias, target] of Object.entries(ALIASES)) if (target === city) keys.push(alias);
  return { city, keys };
});

// Ranked by where the match is, then by how short the name is: "Ia" should offer "Iași" before
// "Ierusalim", and an exact name always comes first.
export function searchLocations(query, limit = 6) {
  const needle = foldLocation(query);
  if (!needle) return [];
  const scored = [];
  for (const entry of INDEX) {
    let best = null;
    for (const key of entry.keys) {
      const at = key.indexOf(needle);
      if (at === -1) continue;
      const rank = at === 0 ? 0 : (key[at - 1] === ' ' || key[at - 1] === ',' ? 1 : 2);
      if (best === null || rank < best) best = rank;
    }
    if (best === null) continue;
    scored.push([best, foldLocation(entry.city).length, entry.city]);
  }
  scored.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2].localeCompare(b[2]));
  return scored.slice(0, Math.max(1, Math.min(Number(limit) || 6, 8))).map((entry) => entry[2]);
}

export function profileLocationLabel(location, fallback) {
  const value = String(location ?? '').trim();
  return value || fallback;
}

// The panel is built when it is opened, not when the profile renders: a closed profile carries no
// input, no listbox and no hidden options.
export function locationPickerMarkup({ esc, t }) {
  return '<div class="ownerLocationPanel" data-owner-location-panel hidden>'
    + '<label class="ownerLocationField"><span hidden>' + esc(t('profile.locationSearch')) + '</span>'
    + '<input type="text" maxlength="80" autocomplete="off" spellcheck="false" data-owner-location-input placeholder="' + esc(t('profile.locationSearch')) + '" aria-label="' + esc(t('profile.locationSearch')) + '" /></label>'
    + '<ul class="ownerLocationList" role="listbox" aria-label="' + esc(t('profile.locationSuggestions')) + '" data-owner-location-list></ul>'
    + '<button type="button" class="ownerLocationClear" data-owner-location-clear hidden>' + esc(t('profile.locationRemove')) + '</button>'
    + '</div>';
}

function optionMarkup(esc, value, label, selected) {
  return '<li role="option" aria-selected="' + (selected ? 'true' : 'false') + '" data-owner-location-option="' + esc(value) + '"><bdi dir="auto">' + esc(label) + '</bdi></li>';
}

// The list is refreshed on every keystroke. The first row is what the person typed, so a city that
// is not in the built-in list is still usable exactly as written — the suggestions are suggestions.
export function renderLocationOptions(listElement, { esc, t, query, current }) {
  const typed = String(query ?? '').trim();
  const suggestions = searchLocations(typed, 6);
  const rows = [];
  if (typed && !suggestions.some((city) => foldLocation(city) === foldLocation(typed))) {
    rows.push(optionMarkup(esc, typed, t('profile.locationUse') + ' „' + typed + '”', false));
  }
  rows.push(...suggestions.map((city) => optionMarkup(esc, city, city, foldLocation(city) === foldLocation(current))));
  listElement.innerHTML = rows.join('') || '<li class="ownerLocationHint" role="presentation">' + esc(t('profile.locationHint')) + '</li>';
  return listElement.querySelectorAll('[data-owner-location-option]');
}

export function closeLocationPicker(host) {
  const panel = host?.querySelector('[data-owner-location-panel]');
  if (panel) panel.hidden = true;
  host?.querySelector('[data-owner-location]')?.setAttribute('aria-expanded', 'false');
}

// One open panel at a time, the input keeps focus while it is open, and the keyboard walks the
// suggestions. Nothing is saved here: the choice leaves through onSelect, and the caller decides
// whether the server accepted it before the label changes.
export function bindLocationPicker(host, { esc, t, onSelect }) {
  const row = host?.querySelector('.ownerLocationRow');
  const button = row?.querySelector('[data-owner-location]');
  const panel = row?.querySelector('[data-owner-location-panel]');
  if (!row || !button || !panel) return;
  const input = panel.querySelector('[data-owner-location-input]');
  const list = panel.querySelector('[data-owner-location-list]');
  const clear = panel.querySelector('[data-owner-location-clear]');
  const current = () => String(button.dataset.ownerLocation || '');
  const refresh = () => {
    renderLocationOptions(list, { esc, t, query: input.value, current: current() });
    clear.hidden = !current();
  };
  const open = () => {
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    input.value = '';
    refresh();
    input.focus({ preventScroll: true });
  };
  const choose = (value) => { void onSelect?.(String(value ?? '').trim()); };
  button.addEventListener('click', () => { if (panel.hidden) open(); else closeLocationPicker(host); });
  input.addEventListener('input', refresh);
  input.addEventListener('focus', refresh);
  input.addEventListener('keydown', (event) => {
    const options = [...list.querySelectorAll('[data-owner-location-option]')];
    const focused = document.activeElement;
    const index = options.indexOf(focused);
    if (event.key === 'ArrowDown' && options.length) {
      event.preventDefault();
      options[index < 0 ? 0 : (index + 1) % options.length]?.focus();
      return;
    }
    if (event.key === 'ArrowUp' && options.length) {
      event.preventDefault();
      options[index <= 0 ? options.length - 1 : index - 1]?.focus();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const target = index >= 0 ? focused : options[0];
      const value = target?.dataset?.ownerLocationOption ?? input.value;
      if (value) choose(value);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLocationPicker(host);
      button.focus({ preventScroll: true });
    }
  });
  list.addEventListener('click', (event) => {
    const option = event.target.closest?.('[data-owner-location-option]');
    if (option) choose(option.dataset.ownerLocationOption);
  });
  clear.addEventListener('click', () => choose(''));
  // Anything outside the row means the person moved on; the panel follows instead of staying open
  // over the profile.
  host.addEventListener('click', (event) => { if (!row.contains(event.target)) closeLocationPicker(host); });
}
