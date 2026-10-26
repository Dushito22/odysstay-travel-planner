"""Cheap keyword triage before any AI is used. Errs on the side of keeping a notice."""
import re

SALE = re.compile(
    r"alienazion|asta pubblica|vendita (?:di |dell[a'’] ?|degli |del )?(?:beni |bene |unit[aà] )?immobil|"
    r"vendita all[’' ]?asta|cessione (?:di |dell[’' ]?)?immobil|case a 1 euro|casa a 1 euro|"
    r"avviso di vendita|bando di vendita|offerte segrete|prezzo a base d[’' ]?asta|base d[’' ]?asta",
    re.I,
)
PROPERTY = re.compile(
    r"immobil|fabbricat|appartament|abitazion|terren|casa |case |edifici|villa|rustic|casale|podere|"
    r"magazzin|locale commerciale|unit[aà] immobiliar|catasto fabbricati|foglio \d+",
    re.I,
)
# Procurement noise: works, services and supplies tenders dominate the Gazzetta.
PROCUREMENT = re.compile(
    r"affidamento (?:del |dei |di )?(?:servizi|lavori|fornitur)|appalto (?:di|dei|del) (?:servizi|lavori|fornitur)|"
    r"procedura aperta per l[’' ]?affidamento|esito di gara|avviso di aggiudicazione|accordo quadro",
    re.I,
)


def is_candidate(text: str) -> bool:
    head = text[:6000]
    sale_hits = len(SALE.findall(head))
    if sale_hits == 0 or not PROPERTY.search(head):
        return False
    if PROCUREMENT.search(head) and not re.search(r"alienazion|vendita.{0,40}immobil", head, re.I):
        return False
    return True


LINK_HINT = re.compile(
    r"alienazion|vendita|asta|aste|bando|bandi|avvis|patrimonio|immobil|1 ?euro|albo|trasparen|gare",
    re.I,
)
DOC_HINT = re.compile(r"alienazion|vendita|asta pubblica|aste|immobil|1 ?euro|patrimonio|terren|fabbricat", re.I)
