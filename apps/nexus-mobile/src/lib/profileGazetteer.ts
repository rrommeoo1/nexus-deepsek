/**
 * The city names a profile's location field suggests, transcribed from
 * `apps/nexus-web/public/profile-location.js` (wave 6g). Nothing here reads the device position and
 * nothing asks the network: the list is built in, and a name that is not in it is still usable
 * exactly as it was typed - the suggestions are suggestions.
 *
 * The search folds case and diacritics before it compares anything (`foldLocation`) and ranks the
 * answers by where the match sits and how short the name is (`searchLocations`), so "Buch" finds
 * "Bucure\u0219ti" and "Bucharest" finds it too through \`ALIASES\`. Both functions are copies of the
 * module's own, value for value.
 */
export const GAZETTEER = Object.freeze([
  "Alba Iulia, România", "Arad, România", "Bacău, România", "Baia Mare, România", "Bistrița, România",
  "Botoșani, România", "Brașov, România", "Brăila, România", "București, România", "Buzău, România",
  "Cluj-Napoca, România", "Constanța, România", "Craiova, România", "Deva, România",
  "Drobeta-Turnu Severin, România", "Focșani, România", "Galați, România", "Giurgiu, România",
  "Iași, România", "Miercurea Ciuc, România", "Oradea, România", "Pitești, România", "Ploiești, România",
  "Reșița, România", "Satu Mare, România", "Sfântu Gheorghe, România", "Sibiu, România",
  "Slatina, România", "Slobozia, România", "Suceava, România", "Târgu Jiu, România",
  "Târgu Mureș, România", "Timișoara, România", "Tulcea, România", "Vaslui, România", "Zalău, România",
  "Alexandria, România", "Bârlad, România", "Mediaș, România", "Sighișoara, România", "Sinaia, România",
  "Bragadiru, România", "Otopeni, România", "Chișinău, Moldova", "Tiraspol, Moldova", "Bălți, Moldova",
  "Sofia, Bulgaria", "Varna, Bulgaria", "Burgas, Bulgaria", "Ruse, Bulgaria", "Budapesta, Ungaria",
  "Debrecen, Ungaria", "Szeged, Ungaria", "Belgrad, Serbia", "Novi Sad, Serbia", "Niș, Serbia",
  "Zagreb, Croația", "Split, Croația", "Ljubljana, Slovenia", "Sarajevo, Bosnia și Herțegovina",
  "Skopje, Macedonia de Nord", "Podgorica, Muntenegru", "Tirana, Albania", "Atena, Grecia",
  "Salonic, Grecia", "Istanbul, Turcia", "Ankara, Turcia", "Viena, Austria", "Salzburg, Austria",
  "Graz, Austria", "Praga, Cehia", "Brno, Cehia", "Bratislava, Slovacia", "Košice, Slovacia",
  "Varșovia, Polonia", "Kraków, Polonia", "Gdańsk, Polonia", "Wrocław, Polonia", "Łódź, Polonia",
  "Poznań, Polonia", "Berlin, Germania", "München, Germania", "Hamburg, Germania", "Köln, Germania",
  "Frankfurt, Germania", "Stuttgart, Germania", "Düsseldorf, Germania", "Leipzig, Germania",
  "Dresden, Germania", "Paris, Franța", "Lyon, Franța", "Marsilia, Franța", "Toulouse, Franța",
  "Nisa, Franța", "Bordeaux, Franța", "Lille, Franța", "Strasbourg, Franța", "Bruxelles, Belgia",
  "Anvers, Belgia", "Amsterdam, Olanda", "Rotterdam, Olanda", "Haga, Olanda", "Utrecht, Olanda",
  "Copenhaga, Danemarca", "Aarhus, Danemarca", "Stockholm, Suedia", "Göteborg, Suedia", "Malmö, Suedia",
  "Oslo, Norvegia", "Bergen, Norvegia", "Helsinki, Finlanda", "Tampere, Finlanda", "Reykjavík, Islanda",
  "Dublin, Irlanda", "Cork, Irlanda", "Londra, Regatul Unit", "Manchester, Regatul Unit",
  "Birmingham, Regatul Unit", "Glasgow, Regatul Unit", "Edinburgh, Regatul Unit",
  "Cardiff, Regatul Unit", "Belfast, Regatul Unit", "Lisabona, Portugalia", "Porto, Portugalia",
  "Madrid, Spania", "Barcelona, Spania", "Valencia, Spania", "Sevilia, Spania", "Bilbao, Spania",
  "Málaga, Spania", "Roma, Italia", "Milano, Italia", "Napoli, Italia", "Torino, Italia",
  "Florența, Italia", "Veneția, Italia", "Bologna, Italia", "Palermo, Italia", "Berna, Elveția",
  "Zürich, Elveția", "Geneva, Elveția", "Basel, Elveția", "Lausanne, Elveția", "Luxemburg, Luxemburg",
  "Monaco, Monaco", "Valletta, Malta", "Nicosia, Cipru", "Limassol, Cipru", "Riga, Letonia",
  "Vilnius, Lituania", "Kaunas, Lituania", "Tallinn, Estonia", "Kiev, Ucraina", "Lviv, Ucraina",
  "Odesa, Ucraina", "Harkov, Ucraina", "Minsk, Belarus", "Moscova, Rusia", "Sankt Petersburg, Rusia",
  "Tbilisi, Georgia", "Erevan, Armenia", "Baku, Azerbaidjan", "New York, Statele Unite",
  "Los Angeles, Statele Unite", "Chicago, Statele Unite", "San Francisco, Statele Unite",
  "Seattle, Statele Unite", "Boston, Statele Unite", "Austin, Statele Unite", "Miami, Statele Unite",
  "Washington, Statele Unite", "Toronto, Canada", "Vancouver, Canada", "Montreal, Canada",
  "Ciudad de México, Mexic", "Guadalajara, Mexic", "São Paulo, Brazilia", "Rio de Janeiro, Brazilia",
  "Buenos Aires, Argentina", "Santiago, Chile", "Lima, Peru", "Bogotá, Columbia", "Quito, Ecuador",
  "Montevideo, Uruguay", "Cairo, Egipt", "Alexandria, Egipt", "Casablanca, Maroc", "Rabat, Maroc",
  "Marrakech, Maroc", "Tunis, Tunisia", "Alger, Algeria", "Lagos, Nigeria", "Abuja, Nigeria",
  "Nairobi, Kenya", "Addis Ababa, Etiopia", "Accra, Ghana", "Dakar, Senegal", "Cape Town, Africa de Sud",
  "Johannesburg, Africa de Sud", "Pretoria, Africa de Sud", "Dubai, Emiratele Arabe Unite",
  "Abu Dhabi, Emiratele Arabe Unite", "Doha, Qatar", "Riad, Arabia Saudită", "Jeddah, Arabia Saudită",
  "Kuweit, Kuweit", "Amman, Iordania", "Beirut, Liban", "Damasc, Siria", "Bagdad, Irak", "Teheran, Iran",
  "Tel Aviv, Israel", "Ierusalim, Israel", "Delhi, India", "Mumbai, India", "Bengaluru, India",
  "Chennai, India", "Kolkata, India", "Hyderabad, India", "Karachi, Pakistan", "Lahore, Pakistan",
  "Islamabad, Pakistan", "Dhaka, Bangladesh", "Colombo, Sri Lanka", "Kathmandu, Nepal",
  "Bangkok, Thailanda", "Phuket, Thailanda", "Singapore, Singapore", "Kuala Lumpur, Malaysia",
  "Jakarta, Indonezia", "Bali, Indonezia", "Manila, Filipine", "Hanoi, Vietnam", "Ho Chi Minh, Vietnam",
  "Phnom Penh, Cambodgia", "Yangon, Myanmar", "Hong Kong, China", "Shanghai, China", "Beijing, China",
  "Shenzhen, China", "Taipei, Taiwan", "Seoul, Coreea de Sud", "Busan, Coreea de Sud", "Tokyo, Japonia",
  "Osaka, Japonia", "Kyoto, Japonia", "Sydney, Australia", "Melbourne, Australia", "Brisbane, Australia",
  "Perth, Australia", "Auckland, Noua Zeelandă", "Wellington, Noua Zeelandă", "Honolulu, Statele Unite",
  "Anchorage, Statele Unite", "Nuuk, Groenlanda", "Ulaanbaatar, Mongolia", "Almaty, Kazahstan",
  "Tașkent, Uzbekistan",
]);

