"""Province code -> (name, region). Used to place every listing on the map and in a region filter."""

PROVINCES = {
    # Piemonte
    "TO": ("Torino", "Piemonte"), "VC": ("Vercelli", "Piemonte"), "NO": ("Novara", "Piemonte"),
    "CN": ("Cuneo", "Piemonte"), "AT": ("Asti", "Piemonte"), "AL": ("Alessandria", "Piemonte"),
    "BI": ("Biella", "Piemonte"), "VB": ("Verbano-Cusio-Ossola", "Piemonte"),
    # Valle d'Aosta
    "AO": ("Aosta", "Valle d'Aosta"),
    # Lombardia
    "VA": ("Varese", "Lombardia"), "CO": ("Como", "Lombardia"), "SO": ("Sondrio", "Lombardia"),
    "MI": ("Milano", "Lombardia"), "BG": ("Bergamo", "Lombardia"), "BS": ("Brescia", "Lombardia"),
    "PV": ("Pavia", "Lombardia"), "CR": ("Cremona", "Lombardia"), "MN": ("Mantova", "Lombardia"),
    "LC": ("Lecco", "Lombardia"), "LO": ("Lodi", "Lombardia"), "MB": ("Monza e Brianza", "Lombardia"),
    # Trentino-Alto Adige
    "BZ": ("Bolzano", "Trentino-Alto Adige"), "TN": ("Trento", "Trentino-Alto Adige"),
    # Veneto
    "VR": ("Verona", "Veneto"), "VI": ("Vicenza", "Veneto"), "BL": ("Belluno", "Veneto"),
    "TV": ("Treviso", "Veneto"), "VE": ("Venezia", "Veneto"), "PD": ("Padova", "Veneto"), "RO": ("Rovigo", "Veneto"),
    # Friuli-Venezia Giulia
    "UD": ("Udine", "Friuli-Venezia Giulia"), "GO": ("Gorizia", "Friuli-Venezia Giulia"),
    "TS": ("Trieste", "Friuli-Venezia Giulia"), "PN": ("Pordenone", "Friuli-Venezia Giulia"),
    # Liguria
    "IM": ("Imperia", "Liguria"), "SV": ("Savona", "Liguria"), "GE": ("Genova", "Liguria"), "SP": ("La Spezia", "Liguria"),
    # Emilia-Romagna
    "PC": ("Piacenza", "Emilia-Romagna"), "PR": ("Parma", "Emilia-Romagna"), "RE": ("Reggio Emilia", "Emilia-Romagna"),
    "MO": ("Modena", "Emilia-Romagna"), "BO": ("Bologna", "Emilia-Romagna"), "FE": ("Ferrara", "Emilia-Romagna"),
    "RA": ("Ravenna", "Emilia-Romagna"), "FC": ("Forlì-Cesena", "Emilia-Romagna"), "RN": ("Rimini", "Emilia-Romagna"),
    # Toscana
    "MS": ("Massa-Carrara", "Toscana"), "LU": ("Lucca", "Toscana"), "PT": ("Pistoia", "Toscana"),
    "FI": ("Firenze", "Toscana"), "LI": ("Livorno", "Toscana"), "PI": ("Pisa", "Toscana"),
    "AR": ("Arezzo", "Toscana"), "SI": ("Siena", "Toscana"), "GR": ("Grosseto", "Toscana"), "PO": ("Prato", "Toscana"),
    # Umbria
    "PG": ("Perugia", "Umbria"), "TR": ("Terni", "Umbria"),
    # Marche
    "PU": ("Pesaro e Urbino", "Marche"), "AN": ("Ancona", "Marche"), "MC": ("Macerata", "Marche"),
    "AP": ("Ascoli Piceno", "Marche"), "FM": ("Fermo", "Marche"),
    # Lazio
    "VT": ("Viterbo", "Lazio"), "RI": ("Rieti", "Lazio"), "RM": ("Roma", "Lazio"), "LT": ("Latina", "Lazio"), "FR": ("Frosinone", "Lazio"),
    # Abruzzo
    "AQ": ("L'Aquila", "Abruzzo"), "TE": ("Teramo", "Abruzzo"), "PE": ("Pescara", "Abruzzo"), "CH": ("Chieti", "Abruzzo"),
    # Molise
    "CB": ("Campobasso", "Molise"), "IS": ("Isernia", "Molise"),
    # Campania
    "CE": ("Caserta", "Campania"), "BN": ("Benevento", "Campania"), "NA": ("Napoli", "Campania"),
    "AV": ("Avellino", "Campania"), "SA": ("Salerno", "Campania"),
    # Puglia
    "FG": ("Foggia", "Puglia"), "BA": ("Bari", "Puglia"), "TA": ("Taranto", "Puglia"), "BR": ("Brindisi", "Puglia"),
    "LE": ("Lecce", "Puglia"), "BT": ("Barletta-Andria-Trani", "Puglia"),
    # Basilicata
    "PZ": ("Potenza", "Basilicata"), "MT": ("Matera", "Basilicata"),
    # Calabria
    "CS": ("Cosenza", "Calabria"), "CZ": ("Catanzaro", "Calabria"), "RC": ("Reggio Calabria", "Calabria"),
    "KR": ("Crotone", "Calabria"), "VV": ("Vibo Valentia", "Calabria"),
    # Sicilia
    "TP": ("Trapani", "Sicilia"), "PA": ("Palermo", "Sicilia"), "ME": ("Messina", "Sicilia"), "AG": ("Agrigento", "Sicilia"),
    "CL": ("Caltanissetta", "Sicilia"), "EN": ("Enna", "Sicilia"), "CT": ("Catania", "Sicilia"),
    "RG": ("Ragusa", "Sicilia"), "SR": ("Siracusa", "Sicilia"),
    # Sardegna (old and reinstated codes all map to the region)
    "SS": ("Sassari", "Sardegna"), "NU": ("Nuoro", "Sardegna"), "CA": ("Cagliari", "Sardegna"),
    "OR": ("Oristano", "Sardegna"), "SU": ("Sud Sardegna", "Sardegna"), "OT": ("Gallura", "Sardegna"),
    "OG": ("Ogliastra", "Sardegna"), "VS": ("Medio Campidano", "Sardegna"), "CI": ("Sulcis Iglesiente", "Sardegna"),
}

REGIONS = sorted({r for _, r in PROVINCES.values()})

_by_name = {name.lower(): code for code, (name, _) in PROVINCES.items()}


def region_for(province: str | None) -> str | None:
    if not province:
        return None
    p = province.strip()
    if p.upper() in PROVINCES:
        return PROVINCES[p.upper()][1]
    code = _by_name.get(p.lower())
    return PROVINCES[code][1] if code else None


def province_code(province: str | None) -> str | None:
    if not province:
        return None
    p = province.strip()
    if p.upper() in PROVINCES:
        return p.upper()
    return _by_name.get(p.lower())
