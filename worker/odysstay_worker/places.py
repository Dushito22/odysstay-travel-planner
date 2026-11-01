"""Reference places for the location part of the deal score: provincial capitals and big cities
(services, hospitals, trains), airports with real routes, and the towns and shores foreigners come to Italy for.
Coordinates are approximate (town centres), which is enough for distances in kilometres."""
from __future__ import annotations

import math

# (name, lat, lng). Provincial capitals: where the hospital, the big shops and the train station are.
CITIES = [
    ("Rome", 41.90, 12.50), ("Milan", 45.46, 9.19), ("Naples", 40.85, 14.27), ("Turin", 45.07, 7.69),
    ("Palermo", 38.12, 13.36), ("Genoa", 44.41, 8.93), ("Bologna", 44.49, 11.34), ("Florence", 43.77, 11.26),
    ("Bari", 41.12, 16.87), ("Catania", 37.50, 15.09), ("Venice", 45.44, 12.33), ("Verona", 45.44, 10.99),
    ("Messina", 38.19, 15.55), ("Padua", 45.41, 11.88), ("Trieste", 45.65, 13.78),
    ("Brescia", 45.54, 10.22), ("Parma", 44.80, 10.33), ("Modena", 44.65, 10.93), ("Reggio Emilia", 44.70, 10.63),
    ("Perugia", 43.11, 12.39), ("Cagliari", 39.22, 9.12), ("Livorno", 43.55, 10.31), ("Ravenna", 44.42, 12.20),
    ("Rimini", 44.06, 12.57), ("Ancona", 43.62, 13.52), ("Pescara", 42.46, 14.21), ("Taranto", 40.47, 17.24),
    ("Reggio Calabria", 38.11, 15.65), ("Salerno", 40.68, 14.77), ("Lecce", 40.35, 18.17), ("Foggia", 41.46, 15.54),
    ("Bergamo", 45.70, 9.67), ("Vicenza", 45.55, 11.55), ("Trento", 46.07, 11.12), ("Bolzano", 46.50, 11.35),
    ("Udine", 46.06, 13.24), ("Sassari", 40.73, 8.56), ("Pisa", 43.72, 10.40), ("Cosenza", 39.30, 16.25),
    ("Potenza", 40.64, 15.80), ("Campobasso", 41.56, 14.66), ("L'Aquila", 42.35, 13.40), ("Ferrara", 44.84, 11.62),
    ("Piacenza", 45.05, 9.69), ("Novara", 45.45, 8.62), ("Syracuse", 37.08, 15.29), ("Latina", 41.47, 12.90),
    ("Terni", 42.56, 12.64), ("Pesaro", 43.91, 12.91), ("Aosta", 45.74, 7.32), ("Como", 45.81, 9.09),
    ("Lucca", 43.84, 10.50), ("Siena", 43.32, 11.33), ("Arezzo", 43.46, 11.88), ("Asti", 44.90, 8.21),
    ("Cuneo", 44.39, 7.55), ("Brindisi", 40.63, 17.94), ("Catanzaro", 38.91, 16.59), ("Trapani", 38.02, 12.51),
    ("Ragusa", 36.93, 14.73), ("Agrigento", 37.31, 13.58), ("Nuoro", 40.32, 9.33), ("La Spezia", 44.10, 9.82),
    ("Savona", 44.31, 8.48), ("Alessandria", 44.91, 8.61), ("Pavia", 45.19, 9.16), ("Cremona", 45.13, 10.02),
    ("Mantua", 45.16, 10.79), ("Treviso", 45.67, 12.24), ("Pordenone", 45.96, 12.66), ("Belluno", 46.14, 12.22),
    ("Rovigo", 45.07, 11.79), ("Forli", 44.22, 12.04), ("Cesena", 44.14, 12.24), ("Prato", 43.88, 11.10),
    ("Pistoia", 43.93, 10.92), ("Grosseto", 42.76, 11.11), ("Viterbo", 42.42, 12.11), ("Rieti", 42.40, 12.86),
    ("Frosinone", 41.64, 13.34), ("Caserta", 41.07, 14.33), ("Avellino", 40.91, 14.79), ("Benevento", 41.13, 14.78),
    ("Matera", 40.67, 16.60), ("Chieti", 42.35, 14.17), ("Teramo", 42.66, 13.70), ("Macerata", 43.30, 13.45),
    ("Ascoli Piceno", 42.85, 13.58), ("Isernia", 41.59, 14.23), ("Crotone", 39.08, 17.13), ("Vibo Valentia", 38.68, 16.10),
    ("Enna", 37.57, 14.28), ("Caltanissetta", 37.49, 14.06), ("Oristano", 39.90, 8.59), ("Lecco", 45.86, 9.40),
    ("Varese", 45.82, 8.83), ("Sondrio", 46.17, 9.87), ("Biella", 45.57, 8.05), ("Vercelli", 45.32, 8.42),
    ("Imperia", 43.89, 8.03), ("Massa", 44.04, 10.14), ("Gorizia", 45.94, 13.62), ("Lodi", 45.31, 9.50),
    ("Verbania", 45.92, 8.55), ("Fermo", 43.16, 13.72), ("Lamezia Terme", 38.97, 16.31), ("Sulmona", 42.05, 13.93),
]
# The ones with 250,000+ people: culture, work, direct trains and flights.
BIG = {"Rome", "Milan", "Naples", "Turin", "Palermo", "Genoa", "Bologna", "Florence", "Bari", "Catania", "Venice",
       "Verona", "Messina", "Padua", "Trieste"}

