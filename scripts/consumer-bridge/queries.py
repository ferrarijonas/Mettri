# -*- coding: utf-8 -*-
"""Registro de consultas somente-leitura ao Firebird do Consumer.

Cada consulta: (sql_builder, transform).
- sql_builder(params) -> string SQL (apenas SELECT; params ja validados aqui)
- transform(rows, params) -> objeto Python serializavel em JSON

`rows` vem de server.parse_isql_list (lista de dicts, chaves = alias maiusculo).
Adicionar consulta nova = escrever um builder+transform aqui e registrar no CONSULTAS.
"""
import re
import unicodedata
from datetime import date, datetime

DIAS_SEMANA = ("segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo")
_DIA_RE = re.compile(r"\b(segunda|terca|quarta|quinta|sexta|sabado|domingo)\b")


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

def sem_acento(s):
    """Remove acentos e baixa a caixa (para casar nomes como 'TERÇA-FEIRA')."""
    base = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in base if not unicodedata.combining(c)).lower()


def _safe_like(s):
    """Sanitiza termo de busca para virar trecho de LIKE (sem aspas/;)."""
    return re.sub(r"[^\w\s%-]", "", sem_acento(s))[:40].upper()


def _to_float(v):
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _dias_desde(iso_ymd):
    try:
        d = datetime.strptime(iso_ymd[:10], "%Y-%m-%d").date()
        return (date.today() - d).days
    except (ValueError, TypeError):
        return None


def _dias_do_nome(nome):
    return _DIA_RE.findall(sem_acento(nome))


# --------------------------------------------------------------------------
# Consulta: inativos
# --------------------------------------------------------------------------

def sql_inativos(p):
    dias = p.get("dias")
    having = ""
    if dias is not None:
        having = " HAVING MAX(P.DATAABERTURA) < DATEADD(-%d DAY TO CURRENT_DATE)" % int(dias)
    return (
        "SELECT C.NOME, C.FONEPRINCIPAL, MAX(P.DATAABERTURA) AS ULTIMOPEDIDO, "
        "AVG(P.VALORTOTALITENS) AS TICKETMEDIO "
        "FROM CONTATOS C JOIN PEDIDOS P ON P.CODIGOCONTATOCLIENTE = C.CODIGO "
        "WHERE P.DATADELETE IS NULL AND C.FONEPRINCIPAL IS NOT NULL "
        "AND C.FONEPRINCIPAL <> '' "
        "GROUP BY C.NOME, C.FONEPRINCIPAL" + having + " ORDER BY ULTIMOPEDIDO DESC"
    )


def transform_inativos(rows, p):
    out = []
    for r in rows:
        ult = r.get("ULTIMOPEDIDO", "")
        out.append({
            "nome": r.get("NOME", ""),
            "telefone": r.get("FONEPRINCIPAL", ""),
            "ultimoPedido": ult[:10],
            "diasInativo": _dias_desde(ult),
            "ticketMedio": _to_float(r.get("TICKETMEDIO")),
        })
    telefone = p.get("telefone")
    if telefone:
        digitos = re.sub(r"\D", "", str(telefone))
        out = [c for c in out if digitos and digitos in re.sub(r"\D", "", c["telefone"])]
    limite = p.get("limite")
    if limite:
        out = out[: int(limite)]
    return {"clientes": out, "total": len(out)}


# --------------------------------------------------------------------------
# Consulta: estoque (hoje | semana)
# --------------------------------------------------------------------------

def sql_estoque(p):
    cond = "PD.ESTOQUEATUAL > 0 AND P.DESCONTINUADO = 'N'"
    busca = p.get("busca")
    if busca:
        cond += " AND UPPER(P.NOME) LIKE '%%%s%%'" % _safe_like(busca)
    return (
        "SELECT P.NOME, PD.ESTOQUEATUAL FROM PRODUTODETALHE PD "
        "JOIN PRODUTOS P ON P.CODIGO = PD.CODIGOPRODUTO "
        "WHERE " + cond + " ORDER BY PD.ESTOQUEATUAL DESC"
    )


def transform_estoque(rows, p):
    itens = []
    for r in rows:
        nome = r.get("NOME", "")
        if "exclu" in sem_acento(nome):
            continue
        est = _to_float(r.get("ESTOQUEATUAL"))
        if not est or est <= 0:
            continue
        itens.append({"nome": nome, "estoque": est})

    if p.get("periodo") == "semana":
        semana = {d: [] for d in DIAS_SEMANA}
        for it in itens:
            for d in _dias_do_nome(it["nome"]):
                semana[d].append(it)
        return {"semana": {d: v for d, v in semana.items() if v}, "total": len(itens)}
    return {"hoje": itens, "total": len(itens)}


# --------------------------------------------------------------------------
# Registro
# --------------------------------------------------------------------------

CONSULTAS = {
    "inativos": (sql_inativos, transform_inativos),
    "estoque": (sql_estoque, transform_estoque),
}


# --------------------------------------------------------------------------
# Self-check (sem banco): python queries.py
# --------------------------------------------------------------------------

def _selfcheck():
    assert sem_acento("Pão Abóbora (QUARTA-FEIRA)") == "pao abobora (quarta-feira)"
    assert _dias_do_nome("Focaccia (QUINTA, SEXTA)") == ["quinta", "sexta"]
    assert _dias_do_nome("Pão de Cristo") == []

    rows = [
        {"NOME": "Multigrãos (TERÇA-FEIRA)", "ESTOQUEATUAL": "3.0000"},
        {"NOME": "Pão de Queijo", "ESTOQUEATUAL": "5.0000"},
        {"NOME": "* Excluído * Sprite", "ESTOQUEATUAL": "9.0000"},
        {"NOME": "Focaccia (QUINTA, SEXTA)", "ESTOQUEATUAL": "0.0000"},
    ]
    hoje = transform_estoque(rows, {"periodo": "hoje"})
    assert [i["nome"] for i in hoje["hoje"]] == ["Multigrãos (TERÇA-FEIRA)", "Pão de Queijo"]
    semana = transform_estoque(rows, {"periodo": "semana"})
    assert [i["nome"] for i in semana["semana"]["terca"]] == ["Multigrãos (TERÇA-FEIRA)"]

    inat = transform_inativos(
        [{"NOME": "Ana", "FONEPRINCIPAL": "(34) 91234-5678", "ULTIMOPEDIDO": "2026-01-01 10:00:00.0000", "TICKETMEDIO": "47.5"}],
        {"telefone": "34912345678"},
    )
    assert inat["total"] == 1 and inat["clientes"][0]["diasInativo"] is not None
    assert transform_inativos([{"NOME": "Ana", "FONEPRINCIPAL": "(34) 91234-5678", "ULTIMOPEDIDO": "2026-01-01 10:00:00.0000", "TICKETMEDIO": "47.5"}], {"telefone": "999"})["total"] == 0
    print("queries self-check OK")


if __name__ == "__main__":
    _selfcheck()
