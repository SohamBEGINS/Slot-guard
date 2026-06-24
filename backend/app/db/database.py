import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load variables from the .env file
load_dotenv()

# Securely grab the cloud PostgreSQL URL
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if not SQLALCHEMY_DATABASE_URL:
    raise ValueError("DATABASE_URL is missing! Please set it in your .env file.")

# Create the engine with pool_pre_ping=True to auto-heal dropped connections.
# Supabase's connection pooler can drop idle connections, so this is essential.
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,      # Checks if the connection is alive before using it
    pool_recycle=300,        # Recycle connections after 5 minutes (before Supabase kills them)
    pool_size=5,             # Max 5 persistent connections
    max_overflow=10,         # Allow 10 temporary connections on top of that
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """
    FastAPI Dependency to generate a fresh database session per HTTP request.
    It yields the session and safely closes it after the request finishes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