/** The names that differ most between English and the label in the list, so both are searchable. */
export const LOCATION_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  bucharest: "București, România",
  bucuresti: "București, România",
  vienna: "Viena, Austria",
  munich: "München, Germania",
  munchen: "München, Germania",
  copenhagen: "Copenhaga, Danemarca",
  zurich: "Zürich, Elveția",
  warsaw: "Varșovia, Polonia",
  varsovia: "Varșovia, Polonia",
  krakow: "Kraków, Polonia",
  rome: "Roma, Italia",
  milan: "Milano, Italia",
  naples: "Napoli, Italia",
  florence: "Florența, Italia",
  venice: "Veneția, Italia",
  athens: "Atena, Grecia",
  thessaloniki: "Salonic, Grecia",
  moscow: "Moscova, Rusia",
  kiev: "Kiev, Ucraina",
  kyiv: "Kiev, Ucraina",
  prague: "Praga, Cehia",
  brussels: "Bruxelles, Belgia",
  lisbon: "Lisabona, Portugalia",
  seville: "Sevilia, Spania",
  turin: "Torino, Italia",
  gothenburg: "Göteborg, Suedia",
});

/** Typing "Buch" has to find "Bucure\u0219ti" and typing "Bucharest" has to find it too. */
export function foldLocation(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every city with the keys it can be found by: its own folded label, and the aliases that point at it. */
const INDEX = GAZETTEER.map((city) => {
  const keys = [foldLocation(city)];
  for (const [alias, target] of Object.entries(LOCATION_ALIASES)) if (target === city) keys.push(alias);
  return { city, keys };
});

/**
 * Ranked by where the match is, then by how short the name is: "Ia" should offer "Ia\u0219i" before
 * "Ierusalim", and an exact name always comes first. Six answers at most, as the web's panel asks.
 */
export function searchLocations(query: string, limit = 6): string[] {
  const needle = foldLocation(query);
  if (!needle) return [];
  const scored: [number, number, string][] = [];
  for (const entry of INDEX) {
    let best: number | null = null;
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

/** `profileLocationLabel`: what the field prints when the profile carries a place, and the fallback otherwise. */
export function profileLocationLabel(location: unknown, fallback: string): string {
  const value = String(location ?? '').trim();
  return value || fallback;
}
