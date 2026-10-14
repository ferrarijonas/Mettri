# -*- coding: utf-8 -*-
"""Gateway local (somente-leitura) do Firebird do Consumer.

Sobe um servidor HTTP em 127.0.0.1 que executa as consultas de `queries.py`
via isql.exe e devolve JSON. So aceita origem da extensao / processo local.

Rotas:
    GET /health                      -> {"ok": true}
    GET /consultas                   -> {"ok": true, "consultas": [...]}
    GET /q/<nome>?<params>           -> {"ok": true, "dados": ...}

Ex.: /q/inativos?dias=30&limite=50
     /q/estoque?periodo=semana
     /q/estoque?periodo=hoje&busca=integral

Config em config.local.json (gitignored). Ver config.example.json.
Nunca escreve no banco. Só SELECT.
"""
import json
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from queries import CONSULTAS

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(HERE, "config.local.json")


def _log(msg):
    """Log tolerante: sob pythonw (sem console) sys.stderr e None."""
    try:
        if sys.stderr is not None:
            sys.stderr.write("[consumer-bridge] " + msg + "\n")
    except Exception:  # noqa: BLE001
        pass


def carregar_config():
    if not os.path.exists(CONFIG_PATH):
        _log("config ausente: %s (copie config.example.json)" % CONFIG_PATH)
        sys.exit(1)
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


CONFIG = carregar_config()
ISQL = CONFIG["isql"]
DSN = "%s:%s" % (CONFIG.get("host", "localhost/3050"), CONFIG["db_path"])


def rodar_isql(sql):
    """Executa 1 SELECT via isql e devolve o texto (decodificado cp1252)."""
    script = "SET LIST ON;\n" + sql.strip().rstrip(";") + ";\nEXIT;\n"
    p = subprocess.run(
        [ISQL, "-user", CONFIG["user"], "-password", CONFIG["password"], DSN],
        input=script.encode("cp1252", errors="replace"),
        capture_output=True,
    )
    return p.stdout.decode("cp1252", errors="replace") + p.stderr.decode("cp1252", errors="replace")


def parse_isql_list(text):
    """Le a saida do isql em SET LIST ON (blocos 'CAMPO  valor' separados por linha vazia)."""
    rows, cur = [], {}
    for line in text.splitlines():
        if not line.strip():
            if cur:
                rows.append(cur)
                cur = {}
            continue
        parts = line.split(None, 1)
        if len(parts) == 2 and parts[0].isupper() and parts[0].isidentifier():
            cur[parts[0]] = parts[1].strip()
    if cur:
        rows.append(cur)
    return rows


class Handler(BaseHTTPRequestHandler):
    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        _log(args[0] % args[1:])

    def _origem_ok(self):
        """Sem segredo: aceita só quem nao manda Origin (curl/processo local) ou
        a origem da extensao. Bloqueia paginas web (que sempre mandam Origin)."""
        origin = self.headers.get("Origin")
        return origin is None or origin.startswith("chrome-extension://")

    def do_GET(self):
        url = urlparse(self.path)
        path = url.path.rstrip("/") or "/"

        if path == "/health":
            return self._json(200, {"ok": True})

        if not self._origem_ok():
            return self._json(403, {"ok": False, "erro": "origem nao permitida"})

        if path == "/consultas":
            return self._json(200, {"ok": True, "consultas": sorted(CONSULTAS)})

        if not path.startswith("/q/"):
            return self._json(404, {"ok": False, "erro": "rota desconhecida"})

        nome = path[len("/q/"):]
        spec = CONSULTAS.get(nome)
        if not spec:
            return self._json(404, {"ok": False, "erro": "consulta '%s' nao existe" % nome})

        params = {k: v[0] for k, v in parse_qs(url.query).items()}
        sql_builder, transform = spec
        try:
            sql = sql_builder(params)
            rows = parse_isql_list(rodar_isql(sql))
            return self._json(200, {"ok": True, "dados": transform(rows, params)})
        except ValueError as e:
            return self._json(400, {"ok": False, "erro": "parametro invalido: %s" % e})
        except Exception as e:  # noqa: BLE001
            return self._json(500, {"ok": False, "erro": str(e)})


def main():
    porta = int(CONFIG.get("port", 8765))
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", porta), Handler)
    except OSError as e:
        _log("porta %d ocupada (ja rodando?) - encerrando: %s" % (porta, e))
        return
    _log("ouvindo em http://127.0.0.1:%d (Ctrl+C para parar)" % porta)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
