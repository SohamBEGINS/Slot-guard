from sqlalchemy import text
from app.db.database import engine

def add_column():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE simulation_runs ADD COLUMN created_by VARCHAR;"))
            conn.commit()
            print("Successfully added 'created_by' column to simulation_runs.")
        except Exception as e:
            print(f"Error (column might already exist): {e}")

if __name__ == "__main__":
    add_column()
