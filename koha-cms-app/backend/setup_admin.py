import bcrypt
from sqlalchemy import text
from database import engine

username = "admin"
raw_password = "Admin@123"

# Modern bcrypt hashing
password_bytes = raw_password.encode('utf-8')
hashed_password_bytes = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
hashed_password_str = hashed_password_bytes.decode('utf-8')

try:
    with engine.begin() as conn:
        # Check if user exists first to avoid duplicate errors
        conn.execute(text("DELETE FROM users WHERE username = :u"), {"u": username})

        # Insert with ALL the new RBAC permissions set to TRUE
        conn.execute(
            text("""
                INSERT INTO users (
                    username, password_hash, role, 
                    can_manage_clients, can_manage_accounting, 
                    can_manage_tickets, can_view_reports, is_superadmin
                ) VALUES (
                    :u, :p, 'Admin', 
                    TRUE, TRUE, TRUE, TRUE, TRUE
                )
            """),
            {"u": username, "p": hashed_password_str}
        )
    print(f"SUCCESS: Superadmin user '{username}' created with full module permissions.")
except Exception as e:
    print(f"FAILED: {e}")
