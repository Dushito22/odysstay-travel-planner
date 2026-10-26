import os
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

os.environ["WORKER_DATA"] = tempfile.mkdtemp()
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fake_supa import FakeSupa  # noqa: E402

from odysstay_worker import extract, score  # noqa: E402
from odysstay_worker.collectors.gazzetta import parse_issue_list, split_notices  # noqa: E402
from odysstay_worker.relevance import is_candidate  # noqa: E402

DEADLINE = date.today() + timedelta(days=30)
MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"]
DL_IT = f"{DEADLINE.day} {MESI[DEADLINE.month - 1]} {DEADLINE.year}"

NOTICE = f"""COMUNE DI URZULEI
Provincia di Nuoro
Asta pubblica per la vendita di immobile comunale
Il cespite è attualmente libero ed è oggetto di alienazione nello stato di fatto e di diritto in cui si trova.
Il prezzo a base d'asta viene fissato in euro 18.000,00 (diciottomila/00).
Fabbricato rurale in pietra, superficie lorda di mq 120, con terreno di mq 900.
Le offerte dovranno pervenire entro e non oltre le ore 12:00 del {DL_IT} presso l'Ufficio Protocollo.
Deposito cauzionale pari a euro 1.800,00.
Il precedente esperimento d'asta è andato deserto.
L'immobile necessita di interventi di ristrutturazione integrale.
"""


def model_output():
    return {"lots": [{
        "lot": None,
        "comune": {"value": "Urzulei", "quote": "COMUNE DI URZULEI", "quote_en": "Municipality of Urzulei"},
        "province": {"value": "NU", "quote": "Provincia di Nuoro", "quote_en": "Province of Nuoro"},
        "property_type": {"value": "rural_house", "quote": "Fabbricato rurale in pietra", "quote_en": "Stone rural building"},
        "price_eur": {"value": 18000, "quote": "Il prezzo a base d'asta viene fissato in euro 18.000,00", "quote_en": "The base price is set at €18,000"},
        "surface_sqm": {"value": 120, "quote": "superficie lorda di mq 120", "quote_en": "gross surface of 120 m²"},
        "land_sqm": {"value": 900, "quote": "con terreno di mq 900", "quote_en": "with 900 m² of land"},
        "deposit_eur": {"value": 1800, "quote": "Deposito cauzionale pari a euro 1.800,00.", "quote_en": "Deposit of €1,800."},
        "deadline": {"value": DEADLINE.isoformat(), "quote": f"entro e non oltre le ore 12:00 del {DL_IT}", "quote_en": "by 12:00"},
        "occupancy": {"value": "free", "quote": "Il cespite è attualmente libero", "quote_en": "The property is currently vacant"},
        "sale_type": {"value": "sale", "quote": "è oggetto di alienazione", "quote_en": "is being sold"},
        "previous_auction_failed": {"value": True, "quote": "Il precedente esperimento d'asta è andato deserto.", "quote_en": "The previous auction had no bids."},
        # Hallucinations that must never reach the database:
        "energy_class": {"value": "C", "quote": "Fabbricato rurale in pietra", "quote_en": "x"},
        "auction_date": {"value": "2026-12-24", "quote": "superficie lorda di mq 120", "quote_en": "x"},
        "contact": {"value": "0782 123456", "quote": "tel. 0782 123456", "quote_en": "x"},
        "title_en": {"value": "Stone rural house with 900 m² of land", "quotes": ["con terreno di mq 900"]},
        "summary_en": {"value": "Invented summary", "quotes": ["vista mare panoramica"]},
        "red_flags": [
            {"flag_en": "Needs full renovation", "severity": "medium", "quote": "L'immobile necessita di interventi di ristrutturazione integrale.", "quote_en": "Needs a full renovation."},
            {"flag_en": "Asbestos roof", "severity": "high", "quote": "copertura in amianto", "quote_en": "asbestos roof"},
        ],
    }]}


def make_db():
    db = FakeSupa()
    db.insert("comuni", {"istat": "091095", "name": "Urzulei", "province": "NU", "region": "Sardegna"})
    db.insert("grants", {"region": "Sardegna", "name": "Sardinia small-comuni first-home grant", "conditions_en": "Move your residence."})
    db.insert("documents", {"source_id": "comune", "url": "https://urzulei.example/avviso.pdf", "part": "", "status": "candidate",
                            "title": "Comune di Urzulei: avviso", "text_content": NOTICE,
                            "meta": {"comune": "Urzulei", "province": "NU", "region": "Sardegna"}})
    return db


def test_relevance_and_split():
    assert is_candidate(NOTICE)
    assert not is_candidate("Procedura aperta per l'affidamento del servizio di pulizia degli immobili comunali. Base d'asta euro 100.000.")
    issue = "SOMMARIO (TX26BIA374) (TX26BFC100)\n" + "x" * 300 + "\nCOMUNE A vendita " + "y" * 300 + " (TX26BIA374)\nCOMUNE B " + "z" * 300 + " (TX26BFC100)"
    assert [c for c, _ in split_notices(issue)] == ["TX26BIA374", "TX26BFC100"]


