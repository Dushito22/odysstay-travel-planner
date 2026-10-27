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

export function formatDrive(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function nearest(lat: number, lng: number, list: Place[], n: number) {
  return list
    .map((p) => ({ ...p, km: km(lat, lng, p.lat, p.lng) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n);
}
