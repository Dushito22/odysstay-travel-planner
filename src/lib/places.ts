/** Reference points for "what's near": big Italian cities and main airports. Coordinates are approximate
 * city centres; drive times are rough estimates from straight-line distance, labelled as such. */

export type Place = { name: string; lat: number; lng: number; kind: "city" | "airport" };

export const CITIES: Place[] = [
  ["Rome", 41.9028, 12.4964], ["Milan", 45.4642, 9.19], ["Naples", 40.8518, 14.2681], ["Turin", 45.0703, 7.6869],
  ["Palermo", 38.1157, 13.3615], ["Genoa", 44.4056, 8.9463], ["Bologna", 44.4949, 11.3426], ["Florence", 43.7696, 11.2558],
  ["Bari", 41.1171, 16.8719], ["Catania", 37.5079, 15.083], ["Venice", 45.4408, 12.3155], ["Verona", 45.4384, 10.9916],
  ["Messina", 38.1938, 15.554], ["Padua", 45.4064, 11.8768], ["Trieste", 45.6495, 13.7768], ["Brescia", 45.5416, 10.2118],
  ["Parma", 44.8015, 10.3279], ["Perugia", 43.1107, 12.3908], ["Pisa", 43.7228, 10.4017], ["Siena", 43.3188, 11.3308],
  ["Lucca", 43.8429, 10.5027], ["Lecce", 40.3515, 18.175], ["Cagliari", 39.2238, 9.1217], ["Sassari", 40.7259, 8.5557],
  ["Reggio Calabria", 38.1113, 15.6473], ["Cosenza", 39.2983, 16.2537], ["Ancona", 43.6158, 13.5189], ["Pescara", 42.4618, 14.2161],
  ["L'Aquila", 42.3498, 13.3995], ["Trento", 46.0748, 11.1217], ["Bolzano", 46.4983, 11.3548], ["Udine", 46.0711, 13.2346],
  ["Salerno", 40.6824, 14.7681], ["Taranto", 40.4644, 17.247], ["Potenza", 40.6404, 15.8056], ["Campobasso", 41.5603, 14.6627],
  ["Como", 45.8081, 9.0852], ["Bergamo", 45.6983, 9.6773], ["Rimini", 44.0678, 12.5695], ["Siracusa", 37.0755, 15.2866],
  ["Agrigento", 37.3111, 13.5765], ["Trapani", 38.0176, 12.5365], ["Matera", 40.6664, 16.6043], ["Assisi", 43.0707, 12.6196],
  ["Orvieto", 42.7185, 12.1107], ["Arezzo", 43.4633, 11.8796], ["Viterbo", 42.4207, 12.1077], ["Ravenna", 44.4184, 12.2035],
  ["Modena", 44.6471, 10.9252], ["Mantua", 45.1564, 10.7914], ["Aosta", 45.7372, 7.3201], ["Foggia", 41.4621, 15.5446],
].map(([name, lat, lng]) => ({ name: name as string, lat: lat as number, lng: lng as number, kind: "city" as const }));

export const AIRPORTS: Place[] = [
  ["Rome Fiumicino", 41.8003, 12.2389], ["Rome Ciampino", 41.7994, 12.5949], ["Milan Malpensa", 45.6301, 8.7231],
  ["Milan Linate", 45.4451, 9.2767], ["Milan Bergamo", 45.6739, 9.7042], ["Naples", 40.886, 14.2908], ["Venice", 45.5053, 12.3519],
  ["Treviso", 45.6484, 12.1944], ["Bologna", 44.5354, 11.2887], ["Florence", 43.81, 11.2051], ["Pisa", 43.6839, 10.3927],
  ["Catania", 37.4668, 15.0664], ["Palermo", 38.1759, 13.091], ["Trapani", 37.9114, 12.488], ["Comiso", 36.9946, 14.6072],
  ["Bari", 41.1389, 16.7606], ["Brindisi", 40.6576, 17.947], ["Cagliari", 39.2515, 9.0543], ["Olbia", 40.8987, 9.5176],
  ["Alghero", 40.6321, 8.2908], ["Turin", 45.2008, 7.6497], ["Genoa", 44.4133, 8.8375], ["Verona", 45.3957, 10.8885],
  ["Trieste", 45.8275, 13.4722], ["Pescara", 42.4317, 14.1811], ["Ancona", 43.6163, 13.3623], ["Perugia", 43.0959, 12.5132],
  ["Lamezia Terme", 38.9054, 16.2423], ["Reggio Calabria", 38.0712, 15.6516], ["Rimini", 44.0203, 12.6117],
].map(([name, lat, lng]) => ({ name: name as string, lat: lat as number, lng: lng as number, kind: "airport" as const }));