def test_issue_list_parsing_from_labels():
    html = "<li><a>n&deg; 121</a><br/> del 23-10-2026</li> n° 120 del 21-10-2026 ... n° 90 del 07-08-2026"
    got = parse_issue_list(html, date(2026, 10, 1))
    assert got == [(120, date(2026, 10, 21), None), (121, date(2026, 10, 23), None)]


def test_issue_list_parsing_from_links():
    html = (
        '<a href="/gazzetta/contratti/caricaDettaglio?dataPubblicazioneGazzetta=2026-10-23&amp;numeroGazzetta=121">x</a>'
        '<a href="/do/gazzetta/downloadPdf?dataPubblicazioneGazzetta=20261023&amp;numeroGazzetta=121&amp;estensione=pdf">Download PDF</a>'
        '<a href="/do/gazzetta/contratti/0/pdfPaginato?numeroGazzetta=120&amp;dataPubblicazioneGazzetta=20261021&amp;numPagina=1">x</a>'
        '<a href="/do/gazzetta/downloadPdf?dataPubblicazioneGazzetta=20260807&amp;numeroGazzetta=90&amp;estensione=pdf">old</a>'
    )
    got = parse_issue_list(html, date(2026, 10, 1))
    assert got == [
        (120, date(2026, 10, 21), None),
        (121, date(2026, 10, 23), "https://www.gazzettaufficiale.it/do/gazzetta/downloadPdf?dataPubblicazioneGazzetta=20261023&numeroGazzetta=121&estensione=pdf"),
    ]


def test_full_pipeline(monkeypatch):
    db = make_db()
    monkeypatch.setattr(extract, "call_model", lambda text, title="": model_output())

    stats = extract.run(db, limit=10, log=lambda *_: None)
    assert stats["documents"] == 1 and stats["listings"] == 1 and stats["errors"] == 0
    assert stats["rejected_fields"] == 3  # energy_class, auction_date, contact

    [l] = db.select("listings")
    assert l["comune"] == "Urzulei" and l["province"] == "NU" and l["region"] == "Sardegna"
    assert l["price_eur"] == 18000 and l["surface_sqm"] == 120 and l["deposit_eur"] == 1800
    assert l["deadline_at"] == DEADLINE.isoformat() and l["auction_at"] is None
    assert l["title_en"] == "Stone rural house with 900 m² of land"
    assert l["summary_en"] is None  # its quote is not in the notice
    assert l["is_demo"] is False

    facts = {f["key"]: f for f in db.select("listing_facts")}
    assert "energy_class" not in facts and "auction_date" not in facts and "contact" not in facts
    assert facts["price_eur"]["value_text"] == "€18,000" and facts["price_eur"]["quote_en"] == "The base price is set at €18,000"
    assert facts["deadline"]["value_text"].endswith(str(DEADLINE.year))
    assert facts["previous_auction_failed"]["value_text"] == "Unsold"
    assert all(f["quote"] in NOTICE for f in facts.values())

    flags = db.select("listing_red_flags")
    assert [f["flag_en"] for f in flags] == ["Needs full renovation"]

    [doc] = db.select("documents")
    assert doc["status"] == "extracted"

    extract.link_grants(db, log=lambda *_: None)
    [lg] = db.select("listing_grants")
    assert lg["fit"] == "possible" and "Move your residence" in lg["reason_en"]

    score.run(db, log=lambda *_: None)
    [l] = db.select("listings")
    assert l["status"] == "active" and l["score"] >= 70
    assert any("unsold before" in r for r in l["score_reasons"])
    assert "-5 1 red flag" in l["score_reasons"]


def test_score_status_and_concessions():
    today = date(2026, 10, 26)
    s, _, st = score.score_listing({"price_eur": 50000, "deadline_at": "2026-10-20"}, 0, today)
    assert (s, st) == (0, "closed")
    _, _, st = score.score_listing({"price_eur": 50000, "deadline_at": "2026-11-02"}, 0, today)
    assert st == "closing_soon"
    sale, _, _ = score.score_listing({"price_eur": 50000, "sale_type": "sale"}, 0, today)
    conc, reasons, _ = score.score_listing({"price_eur": 50000, "sale_type": "concession"}, 0, today)
    assert conc < sale and any("use, not ownership" in r for r in reasons)


def test_model_errors_mark_document(monkeypatch):
    db = make_db()

    def boom(text, title=""):
        raise ValueError("model returned no JSON")

    monkeypatch.setattr(extract, "call_model", boom)
    stats = extract.run(db, log=lambda *_: None)
    assert stats["errors"] == 1
    [doc] = db.select("documents")
    assert doc["status"] == "error" and "no JSON" in doc["error"]
    assert db.select("listings") == []
