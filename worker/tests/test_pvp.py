import os
import sys
import tempfile
from datetime import date
from pathlib import Path

os.environ.setdefault("WORKER_DATA", tempfile.mkdtemp())
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fake_supa import FakeSupa  # noqa: E402

from odysstay_worker import costs, score  # noqa: E402
from odysstay_worker.collectors import pvp  # noqa: E402

TODAY = date(2026, 10, 27)

ITEM = {
    "id": 4651670, "tipoLotto": "IMMOBILI", "categoriaLotto": "IMMOBILE_RESIDENZIALE", "categoriaBene": ["APPARTAMENTO"],
    "indirizzo": {"via": "Frazione Le Cupe - Via L.Caboto 2", "citta": "Corciano", "provincia": "Perugia",
                  "coordinate": {"latitudine": 43.12, "longitudine": 12.29}},
    "numeroLotto": "1", "prezzoBaseAsta": 231000.0, "dataVendita": "2027-02-02", "orarioVendita": "10:00",
    "dataPubblicazione": "2026-10-26", "offertaMinima": 173250.0, "disponibilita": ["OCCUP"],
    "descLotto": "Unità immobiliari ad uso abitativo ed accessori, appartamento di mq 142 con giardino di mq 600",
    "tribunale": "Tribunale di PERUGIA", "esito": None,
}
DETAIL = {
    "idVendita": 4651670, "descTipoVendita": "Senza Incanto", "dataVendita": "02/02/2027", "oraVendita": "10:00",
    "impoOffertaMinima": 173250, "impoOffertaAumento": 3500, "impoBaseAsta": 231000, "impoStima": 308000,
    "descModVendita": "Asincrona Telematica", "dataTermPresOff": "01/02/2027", "oraTermPresOff": "12:00",
    "dataDiPubblicazione": "26/10/2026",
    "lotto": {"codLotto": "1", "descLotto": ITEM["descLotto"], "codTipoCategLotto": "IMMOBILE_RESIDENZIALE",
              "indirizzo": {"via": "Frazione Le Cupe - Via L.Caboto 2", "codProvincia": "PG", "descComune": "Corciano",
                            "descProvincia": "Perugia", "descRegione": "Umbria"}},
    "beni": [{"codTipologiaBene": "APPARTAMENTO", "descTipologiaBene": "Appartamento", "descrizione": ITEM["descLotto"],
              "disponibilita": "OCCUP", "superficie": None,
              "allegati": [{"linkAllegato": "/immagini-beni/4651670/1/foto facciata.jpg?versionId=abc", "descrizione": "IMMAGINE BENE"}]},
             {"codTipologiaBene": "BOX", "descrizione": "Box auto", "disponibilita": "LIBER"}],
    "procedura": {"numeAnnoRg": 2025, "numeRg": 43, "descUfficio": "Tribunale di PERUGIA"},
    "soggetti": [{"ruolo": "DELEGATO", "nome": "Mario", "cognome": "Rossi", "cellulare": "3330000000",
                  "email": "mario@example.it", "soggVisitaBene": False},
                 {"ruolo": "GIUDICE", "nome": "X", "cognome": "Y"}],
    "allegati": [{"codiceTipoAllegato": "PERIZ", "linkAllegato": "/allegati/4651670/Perizia.pdf?versionId=1", "nomeFile": "Perizia.pdf"},
                 {"codiceTipoAllegato": "AVEND", "linkAllegato": "/allegati/4651670/Avviso.pdf", "descrizione": "Avviso di vendita"}],
    "datiDeposito": {"depoCauzionale": "10%"},
}