AIRPORTS = [
    ("Rome Fiumicino", 41.80, 12.25), ("Rome Ciampino", 41.80, 12.59), ("Milan Malpensa", 45.63, 8.72),
    ("Milan Linate", 45.45, 9.28), ("Bergamo", 45.67, 9.70), ("Venice", 45.51, 12.35), ("Treviso", 45.65, 12.19),
    ("Bologna", 44.53, 11.29), ("Pisa", 43.68, 10.39), ("Florence", 43.81, 11.20), ("Naples", 40.89, 14.29),
    ("Bari", 41.14, 16.76), ("Brindisi", 40.66, 17.95), ("Catania", 37.47, 15.07), ("Palermo", 38.18, 13.10),
    ("Cagliari", 39.25, 9.06), ("Olbia", 40.90, 9.52), ("Alghero", 40.63, 8.29), ("Turin", 45.20, 7.65),
    ("Genoa", 44.41, 8.84), ("Verona", 45.40, 10.89), ("Trieste", 45.83, 13.47), ("Perugia", 43.10, 12.51),
    ("Ancona", 43.62, 13.36), ("Pescara", 42.43, 14.18), ("Lamezia Terme", 38.91, 16.24), ("Reggio Calabria", 38.07, 15.65),
    ("Trapani", 37.91, 12.49), ("Comiso", 36.99, 14.61), ("Bolzano", 46.46, 11.33), ("Rimini", 44.02, 12.61),
    ("Salerno", 40.62, 15.12), ("Cuneo", 44.55, 7.62), ("Foggia", 41.43, 15.53),
]

