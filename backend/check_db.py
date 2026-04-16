"""Quick database connectivity check for local setup."""
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import inspect, text

load_dotenv(Path(__file__).resolve().parent / ".env")

from app import create_app
from app.extensions import db


app = create_app()

with app.app_context():
    try:
        db.session.execute(text("SELECT 1"))
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()

        print("OK: Database connection succeeded.")
        if tables:
            print(f"OK: Found {len(tables)} table(s): {', '.join(tables)}")
        else:
            print("WARN: Connected, but no tables were found.")
            print("      Run migrations or create the schema before using the app.")
    except Exception as exc:
        print("ERROR: Database connection failed.")
        print(f"       {exc}")
        raise SystemExit(1) from exc
