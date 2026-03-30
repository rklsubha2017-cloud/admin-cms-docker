import os
from sqlalchemy import create_engine
from dotenv import load_dotenv

# Load the environment variables from the .env file
load_dotenv()

# Build the connection string
DB_URL = f"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASS')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"

# Create the engine with a connection pool (5 kept alive, max 10 overflow)
engine = create_engine(DB_URL, pool_size=5, max_overflow=10)
