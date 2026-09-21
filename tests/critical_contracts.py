#!/usr/bin/env python3
from pathlib import Path
import json
import re
import sys

errors = []

def read(path):
    p = Path(path)
    if not p.is_file():
        errors.append(f"{path}: arquivo ausente")
        return ""
    return p.read_text(encoding="utf-8")

def need(path, text, needle, message):
    if needle not in text:
        errors.append(f"{path}: {message}")

def no(path, text, pattern, message, flags=0):
    if re.search(pattern, text, flags):
        errors.append(f"{path}: {message}")

app = read("app.js")
sw = read("sw.js")
manifest = read("manifest.webmanifest")

need("app.js", app, "STORAGE_CREDENCIAL_SESSION", "credencial operacional sem armazenamento de sessão")
need("app.js", app, "sessionStorage.setItem(", "credencial não é persistida em sessionStorage")
no(
    "app.js",
    app,
    r"localStorage\.setItem\s*\(\s*CONFIG\.STORAGE_CREDENCIAL_SESSION",
    "credencial operacional não pode persistir em localStorage",
)
need("app.js", app, "window.history.replaceState(", "credencial não é removida da URL após captura")
need("app.js", app, "params.get(\n            'ct_checkin'", "fragmento seguro ct_checkin não é lido")
need("app.js", app, "PREFIXO_VALIDACAO_SEM_ENTRADA", "validação prévia sem registrar entrada ausente")
if app.count("credencial: credencialCheckin") < 2:
    errors.append("app.js: validação e confirmação devem enviar credencial operacional")
need("app.js", app, "confirmarEntradaProfissional(", "confirmação profissional de entrada ausente")
no(
    "app.js",
    app,
    r"(?:window\.(?:alert|confirm|prompt)|(?<![\\w.])(?:alert|confirm|prompt))\\s*\\(",
    "diálogo nativo do navegador em fluxo crítico",
    re.I,
)
need("app.js", app, "TEMPO_TIMEOUT_API_MS: 8000", "timeout de comunicação deve permanecer limitado")
need("app.js", app, "TEMPO_BLOQUEIO_LEITURA_MS", "proteção contra leitura duplicada ausente")
need("app.js", app, "processando", "proteção contra requisição concorrente ausente")
need("app.js", app, "ocultarConfiguracaoTecnica()", "configuração técnica continua exposta ao operador")
need("app.js", app, "API_URL_OFICIAL", "endpoint oficial não está fixado no app")
need("app.js", app, "const url =\n    obterApiUrl();", "teste de conexão ainda confia no campo editável")

try:
    parsed = json.loads(manifest)
    icons = parsed.get("icons") or []
    required = {
        ("carioca-ticket-icon-192.png", "192x192"),
        ("carioca-ticket-icon-maskable-512.png", "512x512"),
    }
    present = {(str(i.get("src","")).lstrip("./"), str(i.get("sizes",""))) for i in icons}
    for item in required:
        if item not in present:
            errors.append(f"manifest.webmanifest: ícone ausente/incorreto {item[0]} {item[1]}")
except Exception as exc:
    errors.append(f"manifest.webmanifest: JSON inválido: {exc}")

need("sw.js", sw, "carioca-ticket-v5", "cache PWA esperado não está versionado")
for asset in [
    "carioca-ticket-icon-192.png",
    "carioca-ticket-icon-512.png",
    "carioca-ticket-icon-maskable-512.png",
]:
    if not Path(asset).is_file():
        errors.append(f"{asset}: asset ausente")

print("CHECK-IN — MATRIZ CRÍTICA")
print(f"- erros: {len(errors)}")
for error in errors:
    print("ERRO:", error)

if errors:
    sys.exit(1)

print("OK: credencial, confirmação, timeout, concorrência, endpoint e PWA passaram.")
