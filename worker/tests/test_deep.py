from odysstay_worker.deep import scan


PAGES = [
    "Relazione di stima. L'immobile è occupato dal debitore esecutato e dalla sua famiglia. "
    "Il bene si trova al piano terra.",
    "Conformità urbanistica. Sono state rilevate opere abusive consistenti nella chiusura del balcone, non sanabili. "
    "Non sono state rilevate difformità catastali rispetto alla planimetria depositata. "
    "Risultano spese condominiali insolute pari a euro 3.250,00 relative agli ultimi due esercizi.",
    "Stato di conservazione. Si rilevano tracce di umidità di risalita e infiltrazioni dal solaio di copertura.",
]


def test_scan_finds_flags_with_verbatim_quotes_and_pages():
    flags = scan(PAGES)
    by = {f["flag_en"]: f for f in flags}
    abusi = next(f for f in flags if "without permits" in f["flag_en"])
    assert abusi["severity"] == "high" and abusi["page"] == 2
    assert abusi["quote"] in " ".join(PAGES[1].split())
    assert any("occupied" in k for k in by)
    assert any("condominium" in k for k in by)
    assert any("damp" in k for k in by)


def test_scan_skips_negated_mentions():
    flags = scan(PAGES)
    assert not any("land registry" in f["flag_en"] for f in flags)


def test_high_severity_first():
    flags = scan(PAGES)
    sev = [f["severity"] for f in flags]
    assert sev == sorted(sev, key={"high": 0, "medium": 1, "low": 2}.get)
