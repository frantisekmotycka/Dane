import base64
import hashlib
import json
import os
import re
import secrets
import sqlite3
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "ocr.db")
ALLOWED_ORIGIN = os.environ.get('ALLOWED_ORIGIN', '*')


def ensure_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                last_seen TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                document_name TEXT,
                supplier_ic TEXT,
                recipient_ic TEXT,
                invoice_number TEXT,
                supplier_dic TEXT,
                recipient_dic TEXT,
                total_amount REAL,
                amount_without_vat REAL,
                vat_rate REAL,
                vat_amount REAL,
                date_text TEXT,
                date_iso TEXT,
                raw_text TEXT,
                data_json TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(date_iso);")
        conn.commit()
        # Ensure new columns for storing original document
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(documents)")
        cols = [r[1] for r in cur.fetchall()]
        if 'document_base64' not in cols:
            conn.execute("ALTER TABLE documents ADD COLUMN document_base64 TEXT;")
        if 'document_mime' not in cols:
            conn.execute("ALTER TABLE documents ADD COLUMN document_mime TEXT;")
        if 'document_filename' not in cols:
            conn.execute("ALTER TABLE documents ADD COLUMN document_filename TEXT;")
        conn.commit()
    finally:
        conn.close()


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def hash_password(password):
    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200000)
    return base64.b64encode(salt + derived).decode("ascii")


def verify_password(password, stored_hash):
    try:
        data = base64.b64decode(stored_hash)
        salt = data[:16]
        stored = data[16:]
        derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200000)
        return secrets.compare_digest(stored, derived)
    except Exception:
        return False


def parse_date_iso(date_text):
    if not date_text:
        return None
    text = str(date_text).strip()
    match = re.match(r"^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$", text)
    if match:
        day, month, year = match.groups()
        if len(year) == 2:
            year = "20" + year if int(year) < 50 else "19" + year
        try:
            return datetime(int(year), int(month), int(day)).strftime("%Y-%m-%d")
        except ValueError:
            return None
    if re.match(r"^\d{4}-\d{2}-\d{2}$", text):
        return text
    return None


class AppHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Allow cross-origin requests from local files / other origins
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        super().end_headers()

    def do_OPTIONS(self):
        # Respond to preflight CORS requests
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.handle_api_get(parsed)
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.handle_api_post(parsed)
            return
        self.send_error(404, "Not Found")

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.handle_api_delete(parsed)
            return
        self.send_error(404, "Not Found")

    def do_PUT(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            # Support update via PUT to /api/documents/<id>
            match_update = re.match(r"^/api/documents/(\d+)$", parsed.path)
            if match_update:
                self.handle_update_document(int(match_update.group(1)))
                return
        self.send_error(404, "Not Found")

    def read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0:
            return {}
        data = self.rfile.read(length)
        try:
            return json.loads(data.decode("utf-8"))
        except json.JSONDecodeError:
            return None

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def get_current_user(self):
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return None
        token = auth.replace("Bearer ", "", 1).strip()
        if not token:
            return None
        conn = get_db()
        try:
            row = conn.execute(
                """
                SELECT users.id, users.username
                FROM sessions
                JOIN users ON users.id = sessions.user_id
                WHERE sessions.token = ?
                """,
                (token,),
            ).fetchone()
            if row:
                conn.execute(
                    "UPDATE sessions SET last_seen = ? WHERE token = ?",
                    (datetime.utcnow().isoformat(), token),
                )
                conn.commit()
                return {"id": row["id"], "username": row["username"], "token": token}
            return None
        finally:
            conn.close()

    def handle_api_get(self, parsed):
        if parsed.path == "/api/health":
            self.send_json({"ok": True})
            return

        if parsed.path == "/api/me":
            user = self.get_current_user()
            if not user:
                self.send_json({"error": "Neprihlasen"}, status=401)
                return
            self.send_json({"user": {"id": user["id"], "username": user["username"]}})
            return

        if parsed.path == "/api/documents":
            self.handle_list_documents(parsed)
            return

        match = re.match(r"^/api/documents/(\d+)$", parsed.path)
        if match:
            self.handle_get_document(int(match.group(1)))
            return

        match_file = re.match(r"^/api/documents/(\d+)/file$", parsed.path)
        if match_file:
            self.handle_get_document_file(int(match_file.group(1)))
            return

        self.send_json({"error": "Not Found"}, status=404)

    def handle_api_post(self, parsed):
        # Support update of a document by POST to /api/documents/<id>
        match_update = re.match(r"^/api/documents/(\d+)$", parsed.path)
        if match_update:
            self.handle_update_document(int(match_update.group(1)))
            return
        if parsed.path == "/api/register":
            self.handle_register()
            return
        if parsed.path == "/api/login":
            self.handle_login()
            return
        if parsed.path == "/api/logout":
            self.handle_logout()
            return
        if parsed.path == "/api/documents":
            self.handle_create_document()
            return
        self.send_json({"error": "Not Found"}, status=404)

    def handle_api_delete(self, parsed):
        match = re.match(r"^/api/documents/(\d+)$", parsed.path)
        if match:
            self.handle_delete_document(int(match.group(1)))
            return
        self.send_json({"error": "Not Found"}, status=404)

    def handle_register(self):
        data = self.read_json()
        if data is None:
            self.send_json({"error": "Neplatny JSON"}, status=400)
            return
        username = str(data.get("username", "")).strip()
        password = str(data.get("password", "")).strip()
        if len(username) < 3 or len(password) < 4:
            self.send_json({"error": "Zadejte uzivatelske jmeno a heslo"}, status=400)
            return

        conn = get_db()
        try:
            conn.execute(
                "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
                (username, hash_password(password), datetime.utcnow().isoformat()),
            )
            conn.commit()
            self.send_json({"ok": True})
        except sqlite3.IntegrityError:
            self.send_json({"error": "Uzivatel uz existuje"}, status=409)
        finally:
            conn.close()

    def handle_login(self):
        data = self.read_json()
        if data is None:
            self.send_json({"error": "Neplatny JSON"}, status=400)
            return
        username = str(data.get("username", "")).strip()
        password = str(data.get("password", "")).strip()
        if not username or not password:
            self.send_json({"error": "Zadejte uzivatelske jmeno a heslo"}, status=400)
            return

        conn = get_db()
        try:
            row = conn.execute(
                "SELECT id, password_hash FROM users WHERE username = ?", (username,)
            ).fetchone()
            if not row or not verify_password(password, row["password_hash"]):
                self.send_json({"error": "Spatne prihlasovaci udaje"}, status=401)
                return

            token = secrets.token_urlsafe(32)
            now = datetime.utcnow().isoformat()
            conn.execute(
                "INSERT INTO sessions (user_id, token, created_at, last_seen) VALUES (?, ?, ?, ?)",
                (row["id"], token, now, now),
            )
            conn.commit()
            self.send_json({"token": token, "user": {"id": row["id"], "username": username}})
        finally:
            conn.close()

    def handle_logout(self):
        user = self.get_current_user()
        if not user:
            self.send_json({"ok": True})
            return
        conn = get_db()
        try:
            conn.execute("DELETE FROM sessions WHERE token = ?", (user["token"],))
            conn.commit()
            self.send_json({"ok": True})
        finally:
            conn.close()

    def handle_create_document(self):
        user = self.get_current_user()
        if not user:
            self.send_json({"error": "Neprihlasen"}, status=401)
            return
        data = self.read_json()
        if data is None:
            self.send_json({"error": "Neplatny JSON"}, status=400)
            return

        fields = data.get("fields") or {}
        date_text = fields.get("date_text") or ""
        date_iso = parse_date_iso(date_text)
        now = datetime.utcnow().isoformat()

        conn = get_db()
        try:
            conn.execute(
                """
                INSERT INTO documents (
                    user_id, created_at, document_name, supplier_ic, recipient_ic,
                    invoice_number, supplier_dic, recipient_dic, total_amount,
                    amount_without_vat, vat_rate, vat_amount, date_text, date_iso,
                    raw_text, data_json, document_base64, document_mime, document_filename
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user["id"],
                    now,
                    data.get("documentName"),
                    fields.get("supplier_ic"),
                    fields.get("recipient_ic"),
                    fields.get("invoice_number"),
                    fields.get("supplier_dic"),
                    fields.get("recipient_dic"),
                    fields.get("total_amount"),
                    fields.get("amount_without_vat"),
                    fields.get("vat_rate"),
                    fields.get("vat_amount"),
                    date_text,
                    date_iso,
                    data.get("rawText"),
                    json.dumps(data.get("data"), ensure_ascii=False),
                    data.get("documentBase64"),
                    data.get("documentMime"),
                    data.get("documentFilename"),
                ),
            )
            conn.commit()
            self.send_json({"ok": True})
        except sqlite3.DatabaseError as e:
            # Return JSON error instead of letting the server crash
            conn.rollback()
            self.send_json({"error": "Database error", "detail": str(e)}, status=500)
        finally:
            conn.close()

    def handle_list_documents(self, parsed):
        user = self.get_current_user()
        if not user:
            self.send_json({"error": "Neprihlasen"}, status=401)
            return
        params = parse_qs(parsed.query)

        query = "SELECT id, created_at, document_name, supplier_ic, recipient_ic, invoice_number, total_amount, date_text FROM documents WHERE user_id = ?"
        values = [user["id"]]

        def add_like(field, key):
            val = params.get(key, [""])[0].strip()
            if val:
                nonlocal query
                query += f" AND {field} LIKE ?"
                values.append(f"%{val}%")

        add_like("supplier_ic", "supplier_ic")
        add_like("recipient_ic", "recipient_ic")
        add_like("invoice_number", "invoice_number")

        search = params.get("search", [""])[0].strip()
        if search:
            query += " AND (document_name LIKE ? OR supplier_ic LIKE ? OR recipient_ic LIKE ? OR invoice_number LIKE ? OR supplier_dic LIKE ? OR recipient_dic LIKE ?)"
            values.extend([f"%{search}%"] * 6)

        date_from = params.get("date_from", [""])[0].strip()
        date_to = params.get("date_to", [""])[0].strip()
        if date_from:
            query += " AND date_iso >= ?"
            values.append(date_from)
        if date_to:
            query += " AND date_iso <= ?"
            values.append(date_to)

        min_total = params.get("min_total", [""])[0].strip()
        max_total = params.get("max_total", [""])[0].strip()
        if min_total:
            query += " AND total_amount >= ?"
            values.append(min_total)
        if max_total:
            query += " AND total_amount <= ?"
            values.append(max_total)

        query += " ORDER BY created_at DESC"

        conn = get_db()
        try:
            rows = conn.execute(query, values).fetchall()
            items = [
                {
                    "id": row["id"],
                    "created_at": row["created_at"],
                    "document_name": row["document_name"],
                    "supplier_ic": row["supplier_ic"],
                    "recipient_ic": row["recipient_ic"],
                    "invoice_number": row["invoice_number"],
                    "total_amount": row["total_amount"],
                    "date_text": row["date_text"],
                }
                for row in rows
            ]
            self.send_json({"items": items})
        finally:
            conn.close()

    def handle_get_document(self, doc_id):
        user = self.get_current_user()
        if not user:
            self.send_json({"error": "Neprihlasen"}, status=401)
            return
        conn = get_db()
        try:
            row = conn.execute(
                """
                SELECT * FROM documents
                WHERE id = ? AND user_id = ?
                """,
                (doc_id, user["id"]),
            ).fetchone()
            if not row:
                self.send_json({"error": "Nenalezeno"}, status=404)
                return
            doc = dict(row)
            self.send_json({"document": doc})
        finally:
            conn.close()

    def handle_get_document_file(self, doc_id):
        # Try Authorization header first
        user = self.get_current_user()

        # If no user via header, allow supplying token as query parameter
        if not user:
            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)
            token_candidates = qs.get('token') or qs.get('t') or []
            if token_candidates:
                token_val = token_candidates[0]
                if token_val:
                    conn_check = get_db()
                    try:
                        row = conn_check.execute(
                            "SELECT users.id, users.username FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ?",
                            (token_val,)
                        ).fetchone()
                        if row:
                            # update last_seen
                            conn_check.execute("UPDATE sessions SET last_seen = ? WHERE token = ?", (datetime.utcnow().isoformat(), token_val))
                            conn_check.commit()
                            user = {"id": row["id"], "username": row["username"], "token": token_val}
                    finally:
                        conn_check.close()

        if not user:
            self.send_json({"error": "Neprihlasen"}, status=401)
            return
        conn = get_db()
        try:
            row = conn.execute(
                "SELECT document_base64, document_mime, document_filename FROM documents WHERE id = ? AND user_id = ?",
                (doc_id, user["id"]),
            ).fetchone()
            if not row:
                self.send_json({"error": "Nenalezeno"}, status=404)
                return

            b64 = row["document_base64"]
            mime = row["document_mime"] or "application/octet-stream"
            filename = row["document_filename"] or f"document_{doc_id}"

            if not b64:
                self.send_json({"error": "Soubor nebyl ulozen"}, status=404)
                return

            data = base64.b64decode(b64)
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(data)))
            # suggest inline display
            self.send_header("Content-Disposition", f'inline; filename="{filename}"')
            self.end_headers()
            self.wfile.write(data)
        finally:
            conn.close()

    def handle_update_document(self, doc_id):
        user = self.get_current_user()
        if not user:
            self.send_json({"error": "Neprihlasen"}, status=401)
            return

        data = self.read_json()
        if data is None:
            self.send_json({"error": "Neplatny JSON"}, status=400)
            return

        fields = data.get("fields") or {}

        allowed = [
            "document_name", "supplier_ic", "recipient_ic", "invoice_number",
            "supplier_dic", "recipient_dic", "total_amount", "amount_without_vat",
            "vat_rate", "vat_amount", "date_text", "raw_text", "data_json",
            "document_base64", "document_mime", "document_filename"
        ]

        sets = []
        values = []
        for k in allowed:
            v = None
            if k in data:
                v = data.get(k)
            elif k in fields:
                v = fields.get(k)
            if v is not None:
                sets.append(f"{k} = ?")
                # store JSON string for data_json if provided as object
                if k == 'data_json' and not isinstance(v, str):
                    values.append(json.dumps(v, ensure_ascii=False))
                else:
                    values.append(v)

        if not sets:
            self.send_json({"ok": True})
            return

        sql = f"UPDATE documents SET {', '.join(sets)} WHERE id = ? AND user_id = ?"
        values.extend([doc_id, user["id"]])

        conn = get_db()
        try:
            conn.execute(sql, values)
            conn.commit()
            self.send_json({"ok": True})
        finally:
            conn.close()

    def handle_delete_document(self, doc_id):
        user = self.get_current_user()
        if not user:
            self.send_json({"error": "Neprihlasen"}, status=401)
            return
        conn = get_db()
        try:
            conn.execute(
                "DELETE FROM documents WHERE id = ? AND user_id = ?",
                (doc_id, user["id"]),
            )
            conn.commit()
            self.send_json({"ok": True})
        finally:
            conn.close()


def run_server():
    ensure_db()
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', os.environ.get('RENDER_PORT', '8000')))
    server = ThreadingHTTPServer((host, port), AppHandler)
    print(f"Server bezi na http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run_server()
