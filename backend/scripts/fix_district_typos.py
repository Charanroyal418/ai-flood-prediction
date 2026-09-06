"""
Migration script to audit and correct any district name typos in PostgreSQL / SQLite databases.
Specifically fixes corrupted names like 'Naaaoattinam' -> 'Nagapattinam' across districts and alerts tables.
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app.db.base
from app.db.session import SessionLocal
from app.models.district import District
from app.models.alert import Alert

TYPO_CORRECTIONS = {
    "naaaoattinam": "Nagapattinam",
    "naoattinam": "Nagapattinam",
    "nagapatnam": "Nagapattinam",
}

def run_fix():
    db = SessionLocal()
    try:
        districts = db.query(District).all()
        updated_districts = 0
        for d in districts:
            if not d.name:
                continue
            clean = d.name.strip().lower()
            if clean in TYPO_CORRECTIONS:
                correct = TYPO_CORRECTIONS[clean]
                print(f"Fixing district {d.id}: {d.name} -> {correct}")
                d.name = correct
                updated_districts += 1
        
        alerts = db.query(Alert).all()
        updated_alerts = 0
        for a in alerts:
            if a.message:
                for typo, correct in TYPO_CORRECTIONS.items():
                    if typo in a.message.lower():
                        a.message = a.message.replace(typo, correct).replace(typo.capitalize(), correct)
                        updated_alerts += 1
                        print(f"Fixing alert {a.id} message typo")
                        
        db.commit()
        print(f"District audit complete. Updated {updated_districts} districts and {updated_alerts} alerts.")
    finally:
        db.close()

if __name__ == "__main__":
    run_fix()