# (name, lat, lng, why people come). Famous towns, lakes, coasts, mountains, wine country.
GEMS = [
    ("Sirmione, Lake Garda", 45.49, 10.61, "lake"), ("Salo, Lake Garda", 45.61, 10.52, "lake"),
    ("Malcesine, Lake Garda", 45.77, 10.81, "lake"), ("Riva del Garda", 45.89, 10.84, "lake"),
    ("Bardolino, Lake Garda", 45.55, 10.72, "lake"), ("Bellagio, Lake Como", 45.99, 9.26, "lake"),
    ("Varenna, Lake Como", 46.01, 9.28, "lake"), ("Menaggio, Lake Como", 46.02, 9.24, "lake"),
    ("Stresa, Lake Maggiore", 45.88, 8.53, "lake"), ("Orta San Giulio", 45.80, 8.41, "lake"),
    ("Iseo, Lake Iseo", 45.66, 10.05, "lake"), ("Cortina d'Ampezzo", 46.54, 12.14, "mountains"),
    ("Ortisei, Dolomites", 46.57, 11.67, "mountains"), ("Corvara, Dolomites", 46.55, 11.88, "mountains"),
    ("Madonna di Campiglio", 46.23, 10.83, "mountains"), ("Courmayeur", 45.80, 6.97, "mountains"),
    ("Cervinia", 45.94, 7.63, "mountains"), ("Bormio", 46.47, 10.37, "mountains"), ("Sestriere", 44.96, 6.88, "mountains"),
    ("Cinque Terre", 44.15, 9.65, "coast"), ("Portofino", 44.30, 9.21, "coast"), ("Camogli", 44.35, 9.15, "coast"),
    ("Rapallo", 44.35, 9.23, "coast"), ("Alassio", 44.00, 8.17, "coast"), ("Sanremo", 43.82, 7.78, "coast"),
    ("Siena", 43.32, 11.33, "history"), ("San Gimignano", 43.47, 11.04, "history"), ("Montepulciano", 43.10, 11.78, "history"),
    ("Montalcino", 43.06, 11.49, "wine"), ("Pienza", 43.08, 11.68, "history"), ("Cortona", 43.28, 11.99, "history"),
    ("Greve in Chianti", 43.58, 11.31, "wine"), ("Lucca", 43.84, 10.50, "history"), ("Assisi", 43.07, 12.62, "history"),
    ("Orvieto", 42.72, 12.11, "history"), ("Spoleto", 42.74, 12.74, "history"), ("Todi", 42.78, 12.41, "history"),
    ("Gubbio", 43.35, 12.58, "history"), ("Urbino", 43.73, 12.64, "history"), ("Sirolo, Conero coast", 43.52, 13.62, "coast"),
    ("Tivoli", 41.96, 12.80, "history"), ("Sperlonga", 41.26, 13.43, "coast"), ("Gaeta", 41.21, 13.57, "coast"),
    ("Amalfi", 40.63, 14.60, "coast"), ("Positano", 40.63, 14.49, "coast"), ("Sorrento", 40.63, 14.38, "coast"),
    ("Capri", 40.55, 14.24, "coast"), ("Ischia", 40.73, 13.90, "coast"), ("Paestum", 40.42, 15.00, "history"),
    ("Palinuro, Cilento", 40.03, 15.28, "coast"), ("Maratea", 39.99, 15.71, "coast"), ("Matera", 40.67, 16.60, "history"),
    ("Ostuni", 40.73, 17.58, "history"), ("Alberobello", 40.78, 17.24, "history"), ("Polignano a Mare", 40.99, 17.22, "coast"),
    ("Monopoli", 40.95, 17.30, "coast"), ("Martina Franca", 40.70, 17.34, "history"), ("Cisternino", 40.74, 17.42, "history"),
    ("Gallipoli", 40.06, 17.99, "coast"), ("Otranto", 40.15, 18.49, "coast"), ("Santa Maria di Leuca", 39.80, 18.36, "coast"),
    ("Vieste, Gargano", 41.88, 16.18, "coast"), ("Peschici, Gargano", 41.94, 16.02, "coast"), ("Termoli", 42.00, 14.99, "coast"),
    ("Vasto", 42.12, 14.71, "coast"), ("Scanno", 41.90, 13.88, "mountains"), ("Roccaraso", 41.85, 14.08, "mountains"),
    ("Tropea", 38.68, 15.90, "coast"), ("Scilla", 38.25, 15.72, "coast"), ("Pizzo", 38.73, 16.16, "coast"),
    ("Taormina", 37.85, 15.29, "coast"), ("Cefalu", 38.04, 14.02, "coast"), ("Noto", 36.89, 15.07, "history"),
    ("Modica", 36.86, 14.76, "history"), ("Scicli", 36.79, 14.70, "history"), ("Ortigia, Syracuse", 37.06, 15.29, "coast"),
    ("Marzamemi", 36.74, 15.12, "coast"), ("San Vito Lo Capo", 38.17, 12.74, "coast"), ("Erice", 38.04, 12.59, "history"),
    ("Favignana", 37.93, 12.33, "coast"), ("Lipari", 38.47, 14.95, "coast"), ("Valley of the Temples", 37.29, 13.59, "history"),
    ("Alghero", 40.56, 8.32, "coast"), ("Porto Cervo", 41.14, 9.53, "coast"), ("Santa Teresa Gallura", 41.24, 9.19, "coast"),
    ("Villasimius", 39.14, 9.52, "coast"), ("Cala Gonone", 40.28, 9.63, "coast"), ("Stintino", 40.94, 8.22, "coast"),
    ("Chia", 38.90, 8.88, "coast"), ("Bosa", 40.30, 8.50, "coast"), ("Orosei", 40.38, 9.70, "coast"),
    ("Asolo", 45.80, 11.91, "history"), ("Valdobbiadene", 45.90, 12.04, "wine"), ("Bassano del Grappa", 45.77, 11.73, "history"),
    ("Cividale del Friuli", 46.09, 13.43, "history"), ("Alba", 44.70, 8.04, "wine"), ("Barolo", 44.61, 7.94, "wine"),
    ("Acqui Terme", 44.68, 8.47, "wine"), ("Jesolo", 45.50, 12.64, "coast"), ("Bibione", 45.64, 13.04, "coast"),
    ("Cesenatico", 44.20, 12.40, "coast"), ("Viareggio", 43.87, 10.25, "coast"), ("Forte dei Marmi", 43.96, 10.17, "coast"),
    ("Castiglione della Pescaia", 42.76, 10.88, "coast"), ("Porto Ercole", 42.39, 11.21, "coast"), ("San Felice Circeo", 41.23, 13.09, "coast"),
]


def _km(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    r = math.radians
    h = math.sin(r(b_lat - a_lat) / 2) ** 2 + math.cos(r(a_lat)) * math.cos(r(b_lat)) * math.sin(r(b_lng - a_lng) / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


def nearest(lat: float, lng: float, places) -> tuple[str, float, str]:
    best = None
    for p in places:
        d = _km(lat, lng, p[1], p[2])
        if best is None or d < best[1]:
            best = (p[0], d, p[3] if len(p) > 3 else "")
    return best  # type: ignore[return-value]