def test_build_maps_official_record():
    rec = pvp.build(ITEM, DETAIL, TODAY)
    l, facts = rec["listing"], {f["key"]: f for f in rec["facts"]}
    assert l["external_id"] == "pvp:4651670" and l["sale_type"] == "auction_judicial"
    assert (l["province"], l["region"], l["comune"]) == ("PG", "Umbria", "Corciano")
    assert l["property_type"] == "apartment"  # the garage in the same lot does not win
    assert l["price_eur"] == 231000 and l["min_offer_eur"] == 173250 and l["appraisal_eur"] == 308000
    assert l["discount_pct"] == 44  # 173,250 vs 308,000
    assert l["surface_sqm"] == 142  # the garden figure is skipped
    assert l["occupancy"] == "occupied"
    assert l["auction_at"] == "2027-02-02" and l["deadline_at"] == "2027-02-01"
    assert l["deposit_eur"] == 17325
    assert l["photo_urls"][0].startswith("https://resource-pvp.giustizia.it/immagini-beni/4651670/1/foto%20facciata.jpg?versionId=abc")
    assert l["hero_image_path"] == l["photo_urls"][0]
    assert [a["kind"] for a in l["attachments"]] == ["appraisal", "sale_notice"]
    assert l["contacts"] == [{"role": "Sale delegate", "name": "Mario Rossi", "email": "mario@example.it",
                              "phone": "3330000000", "handles_visits": False}]
    assert l["case_ref"] == "R.G.E. 43/2025, lotto 1"
    assert l["title_en"] == "Apartment in Corciano (PG), 142 m²"
    assert facts["price_eur"]["quote"] == "Prezzo base: € 231.000,00"
    assert facts["appraisal_eur"]["quote"] == "Valore di stima: € 308.000,00"
    assert facts["surface_sqm"]["quote"] in ITEM["descLotto"]
    assert rec["document"]["url"] == "https://pvp.giustizia.it/pvp/it/detail_annuncio.page?idAnnuncio=4651670"


def test_land_and_types():
    item = {**ITEM, "id": 1, "categoriaLotto": "ALTRA_CATEGORIA",
            "descLotto": "TERRENO EDIFICABILE CON SUP. CATASTALE PARI A MQ. 2.585"}
    det = {"lotto": {"descLotto": item["descLotto"]}, "beni": [{"codTipologiaBene": "TERRENO", "descrizione": item["descLotto"]}],
           "impoBaseAsta": 58500, "impoStima": 99_999_999}
    l = pvp.build(item, det, TODAY)["listing"]
    assert l["property_type"] == "land" and l["land_sqm"] == 2585 and l["surface_sqm"] is None
    assert l["appraisal_eur"] is None  # implausible appraisal dropped
    det2 = {"beni": [{"codTipologiaBene": "ALTRO", "descrizione": "Casale in pietra con annesso rustico"}]}
    assert pvp.build({**ITEM, "id": 2}, det2, TODAY)["listing"]["property_type"] == "rural_house"


class FakeApi:
    def __init__(self, items, details):
        self.items, self.details, self.detail_calls = items, details, 0

    def page(self, n, body):
        size = 2
        chunk = self.items[n * size : (n + 1) * size]
        return {"content": chunk, "totalPages": (len(self.items) + size - 1) // size, "totalElements": len(self.items)}

    def detail(self, sid):
        self.detail_calls += 1
        return self.details[sid]


def test_collect_upserts_and_skips_unchanged():
    past = {**ITEM, "id": 10, "dataVendita": "2026-09-01"}
    far = {**ITEM, "id": 11, "dataVendita": "2929-09-15"}
    a = {**ITEM, "id": 12}
    b = {**ITEM, "id": 13, "dataVendita": "2027-03-01", "esito": "SOSPE"}
    items = [past, {**past, "id": 9}, a, b, far]
    api = FakeApi(items, {12: {**DETAIL, "idVendita": 12}})
    db = FakeSupa()
    st = pvp.collect(db, api=api, today=TODAY, log=lambda *_: None)
    assert st["upcoming"] == 2 and st["new"] == 1 and st["errors"] == 0
    [l] = db.select("listings")
    assert l["external_id"] == "pvp:12" and l["document_id"]
    assert len(db.select("listing_facts")) >= 8
    # Second run: nothing changed, no detail calls
    api.detail_calls = 0
    st = pvp.collect(db, api=api, today=TODAY, log=lambda *_: None)
    assert st["unchanged"] == 1 and api.detail_calls == 0
    # Price drop: re-read and facts replaced, not duplicated
    items[2] = {**a, "prezzoBaseAsta": 200000.0}
    n_facts = len(db.select("listing_facts"))
    st = pvp.collect(db, api=api, today=TODAY, log=lambda *_: None)
    assert st["updated"] == 1 and len(db.select("listings")) == 1 and len(db.select("listing_facts")) == n_facts

    score.run(db, log=lambda *_: None)
    [l] = db.select("listings")
    assert any("below the court appraisal" in r for r in l["score_reasons"])
    assert any("court sale" in r for r in l["score_reasons"])
    assert l["status"] == "active"

    costs.run(db, log=lambda *_: None)
    est = db.select("cost_estimates")
    assert {e["scenario"] for e in est} == {"light", "standard", "full"}
    assert costs.run(db, log=lambda *_: None) == 0  # not duplicated
