#!/usr/bin/env python3
"""Malspiel-Archiv: nimmt gemalte Bilder (PNG) vom Kiosk entgegen und lädt sie
nach Sanity hoch (Asset + Dokument 'gemaltesBild').

Läuft als systemd-Dienst (malspiel-upload.service) auf 127.0.0.1:8456,
erreichbar nur über die nginx-Route /malspiel-upload. Der Sanity-Schreib-Token
bleibt damit auf dem Pi und landet nie im Browser.

Test:  curl -X POST -H 'Content-Type: image/png' --data-binary @bild.png \
             http://localhost/malspiel-upload
"""

import json
import time
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

SANITY_PROJECT = "832k5je1"
SANITY_DATASET = "production"
SANITY_API = f"https://{SANITY_PROJECT}.api.sanity.io/v2024-01-01"
TOKEN_FILE = "/etc/museum-kiosk/sanity-token"
KIOSK_CONFIG = "/etc/museum-kiosk/kiosk-id.json"
CONTENT_CACHE = "/var/www/museum/kiosk-content.json"
MAX_BODY = 40 * 1024 * 1024
LISTEN = ("127.0.0.1", 8456)


def read_token():
    with open(TOKEN_FILE) as f:
        return f.read().strip()


def read_kiosk_id():
    try:
        with open(KIOSK_CONFIG) as f:
            return json.load(f).get("kioskId", "unbekannt")
    except Exception:
        return "unbekannt"


def read_malspiel_id():
    try:
        with open(CONTENT_CACHE) as f:
            return json.load(f).get("malspiel_id")
    except Exception:
        return None


def sanity_request(path, data, content_type):
    req = urllib.request.Request(
        f"{SANITY_API}{path}",
        data=data,
        headers={
            "Authorization": f"Bearer {read_token()}",
            "Content-Type": content_type,
        },
    )
    with urllib.request.urlopen(req, timeout=55) as resp:
        return json.load(resp)


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0 or length > MAX_BODY:
            self.respond(413, {"error": "invalid body size"})
            return
        png = self.rfile.read(length)

        kiosk_id = read_kiosk_id()
        now = datetime.now(timezone.utc)
        filename = f"malspiel-{kiosk_id}-{now.strftime('%Y%m%d-%H%M%S')}.png"

        try:
            # 1) PNG als Asset hochladen
            asset = sanity_request(
                f"/assets/images/{SANITY_DATASET}?filename={filename}",
                png,
                "image/png",
            )
            asset_id = asset["document"]["_id"]

            # 2) Dokument anlegen
            doc = {
                "_type": "gemaltesBild",
                "datum": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "kioskId": kiosk_id,
                "bild": {
                    "_type": "image",
                    "asset": {"_type": "reference", "_ref": asset_id},
                },
            }
            malspiel_id = read_malspiel_id()
            if malspiel_id:
                doc["malspiel"] = {"_type": "reference", "_ref": malspiel_id}

            result = sanity_request(
                f"/data/mutate/{SANITY_DATASET}",
                json.dumps({"mutations": [{"create": doc}]}).encode(),
                "application/json",
            )
            self.respond(200, {"ok": True, "asset": asset_id})
            print(f"[malspiel-upload] OK {filename} -> {asset_id}", flush=True)
        except Exception as e:
            print(f"[malspiel-upload] ERROR: {e}", flush=True)
            self.respond(502, {"error": str(e)})

    def respond(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass  # eigenes Logging oben


if __name__ == "__main__":
    print(f"[malspiel-upload] listening on {LISTEN[0]}:{LISTEN[1]}", flush=True)
    HTTPServer(LISTEN, Handler).serve_forever()