export function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat);
  const dLng = r(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Rough door-to-door drive: roads are ~30% longer than a straight line, ~70 km/h average outside cities. */
export function driveMinutes(straightKm: number) {
  return Math.max(5, Math.round(((straightKm * 1.3) / 70) * 60 / 5) * 5);
}

export function formatDrive(min: number, ru = false) {
  const H = ru ? "ч" : "h";
  const M = ru ? "мин" : "min";
  if (min < 60) return `${min} ${M}`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} ${H} ${m} ${M}` : `${h} ${H}`;
}

export function nearest(lat: number, lng: number, list: Place[], n: number) {
  return list
    .map((p) => ({ ...p, km: km(lat, lng, p.lat, p.lng) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n);
}

/** Russian forms of the reference cities and airports, for readers on the Russian site. */
const RU_PLACES: Record<string, string> = {
  Rome: "Рим", Milan: "Милан", Naples: "Неаполь", Turin: "Турин", Palermo: "Палермо", Genoa: "Генуя", Bologna: "Болонья",
  Florence: "Флоренция", Bari: "Бари", Catania: "Катания", Venice: "Венеция", Verona: "Верона", Messina: "Мессина",
  Padua: "Падуя", Trieste: "Триест", Brescia: "Брешиа", Parma: "Парма", Perugia: "Перуджа", Pisa: "Пиза", Siena: "Сиена",
  Lucca: "Лукка", Lecce: "Лечче", Cagliari: "Кальяри", Sassari: "Сассари", "Reggio Calabria": "Реджо-ди-Калабрия",
  Cosenza: "Козенца", Ancona: "Анкона", Pescara: "Пескара", "L'Aquila": "Л'Акуила", Trento: "Тренто", Bolzano: "Больцано",
  Udine: "Удине", Salerno: "Салерно", Taranto: "Таранто", Potenza: "Потенца", Campobasso: "Кампобассо", Como: "Комо",
  Bergamo: "Бергамо", Rimini: "Римини", Siracusa: "Сиракузы", Agrigento: "Агридженто", Trapani: "Трапани", Matera: "Матера",
  Assisi: "Ассизи", Orvieto: "Орвието", Arezzo: "Ареццо", Viterbo: "Витербо", Ravenna: "Равенна", Modena: "Модена",
  Mantua: "Мантуя", Aosta: "Аоста", Foggia: "Фоджа", Brindisi: "Бриндизи", Olbia: "Ольбия", Alghero: "Альгеро",
  Treviso: "Тревизо", Comiso: "Комизо", "Lamezia Terme": "Ламеция-Терме",
  "Rome Fiumicino": "Рим (Фьюмичино)", "Rome Ciampino": "Рим (Чампино)", "Milan Malpensa": "Милан (Мальпенса)",
  "Milan Linate": "Милан (Линате)", "Milan Bergamo": "Милан (Бергамо)",
};
export const ruPlace = (name: string) => RU_PLACES[name] ?? name;

/** Towns, shores and mountains people come to Italy for. Used to say what is within reach of a house. */
export type Gem = { name: string; lat: number; lng: number; kind: "lake" | "coast" | "mountains" | "history" | "wine" };
export const GEMS: Gem[] = ([
  ["Sirmione, Lake Garda", 45.49, 10.61, "lake"], ["Salo, Lake Garda", 45.61, 10.52, "lake"], ["Malcesine, Lake Garda", 45.77, 10.81, "lake"],
  ["Riva del Garda", 45.89, 10.84, "lake"], ["Bardolino, Lake Garda", 45.55, 10.72, "lake"], ["Bellagio, Lake Como", 45.99, 9.26, "lake"],
  ["Varenna, Lake Como", 46.01, 9.28, "lake"], ["Menaggio, Lake Como", 46.02, 9.24, "lake"], ["Stresa, Lake Maggiore", 45.88, 8.53, "lake"],
  ["Orta San Giulio", 45.8, 8.41, "lake"], ["Iseo, Lake Iseo", 45.66, 10.05, "lake"], ["Cortina d'Ampezzo", 46.54, 12.14, "mountains"],
  ["Ortisei, Dolomites", 46.57, 11.67, "mountains"], ["Corvara, Dolomites", 46.55, 11.88, "mountains"], ["Madonna di Campiglio", 46.23, 10.83, "mountains"],
  ["Courmayeur", 45.8, 6.97, "mountains"], ["Cervinia", 45.94, 7.63, "mountains"], ["Bormio", 46.47, 10.37, "mountains"],
  ["Sestriere", 44.96, 6.88, "mountains"], ["Cinque Terre", 44.15, 9.65, "coast"], ["Portofino", 44.3, 9.21, "coast"],
  ["Camogli", 44.35, 9.15, "coast"], ["Rapallo", 44.35, 9.23, "coast"], ["Alassio", 44.0, 8.17, "coast"],
  ["Sanremo", 43.82, 7.78, "coast"], ["Siena", 43.32, 11.33, "history"], ["San Gimignano", 43.47, 11.04, "history"],
  ["Montepulciano", 43.1, 11.78, "history"], ["Montalcino", 43.06, 11.49, "wine"], ["Pienza", 43.08, 11.68, "history"],
  ["Cortona", 43.28, 11.99, "history"], ["Greve in Chianti", 43.58, 11.31, "wine"], ["Lucca", 43.84, 10.5, "history"],
  ["Assisi", 43.07, 12.62, "history"], ["Orvieto", 42.72, 12.11, "history"], ["Spoleto", 42.74, 12.74, "history"],
  ["Todi", 42.78, 12.41, "history"], ["Gubbio", 43.35, 12.58, "history"], ["Urbino", 43.73, 12.64, "history"],
  ["Sirolo, Conero coast", 43.52, 13.62, "coast"], ["Tivoli", 41.96, 12.8, "history"], ["Sperlonga", 41.26, 13.43, "coast"],
  ["Gaeta", 41.21, 13.57, "coast"], ["Amalfi", 40.63, 14.6, "coast"], ["Positano", 40.63, 14.49, "coast"],
  ["Sorrento", 40.63, 14.38, "coast"], ["Capri", 40.55, 14.24, "coast"], ["Ischia", 40.73, 13.9, "coast"],
  ["Paestum", 40.42, 15.0, "history"], ["Palinuro, Cilento", 40.03, 15.28, "coast"], ["Maratea", 39.99, 15.71, "coast"],
  ["Matera", 40.67, 16.6, "history"], ["Ostuni", 40.73, 17.58, "history"], ["Alberobello", 40.78, 17.24, "history"],
  ["Polignano a Mare", 40.99, 17.22, "coast"], ["Monopoli", 40.95, 17.3, "coast"], ["Martina Franca", 40.7, 17.34, "history"],
  ["Cisternino", 40.74, 17.42, "history"], ["Gallipoli", 40.06, 17.99, "coast"], ["Otranto", 40.15, 18.49, "coast"],
  ["Santa Maria di Leuca", 39.8, 18.36, "coast"], ["Vieste, Gargano", 41.88, 16.18, "coast"], ["Peschici, Gargano", 41.94, 16.02, "coast"],
  ["Termoli", 42.0, 14.99, "coast"], ["Vasto", 42.12, 14.71, "coast"], ["Scanno", 41.9, 13.88, "mountains"],
  ["Roccaraso", 41.85, 14.08, "mountains"], ["Tropea", 38.68, 15.9, "coast"], ["Scilla", 38.25, 15.72, "coast"],
  ["Pizzo", 38.73, 16.16, "coast"], ["Taormina", 37.85, 15.29, "coast"], ["Cefalu", 38.04, 14.02, "coast"],
  ["Noto", 36.89, 15.07, "history"], ["Modica", 36.86, 14.76, "history"], ["Scicli", 36.79, 14.7, "history"],
  ["Ortigia, Syracuse", 37.06, 15.29, "coast"], ["Marzamemi", 36.74, 15.12, "coast"], ["San Vito Lo Capo", 38.17, 12.74, "coast"],
  ["Erice", 38.04, 12.59, "history"], ["Favignana", 37.93, 12.33, "coast"], ["Lipari", 38.47, 14.95, "coast"],
  ["Valley of the Temples", 37.29, 13.59, "history"], ["Alghero", 40.56, 8.32, "coast"], ["Porto Cervo", 41.14, 9.53, "coast"],
  ["Santa Teresa Gallura", 41.24, 9.19, "coast"], ["Villasimius", 39.14, 9.52, "coast"], ["Cala Gonone", 40.28, 9.63, "coast"],
  ["Stintino", 40.94, 8.22, "coast"], ["Chia", 38.9, 8.88, "coast"], ["Bosa", 40.3, 8.5, "coast"],
  ["Orosei", 40.38, 9.7, "coast"], ["Asolo", 45.8, 11.91, "history"], ["Valdobbiadene", 45.9, 12.04, "wine"],
  ["Bassano del Grappa", 45.77, 11.73, "history"], ["Cividale del Friuli", 46.09, 13.43, "history"], ["Alba", 44.7, 8.04, "wine"],
  ["Barolo", 44.61, 7.94, "wine"], ["Acqui Terme", 44.68, 8.47, "wine"], ["Jesolo", 45.5, 12.64, "coast"],
  ["Bibione", 45.64, 13.04, "coast"], ["Cesenatico", 44.2, 12.4, "coast"], ["Viareggio", 43.87, 10.25, "coast"],
  ["Forte dei Marmi", 43.96, 10.17, "coast"], ["Castiglione della Pescaia", 42.76, 10.88, "coast"], ["Porto Ercole", 42.39, 11.21, "coast"],
  ["San Felice Circeo", 41.23, 13.09, "coast"],
] as [string, number, number, Gem["kind"]][]).map(([name, lat, lng, kind]) => ({ name, lat, lng, kind }));

export function nearestGems(lat: number, lng: number, maxKm: number, n: number, kinds?: Gem["kind"][]) {
  return GEMS.filter((g) => !kinds || kinds.includes(g.kind))
    .map((g) => ({ ...g, km: km(lat, lng, g.lat, g.lng) }))
    .filter((g) => g.km <= maxKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, n);
}
