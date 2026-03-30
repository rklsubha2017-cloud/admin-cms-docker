from cryptography.fernet import Fernet
from apscheduler.schedulers.background import BackgroundScheduler
from automation_engine import run_daily_amc_scan
import bcrypt
import jwt
from auth_helper import get_current_user
from datetime import datetime, timedelta
from passlib.context import CryptContext
import os
import json
import shutil
import csv
import io
import pdfkit
from fastapi import FastAPI, HTTPException, Depends, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse, Response
from pydantic import BaseModel
from sqlalchemy import text
from database import engine
from typing import Optional, List
from datetime import date, time, datetime, timedelta

app = FastAPI(title="Koha Client Management API")
templates = Jinja2Templates(directory="templates")

# --- BACKGROUND AUTOMATION SCHEDULER ---
scheduler = BackgroundScheduler()

def check_and_run_scheduler():
    """Wakes up every minute to check if the current time matches the DB cron time."""
    try:
        with engine.connect() as conn:
            prefs = conn.execute(text("SELECT cron_run_time FROM system_preferences WHERE id = 1")).fetchone()
            if prefs and prefs[0] is not None:
                db_time = prefs[0] 
                now = datetime.now()
                
                # --- THE FIX: Handle both timedelta and time objects safely ---
                if isinstance(db_time, timedelta):
                    # Extract hours and minutes from raw seconds
                    db_hour = db_time.seconds // 3600
                    db_minute = (db_time.seconds // 60) % 60
                else:
                    # It's a standard time object
                    db_hour = db_time.hour
                    db_minute = db_time.minute
                
                # If current hour and minute match the database, fire the engine!
                if now.hour == db_hour and now.minute == db_minute:
                    print(">>> Triggering Daily AMC Scan... <<<")
                    run_daily_amc_scan()
                    
    except Exception as e:
        print(f"Scheduler check failed: {e}")

# Add the job to check the clock at the top of every minute
scheduler.add_job(check_and_run_scheduler, 'cron', minute='*')

@app.on_event("startup")
def startup_event():
    scheduler.start()
    print(">>> Background Automation Scheduler Started <<<")

@app.on_event("shutdown")
def shutdown_event():
    scheduler.shutdown()

# ---------------------------------------

# Security Configurations
SECRET_KEY = os.getenv("JWT_SECRET", "fallback_secret_do_not_use_in_prod")
# --- VAULT ENCRYPTION ENGINE ---
# VERY IMPORTANT: Keep this key safe. If you lose it, you cannot decrypt your client passwords!
VAULT_ENCRYPTION_KEY = os.getenv("VAULT_KEY", b"z8JwIPWV42AiYkh03kJjAprBULTOMo3AiBsnl4YnFGI=")
# --- SECURE VAULT FILE STORAGE ---
SECURE_VAULT_DIR = os.path.join(os.path.dirname(__file__), "secure_vault_files")
os.makedirs(SECURE_VAULT_DIR, exist_ok=True)
cipher_suite = Fernet(VAULT_ENCRYPTION_KEY)
def encrypt_val(clear_text: str) -> str:
    """Encrypts a plain text string into a secure cipher."""
    if not clear_text:
        return None
    return cipher_suite.encrypt(clear_text.encode('utf-8')).decode('utf-8')

def decrypt_val(cipher_text: str) -> str:
    """Decrypts a secure cipher back into plain text."""
    if not cipher_text:
        return None
    try:
        return cipher_suite.decrypt(cipher_text.encode('utf-8')).decode('utf-8')
    except Exception:
        return "ERROR_DECRYPTING"

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 600 # Token lasts for 10 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class LoginRequest(BaseModel):
    username: str
    password: str

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace "*" with your React app's actual IP/domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 1. DATA VALIDATION MODELS (The Bouncers)
# ==========================================

class ClientServiceCreate(BaseModel):
    managed_by: str  # 'Our Company', 'Self-Managed', 'Other'
    vendor_name: Optional[str] = None
    vendor_status: Optional[str] = 'N/A'
    warranty_amc_period_months: Optional[int] = None # Keeping for legacy reference
    responsibility_covers: Optional[str] = None
    koha_installed_on: Optional[date] = None
    current_koha_version: Optional[str] = None
    remarks: Optional[str] = None
    # --- NEW LIFECYCLE DATES ---
    project_start_date: Optional[date] = None
    project_end_date: Optional[date] = None
    warranty_start_date: Optional[date] = None
    warranty_end_date: Optional[date] = None
    current_amc_expiry: Optional[date] = None

class ClientCreate(BaseModel):
    client_code: str
    financial_year: str
    project_name: str
    project_manager: Optional[str] = None
    region: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_number: Optional[str] = None
    primary_contact_email: Optional[str] = None
    service_details: ClientServiceCreate

class ClientUpdate(BaseModel):
    financial_year: str
    project_name: str
    project_manager: Optional[str] = None
    region: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_number: Optional[str] = None
    primary_contact_email: Optional[str] = None
    status: str
    managed_by: str
    vendor_name: Optional[str] = None
    vendor_status: Optional[str] = 'N/A'
    warranty_amc_period_months: Optional[int] = None
    responsibility_covers: Optional[str] = None
    koha_installed_on: Optional[date] = None
    current_koha_version: Optional[str] = None
    remarks: Optional[str] = None
    # --- NEW LIFECYCLE DATES ---
    project_start_date: Optional[date] = None
    project_end_date: Optional[date] = None
    warranty_start_date: Optional[date] = None
    warranty_end_date: Optional[date] = None
    current_amc_expiry: Optional[date] = None

class AccountingCreate(BaseModel):
    client_code: str
    site_name: str
    service_type: str  # 'Fresh Site', 'AMC', 'Migration', 'Other'
    amount_without_gst: float
    tendered_for_years: int
    financial_year: str
    # --- NEW TRANSACTIONAL DATES ---
    renewal_date: Optional[date] = None
    amc_start_date: Optional[date] = None
    amc_end_date: Optional[date] = None

class AccountingUpdate(BaseModel):
    site_name: Optional[str] = None
    service_type: Optional[str] = None
    amount_without_gst: Optional[float] = None
    tendered_for_years: Optional[int] = None
    financial_year: Optional[str] = None
    # --- NEW TRANSACTIONAL DATES ---
    renewal_date: Optional[date] = None
    amc_start_date: Optional[date] = None
    amc_end_date: Optional[date] = None

class TicketCreate(BaseModel):
    ticket_id: str
    client_code: str
    reporter_name: str
    reporter_phone: str
    issue_description: str
    current_koha_version: Optional[str] = None

class TicketUpdate(BaseModel):
    status: str
    remarks: Optional[str] = None
    upgraded_koha_version: Optional[str] = None
    reporter_name: Optional[str] = None
    reporter_phone: Optional[str] = None
    issue_description: Optional[str] = None
    current_koha_version: Optional[str] = None

# --- SYSTEM PREFERENCES MODELS ---
class SystemPreferencesUpdate(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = 587
    smtp_user: Optional[str] = None
    smtp_pass: Optional[str] = None
    sender_email: Optional[str] = None
    cron_run_time: Optional[time] = None
    alert_days_before: Optional[int] = 30
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    session_expiry_value: Optional[int] = 12
    session_expiry_unit: Optional[str] = 'Hours' # 'Hours' or 'Days'

class RegionRoutingCreate(BaseModel):
    region_name: str
    manager_email: str

class RegionRoutingUpdate(BaseModel):
    region_name: Optional[str] = None
    manager_email: Optional[str] = None

class VaultDataUpdate(BaseModel):
    # Remote Access & OS
    os_details: Optional[str] = None
    system_ip: Optional[str] = None
    system_user: Optional[str] = None
    system_pass: Optional[str] = None
    anydesk_id: Optional[str] = None
    anydesk_pw: Optional[str] = None
    teamviewer_id: Optional[str] = None
    teamviewer_pw: Optional[str] = None
    
    # Koha Core & DB
    koha_instance: Optional[str] = None
    koha_staff_port: Optional[str] = None
    koha_opac_port: Optional[str] = None
    plack_enabled: bool = False
    mysql_root_user: Optional[str] = None
    mysql_root_pass: Optional[str] = None
    mysql_db_port: Optional[str] = '3306'
    koha_db_name: Optional[str] = None
    koha_db_user: Optional[str] = None
    koha_db_pass: Optional[str] = None
    
    # Security & Backups
    export_db_enabled: bool = False
    plugin_enabled: bool = False
    autobackup_local: bool = False
    autobackup_gdrive: bool = False
    ufw_global_ports: Optional[str] = None
    ufw_restricted_ports: Optional[str] = None
    ufw_allowed_ips: Optional[str] = None
    
    # Integration
    rfid_db_user: Optional[str] = None
    rfid_db_pass: Optional[str] = None
    sip2_institution_id: Optional[str] = None
    sip2_user: Optional[str] = None
    sip2_pass: Optional[str] = None
    sip2_telnet_port: Optional[str] = None
    sip2_raw_port: Optional[str] = None
    
    # App Logins
    koha_admin_user: Optional[str] = None
    koha_admin_pass: Optional[str] = None
    koha_staff_user: Optional[str] = None
    koha_staff_pass: Optional[str] = None

# --- USER MANAGEMENT MODELS ---
class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "User"
    can_manage_clients: bool = True
    can_manage_accounting: bool = False
    can_manage_tickets: bool = True
    can_view_reports: bool = False
    is_superadmin: bool = False
    can_delete_clients: bool = False
    can_delete_tickets: bool = False
    can_delete_accounting: bool = False
    can_view_vault: bool = False

class UserUpdate(BaseModel):
    role: Optional[str] = None
    password: Optional[str] = None # Optional: only update if provided
    can_manage_clients: Optional[bool] = None
    can_manage_accounting: Optional[bool] = None
    can_manage_tickets: Optional[bool] = None
    can_view_reports: Optional[bool] = None
    is_superadmin: Optional[bool] = None
    can_delete_clients: Optional[bool] = None
    can_delete_tickets: Optional[bool] = None
    can_delete_accounting: Optional[bool] = None
    can_view_vault: Optional[bool] = None

class HandoverPDFRequest(BaseModel):
    client_code: str
    selected_fields: List[str]

# ==========================================
# 1. AUTHENTICATION ENDPOINT
# ==========================================
@app.post("/api/login")
def login(request: LoginRequest):
    with engine.connect() as conn:
        user = conn.execute(
            text("SELECT * FROM users WHERE username = :u"),
            {"u": request.username}
        ).mappings().fetchone()

        if not user:
            raise HTTPException(status_code=401, detail="Invalid username or password")

        # Verify password using modern bcrypt
        password_bytes = request.password.encode('utf-8')
        hashed_bytes = user['password_hash'].encode('utf-8')

        if not bcrypt.checkpw(password_bytes, hashed_bytes):
            raise HTTPException(status_code=401, detail="Invalid username or password")

        # --- DYNAMIC EXPIRY LOGIC ---
        # Fetch the expiry settings from the database
        prefs = conn.execute(text("SELECT session_expiry_value, session_expiry_unit FROM system_preferences WHERE id = 1")).fetchone()
        
        exp_value = 12 # Default fallback
        exp_unit = 'Hours'
        if prefs:
            exp_value = prefs[0] if prefs[0] is not None else 12
            exp_unit = prefs[1] if prefs[1] is not None else 'Hours'
        
        # Calculate the exact expiration time
        if exp_unit == 'Days':
            time_delta = timedelta(days=exp_value)
        else:
            time_delta = timedelta(hours=exp_value)
            
        expire = datetime.utcnow() + time_delta
        
        # Include granular permissions and dynamic expiry in the token!
        token_data = {
            "sub": user['username'], 
            "role": user['role'], 
            "exp": expire,
            "permissions": {
                "can_manage_clients": bool(user['can_manage_clients']),
                "can_manage_accounting": bool(user['can_manage_accounting']),
                "can_manage_tickets": bool(user['can_manage_tickets']),
                "can_delete_clients": bool(user['can_delete_clients']),
                "can_delete_tickets": bool(user['can_delete_tickets']),
                "can_delete_accounting": bool(user['can_delete_accounting']),
                "can_view_vault": bool(user['can_view_vault']) # <-- ADDED HERE
            }
        }
        token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)

        return {
            "access_token": token, 
            "token_type": "bearer", 
            "role": user['role'],
            "permissions": {
                "can_manage_clients": bool(user['can_manage_clients']),
                "can_manage_accounting": bool(user['can_manage_accounting']),
                "can_manage_tickets": bool(user['can_manage_tickets']),
                "can_view_reports": bool(user['can_view_reports']),
                "is_superadmin": bool(user['is_superadmin']),
                "can_delete_clients": bool(user['can_delete_clients']),
                "can_delete_tickets": bool(user['can_delete_tickets']),
                "can_delete_accounting": bool(user['can_delete_accounting']),
                "can_view_vault": bool(user['can_view_vault']) # <-- ADDED HERE
            }
        }

@app.get("/api/generate-service-token")
def generate_service_token(user: dict = Depends(get_current_user)):
    """Generates a 10-year non-expiring token for the Flask Automation Script."""
    if user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Only Admins can generate service tokens.")
    #user: dict = Depends(get_current_user)
    # Create a token that expires in 10 years (3650 days)
    expire = datetime.utcnow() + timedelta(days=3650)
    
    token_data = {
        "sub": "flask_automation_bot", 
        "role": "Admin", 
        "exp": expire,
        "permissions": {
            "can_view_vault": True # Grants access to the auto-ingest route
        }
    }
    
    # Generate the permanent token
    token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    
    return {
        "message": "Copy this token and put it in your Flask .env file as CMS_ADMIN_TOKEN",
        "service_token": token
    }

# ==========================================
# 2. CLIENT ENDPOINTS
# ==========================================

@app.post("/api/clients", status_code=201)
def create_client(client: ClientCreate, user: dict = Depends(get_current_user)):
    try:
        with engine.begin() as conn:
            conn.execute(
                text("""
                    INSERT INTO clients (client_code, financial_year, project_name, project_manager, 
                    region, city, state, primary_contact_name, primary_contact_number, primary_contact_email)
                    VALUES (:cc, :fy, :pn, :pm, :rg, :ct, :st, :cn, :cnum, :cem)
                """),
                {"cc": client.client_code, "fy": client.financial_year, "pn": client.project_name,
                 "pm": client.project_manager, "rg": client.region, "ct": client.city, "st": client.state,
                 "cn": client.primary_contact_name, "cnum": client.primary_contact_number, "cem": client.primary_contact_email}
            )
            
            srv = client.service_details
            
            # ---> SMART LOGIC: Fallback to Warranty Date if AMC Expiry is blank
            active_expiry_date = srv.current_amc_expiry if srv.current_amc_expiry else srv.warranty_end_date

            conn.execute(
                text("""
                    INSERT INTO client_services (client_code, managed_by, vendor_name, vendor_status, 
                    warranty_amc_period_months, responsibility_covers, koha_installed_on, current_koha_version, remarks,
                    project_start_date, project_end_date, warranty_start_date, warranty_end_date, current_amc_expiry)
                    VALUES (:cc, :mb, :vn, :vs, :wamc, :rc, :kio, :ckv, :rem, :psd, :ped, :wsd, :wed, :cae)
                """),
                {"cc": client.client_code, "mb": srv.managed_by, "vn": srv.vendor_name, "vs": srv.vendor_status,
                 "wamc": srv.warranty_amc_period_months, "rc": srv.responsibility_covers, "kio": srv.koha_installed_on,
                 "ckv": srv.current_koha_version, "rem": srv.remarks,
                 "psd": srv.project_start_date, "ped": srv.project_end_date, "wsd": srv.warranty_start_date, 
                 "wed": srv.warranty_end_date, "cae": active_expiry_date}
            )
        return {"message": "Client and Service details created successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transaction failed: {str(e)}")

@app.get("/api/clients")
def get_clients(user: dict = Depends(get_current_user)):
    with engine.begin() as conn:  # Changed to 'begin' so we can do auto-updates
        # 1. AUTO-SUSPEND: If the active date is in the past, suspend them
        conn.execute(text("""
            UPDATE clients 
            SET status = 'Suspended'
            WHERE client_code IN (
                SELECT c.client_code FROM clients c
                JOIN client_services cs ON c.client_code = cs.client_code
                WHERE c.status != 'Suspended' 
                AND COALESCE(cs.current_amc_expiry, cs.warranty_end_date) < CURRENT_DATE
            )
        """))
        
        # 2. AUTO-ACTIVATE: If they renewed and the date is now valid, activate them
        conn.execute(text("""
            UPDATE clients 
            SET status = 'Active'
            WHERE client_code IN (
                SELECT c.client_code FROM clients c
                JOIN client_services cs ON c.client_code = cs.client_code
                WHERE c.status = 'Suspended' 
                AND COALESCE(cs.current_amc_expiry, cs.warranty_end_date) >= CURRENT_DATE
            )
        """))

        # 3. Fetch the fresh, accurate data
        result = conn.execute(text("""
            SELECT 
                c.client_code, c.financial_year, c.project_name, c.project_manager, c.region, c.city, c.state, 
                c.primary_contact_name, c.primary_contact_number, c.primary_contact_email, c.status,
                cs.managed_by, cs.vendor_name, cs.vendor_status, cs.warranty_amc_period_months, 
                cs.responsibility_covers, cs.koha_installed_on, cs.current_koha_version, cs.remarks,
                cs.project_start_date, cs.project_end_date, cs.warranty_start_date, cs.warranty_end_date, cs.current_amc_expiry
            FROM clients c
            JOIN client_services cs ON c.client_code = cs.client_code
            ORDER BY c.created_at DESC
        """)).mappings().all()
        return result

@app.put("/api/clients/{client_code}")
def update_client(client_code: str, client: ClientUpdate, user: dict = Depends(get_current_user)):
    try:
        with engine.begin() as conn:
            conn.execute(
                text("""
                    UPDATE clients SET 
                    financial_year=:fy, project_name=:pn, project_manager=:pm, region=:rg, 
                    city=:ct, state=:st, primary_contact_name=:cn, primary_contact_number=:cnum, 
                    primary_contact_email=:cem, status=:status
                    WHERE client_code=:cc
                """),
                {"cc": client_code, "fy": client.financial_year, "pn": client.project_name, "pm": client.project_manager, 
                 "rg": client.region, "ct": client.city, "st": client.state, "cn": client.primary_contact_name, 
                 "cnum": client.primary_contact_number, "cem": client.primary_contact_email, "status": client.status}
            )
            
            # ---> SMART LOGIC: Fallback to Warranty Date if AMC Expiry is blank
            active_expiry_date = client.current_amc_expiry if client.current_amc_expiry else client.warranty_end_date

            conn.execute(
                text("""
                    UPDATE client_services SET 
                    managed_by=:mb, vendor_name=:vn, vendor_status=:vs, warranty_amc_period_months=:wamc, 
                    responsibility_covers=:rc, koha_installed_on=:kio, current_koha_version=:ckv, remarks=:rem,
                    project_start_date=:psd, project_end_date=:ped, warranty_start_date=:wsd, 
                    warranty_end_date=:wed, current_amc_expiry=:cae
                    WHERE client_code=:cc
                """),
                {"cc": client_code, "mb": client.managed_by, "vn": client.vendor_name, "vs": client.vendor_status,
                 "wamc": client.warranty_amc_period_months, "rc": client.responsibility_covers, "kio": client.koha_installed_on,
                 "ckv": client.current_koha_version, "rem": client.remarks,
                 "psd": client.project_start_date, "ped": client.project_end_date, "wsd": client.warranty_start_date, 
                 "wed": client.warranty_end_date, "cae": active_expiry_date}
            )
        return {"message": "Client updated successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transaction failed: {str(e)}")

@app.delete("/api/clients/{client_code}")
def delete_client(client_code: str, user: dict = Depends(get_current_user)):
    """Deletes a client ONLY if they have no associated tickets or accounting records."""
    
    # ---> SECURED: Now strictly checks the granular 'can_delete_clients' permission <---
    if not user.get("permissions", {}).get("can_delete_clients") and user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Permission denied to delete clients.")

    try:
        with engine.begin() as conn:
            # 1. Check constraints
            tickets_count = conn.execute(
                text("SELECT COUNT(*) FROM tickets WHERE client_code = :cc"), 
                {"cc": client_code}
            ).scalar()
            
            accounting_count = conn.execute(
                text("SELECT COUNT(*) FROM accounting WHERE client_code = :cc"), 
                {"cc": client_code}
            ).scalar()

            # 2. Block deletion if records exist
            if tickets_count > 0 or accounting_count > 0:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Safety Lock: Cannot delete '{client_code}'. They are linked to {tickets_count} ticket(s) and {accounting_count} accounting record(s). Please delete attached records first."
                )

            # 3. Safe to delete
            conn.execute(text("DELETE FROM client_services WHERE client_code = :cc"), {"cc": client_code})
            conn.execute(text("DELETE FROM clients WHERE client_code = :cc"), {"cc": client_code})

        return {"message": f"Client {client_code} permanently deleted."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete client: {str(e)}")


# ==========================================
# --- VAULT ENDPOINTS ---
# NOTE: Specific routes (auto-ingest, stunnel) MUST be placed 
# BEFORE generic routes ({client_code}) to prevent routing conflicts.
# ==========================================

@app.post("/api/vault/auto-ingest")
async def auto_ingest_vault(
    payload: str = Form(...), 
    file: Optional[UploadFile] = File(None), 
    user: dict = Depends(get_current_user)
):
    """Bridge for the Flask App to automatically upload passwords and the Stunnel ZIP."""
    
    # 1. Security Check
    if not user.get("permissions", {}).get("can_view_vault") and user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Vault access denied.")

    # 2. Parse the JSON Payload
    try:
        data = json.loads(payload)
        client_code = data.get("client_code")
        if not client_code:
            raise HTTPException(status_code=400, detail="client_code is missing")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON payload: {str(e)}")

    # 3. Handle the File Upload
    saved_file_path = None
    if file:
        saved_file_path = os.path.join(SECURE_VAULT_DIR, f"{client_code}_stunnel.zip")
        with open(saved_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

    # 4. Save to Database (Using COALESCE for partial updates)
    try:
        with engine.begin() as conn:
            conn.execute(
                text("""
                    INSERT INTO client_technical_vault (
                        client_code, os_details, system_ip, system_user, system_pass_enc,
                        anydesk_id, anydesk_pw_enc, teamviewer_id, teamviewer_pw_enc,
                        koha_instance, koha_staff_port, koha_opac_port, plack_enabled,
                        mysql_root_user, mysql_root_pass_enc, mysql_db_port, koha_db_name, koha_db_user, koha_db_pass_enc,
                        export_db_enabled, plugin_enabled, autobackup_local, autobackup_gdrive,
                        ufw_global_ports, ufw_restricted_ports, ufw_allowed_ips,
                        rfid_db_user, rfid_db_pass_enc, sip2_institution_id, sip2_user, sip2_pass_enc, sip2_telnet_port, sip2_raw_port,
                        koha_admin_user, koha_admin_pass_enc, koha_staff_user, koha_staff_pass_enc,
                        stunnel_zip_path
                    ) VALUES (
                        :cc, :os, :ip, :su, :sp, :aid, :apw, :tid, :tpw,
                        :ki, :ksp, :kop, :pe, :mru, :mrp, :mdp, :kdn, :kdu, :kdp,
                        :ede, :ple, :abl, :abg, :ugp, :urp, :uai,
                        :rdu, :rdp, :sii, :su2, :sp2, :stp, :srp,
                        :kau, :kap, :ksu, :ksp2, :szp
                    ) ON DUPLICATE KEY UPDATE
                        system_ip=COALESCE(VALUES(system_ip), system_ip), 
                        koha_instance=COALESCE(VALUES(koha_instance), koha_instance),
                        koha_staff_port=COALESCE(VALUES(koha_staff_port), koha_staff_port),
                        koha_opac_port=COALESCE(VALUES(koha_opac_port), koha_opac_port),
                        plack_enabled=COALESCE(VALUES(plack_enabled), plack_enabled),
                        koha_db_user=COALESCE(VALUES(koha_db_user), koha_db_user),
                        koha_db_pass_enc=COALESCE(VALUES(koha_db_pass_enc), koha_db_pass_enc),
                        sip2_institution_id=COALESCE(VALUES(sip2_institution_id), sip2_institution_id),
                        sip2_user=COALESCE(VALUES(sip2_user), sip2_user),
                        sip2_pass_enc=COALESCE(VALUES(sip2_pass_enc), sip2_pass_enc),
                        sip2_telnet_port=COALESCE(VALUES(sip2_telnet_port), sip2_telnet_port),
                        sip2_raw_port=COALESCE(VALUES(sip2_raw_port), sip2_raw_port),
                        koha_admin_user=COALESCE(VALUES(koha_admin_user), koha_admin_user),
                        koha_admin_pass_enc=COALESCE(VALUES(koha_admin_pass_enc), koha_admin_pass_enc),
                        autobackup_local=COALESCE(VALUES(autobackup_local), autobackup_local),
                        autobackup_gdrive=COALESCE(VALUES(autobackup_gdrive), autobackup_gdrive),
                        ufw_global_ports=COALESCE(VALUES(ufw_global_ports), ufw_global_ports),
                        ufw_restricted_ports=COALESCE(VALUES(ufw_restricted_ports), ufw_restricted_ports),
                        ufw_allowed_ips=COALESCE(VALUES(ufw_allowed_ips), ufw_allowed_ips),
                        rfid_db_user=COALESCE(VALUES(rfid_db_user), rfid_db_user),
                        rfid_db_pass_enc=COALESCE(VALUES(rfid_db_pass_enc), rfid_db_pass_enc),
                        stunnel_zip_path=COALESCE(VALUES(stunnel_zip_path), stunnel_zip_path)
                """),
                {
                    "cc": client_code, 
                    "os": data.get("os_details"), 
                    "ip": data.get("system_ip"), 
                    "su": data.get("system_user"), 
                    "sp": encrypt_val(data.get("system_pass")) if data.get("system_pass") else None,
                    "aid": data.get("anydesk_id"), 
                    "apw": encrypt_val(data.get("anydesk_pw")) if data.get("anydesk_pw") else None, 
                    "tid": data.get("teamviewer_id"), 
                    "tpw": encrypt_val(data.get("teamviewer_pw")) if data.get("teamviewer_pw") else None,
                    "ki": data.get("koha_instance"), 
                    "ksp": data.get("koha_staff_port"), 
                    "kop": data.get("koha_opac_port"), 
                    "pe": data.get("plack_enabled", False),
                    "mru": data.get("mysql_root_user"), 
                    "mrp": encrypt_val(data.get("mysql_root_pass")) if data.get("mysql_root_pass") else None, 
                    "mdp": data.get("mysql_db_port"),
                    "kdn": data.get("koha_db_name"), 
                    "kdu": data.get("koha_db_user"), 
                    "kdp": encrypt_val(data.get("koha_db_pass")) if data.get("koha_db_pass") else None,
                    "ede": data.get("export_db_enabled", False), 
                    "ple": data.get("plugin_enabled", False), 
                    "abl": data.get("autobackup_local", False), 
                    "abg": data.get("autobackup_gdrive", False),
                    "ugp": data.get("ufw_global_ports"), 
                    "urp": data.get("ufw_restricted_ports"), 
                    "uai": data.get("ufw_allowed_ips"),
                    "rdu": data.get("rfid_db_user"), 
                    "rdp": encrypt_val(data.get("rfid_db_pass")) if data.get("rfid_db_pass") else None, 
                    "sii": data.get("sip2_institution_id"), 
                    "su2": data.get("sip2_user"), 
                    "sp2": encrypt_val(data.get("sip2_pass")) if data.get("sip2_pass") else None,
                    "stp": data.get("sip2_telnet_port"), 
                    "srp": data.get("sip2_raw_port"),
                    "kau": data.get("koha_admin_user"), 
                    "kap": encrypt_val(data.get("koha_admin_pass")) if data.get("koha_admin_pass") else None, 
                    "ksu": data.get("koha_staff_user"), 
                    "ksp2": encrypt_val(data.get("koha_staff_pass")) if data.get("koha_staff_pass") else None,
                    "szp": saved_file_path
                }
            )
        return {"message": "Vault securely populated from automated installer!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

@app.get("/api/vault/stunnel/{client_code}")
def download_stunnel_zip(client_code: str, user: dict = Depends(get_current_user)):
    """Securely downloads the Stunnel ZIP file if the user has Vault permissions."""
    with engine.connect() as conn:
        if not user.get("permissions", {}).get("can_view_vault") and user.get("role") != "Admin":
            raise HTTPException(status_code=403, detail="Vault access denied.")
            
        record = conn.execute(text("SELECT stunnel_zip_path FROM client_technical_vault WHERE client_code = :cc"), {"cc": client_code}).fetchone()
        
        if not record or not record[0] or not os.path.exists(record[0]):
            raise HTTPException(status_code=404, detail="Stunnel configuration file not found for this client.")
            
        return FileResponse(
            path=record[0], 
            media_type='application/zip', 
            filename=f"{client_code}_stunnel_config.zip"
        )

@app.get("/api/vault/{client_code}")
def get_vault_data(client_code: str, user: dict = Depends(get_current_user)):
    """Fetches the technical vault for a client, decrypting passwords if authorized."""
    with engine.connect() as conn:
        # 1. Ultra-Strict Security Check
        user_check = conn.execute(text("SELECT can_view_vault FROM users WHERE username = :u"), {"u": user['sub']}).fetchone()
        if (not user_check or not user_check[0]) and user.get("role") != "Admin":
            raise HTTPException(status_code=403, detail="Vault access denied. You lack clearance.")

        # 2. Fetch the Record
        record = conn.execute(text("SELECT * FROM client_technical_vault WHERE client_code = :cc"), {"cc": client_code}).mappings().fetchone()
        
        if not record:
            return {} # Return empty object if vault hasn't been created yet

        # 3. Decrypt the passwords safely before sending to the frontend
        vault_dict = dict(record)
        vault_dict['system_pass'] = decrypt_val(vault_dict.pop('system_pass_enc', None))
        vault_dict['anydesk_pw'] = decrypt_val(vault_dict.pop('anydesk_pw_enc', None))
        vault_dict['teamviewer_pw'] = decrypt_val(vault_dict.pop('teamviewer_pw_enc', None))
        vault_dict['mysql_root_pass'] = decrypt_val(vault_dict.pop('mysql_root_pass_enc', None))
        vault_dict['koha_db_pass'] = decrypt_val(vault_dict.pop('koha_db_pass_enc', None))
        vault_dict['rfid_db_pass'] = decrypt_val(vault_dict.pop('rfid_db_pass_enc', None))
        vault_dict['sip2_pass'] = decrypt_val(vault_dict.pop('sip2_pass_enc', None))
        vault_dict['koha_admin_pass'] = decrypt_val(vault_dict.pop('koha_admin_pass_enc', None))
        vault_dict['koha_staff_pass'] = decrypt_val(vault_dict.pop('koha_staff_pass_enc', None))

        return vault_dict

@app.post("/api/vault/generate-handover")
def generate_handover_pdf(request: HandoverPDFRequest, user: dict = Depends(get_current_user)):
    """Generates a secure, customized PDF Handover document. STRICTLY ADMIN ONLY."""
    
    # 1. Ruthless Security Check (Admins only)
    if user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Only Admins can generate official handover documents.")

    client_code = request.client_code
    selected_fields = request.selected_fields

    if not selected_fields:
        raise HTTPException(status_code=400, detail="You must select at least one field to generate a document.")

    try:
        # 2. Fetch and decrypt the Vault Data
        # We reuse the logic from get_vault_data to ensure passwords are decrypted properly
        vault_data = get_vault_data(client_code, user)
        if not vault_data:
            raise HTTPException(status_code=404, detail="No vault data exists for this client.")

        # 3. ---> NEW: Fetch the actual Client Name (project_name) from the database
        with engine.connect() as conn:
            client_record = conn.execute(
                text("SELECT project_name FROM clients WHERE client_code = :cc"),
                {"cc": client_code}
            ).fetchone()
            
            # Fallback just in case the client record is missing
            client_name = client_record[0] if client_record else "Unknown Client"

        # 4. Render the HTML using Jinja2
        # We pass the vault data and the array of requested fields to the template
        template = templates.get_template("handover_template.html")
        html_content = template.render({
            "client_code": client_code,
            "client_name": client_name,
            "generation_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "vault": vault_data,
            "selected_fields": selected_fields
        })

        # 5. Convert HTML to PDF using pdfkit
        # Options to hide margins and make it look clean
        options = {
            'page-size': 'A4',
            'margin-top': '0.75in',
            'margin-right': '0.75in',
            'margin-bottom': '0.75in',
            'margin-left': '0.75in',
            'encoding': "UTF-8",
            'no-outline': None,
            'enable-local-file-access': None
        }
        
        pdf_bytes = pdfkit.from_string(html_content, False, options=options)

        # 5. Return the PDF as a direct stream
        return Response(
            content=pdf_bytes, 
            media_type="application/pdf", 
            headers={"Content-Disposition": f"attachment; filename=Handover_{client_code}.pdf"}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF Generation failed: {str(e)}")

@app.post("/api/vault/{client_code}")
def save_vault_data(client_code: str, data: VaultDataUpdate, user: dict = Depends(get_current_user)):
    """Creates or updates the technical vault, encrypting passwords before saving."""
    with engine.connect() as conn:
        # 1. Ultra-Strict Security Check
        user_check = conn.execute(text("SELECT can_view_vault FROM users WHERE username = :u"), {"u": user['sub']}).fetchone()
        if (not user_check or not user_check[0]) and user.get("role") != "Admin":
            raise HTTPException(status_code=403, detail="Vault access denied. You lack clearance.")

    try:
        with engine.begin() as conn:
            # 2. Insert or Update (Upsert) with Military-Grade Encryption
            conn.execute(
                text("""
                    INSERT INTO client_technical_vault (
                        client_code, os_details, system_ip, system_user, system_pass_enc,
                        anydesk_id, anydesk_pw_enc, teamviewer_id, teamviewer_pw_enc,
                        koha_instance, koha_staff_port, koha_opac_port, plack_enabled,
                        mysql_root_user, mysql_root_pass_enc, mysql_db_port, koha_db_name, koha_db_user, koha_db_pass_enc,
                        export_db_enabled, plugin_enabled, autobackup_local, autobackup_gdrive,
                        ufw_global_ports, ufw_restricted_ports, ufw_allowed_ips,
                        rfid_db_user, rfid_db_pass_enc, sip2_institution_id, sip2_user, sip2_pass_enc, sip2_telnet_port, sip2_raw_port,
                        koha_admin_user, koha_admin_pass_enc, koha_staff_user, koha_staff_pass_enc
                    ) VALUES (
                        :cc, :os, :ip, :su, :sp, :aid, :apw, :tid, :tpw,
                        :ki, :ksp, :kop, :pe, :mru, :mrp, :mdp, :kdn, :kdu, :kdp,
                        :ede, :ple, :abl, :abg, :ugp, :urp, :uai,
                        :rdu, :rdp, :sii, :su2, :sp2, :stp, :srp,
                        :kau, :kap, :ksu, :ksp2
                    ) ON DUPLICATE KEY UPDATE
                        os_details=VALUES(os_details), system_ip=VALUES(system_ip), system_user=VALUES(system_user),
                        system_pass_enc=VALUES(system_pass_enc), anydesk_id=VALUES(anydesk_id), anydesk_pw_enc=VALUES(anydesk_pw_enc),
                        teamviewer_id=VALUES(teamviewer_id), teamviewer_pw_enc=VALUES(teamviewer_pw_enc),
                        koha_instance=VALUES(koha_instance), koha_staff_port=VALUES(koha_staff_port), koha_opac_port=VALUES(koha_opac_port),
                        plack_enabled=VALUES(plack_enabled), mysql_root_user=VALUES(mysql_root_user), mysql_root_pass_enc=VALUES(mysql_root_pass_enc),
                        mysql_db_port=VALUES(mysql_db_port), koha_db_name=VALUES(koha_db_name), koha_db_user=VALUES(koha_db_user), koha_db_pass_enc=VALUES(koha_db_pass_enc),
                        export_db_enabled=VALUES(export_db_enabled), plugin_enabled=VALUES(plugin_enabled), autobackup_local=VALUES(autobackup_local), autobackup_gdrive=VALUES(autobackup_gdrive),
                        ufw_global_ports=VALUES(ufw_global_ports), ufw_restricted_ports=VALUES(ufw_restricted_ports), ufw_allowed_ips=VALUES(ufw_allowed_ips),
                        rfid_db_user=VALUES(rfid_db_user), rfid_db_pass_enc=VALUES(rfid_db_pass_enc), sip2_institution_id=VALUES(sip2_institution_id), sip2_user=VALUES(sip2_user), sip2_pass_enc=VALUES(sip2_pass_enc),
                        sip2_telnet_port=VALUES(sip2_telnet_port), sip2_raw_port=VALUES(sip2_raw_port),
                        koha_admin_user=VALUES(koha_admin_user), koha_admin_pass_enc=VALUES(koha_admin_pass_enc), koha_staff_user=VALUES(koha_staff_user), koha_staff_pass_enc=VALUES(koha_staff_pass_enc)
                """),
                {
                    "cc": client_code, "os": data.os_details, "ip": data.system_ip, "su": data.system_user, "sp": encrypt_val(data.system_pass),
                    "aid": data.anydesk_id, "apw": encrypt_val(data.anydesk_pw), "tid": data.teamviewer_id, "tpw": encrypt_val(data.teamviewer_pw),
                    "ki": data.koha_instance, "ksp": data.koha_staff_port, "kop": data.koha_opac_port, "pe": data.plack_enabled,
                    "mru": data.mysql_root_user, "mrp": encrypt_val(data.mysql_root_pass), "mdp": data.mysql_db_port,
                    "kdn": data.koha_db_name, "kdu": data.koha_db_user, "kdp": encrypt_val(data.koha_db_pass),
                    "ede": data.export_db_enabled, "ple": data.plugin_enabled, "abl": data.autobackup_local, "abg": data.autobackup_gdrive,
                    "ugp": data.ufw_global_ports, "urp": data.ufw_restricted_ports, "uai": data.ufw_allowed_ips,
                    "rdu": data.rfid_db_user, "rdp": encrypt_val(data.rfid_db_pass), "sii": data.sip2_institution_id, "su2": data.sip2_user, "sp2": encrypt_val(data.sip2_pass),
                    "stp": data.sip2_telnet_port, "srp": data.sip2_raw_port,
                    "kau": data.koha_admin_user, "kap": encrypt_val(data.koha_admin_pass), "ksu": data.koha_staff_user, "ksp2": encrypt_val(data.koha_staff_pass)
                }
            )
        return {"message": "Technical Vault updated securely."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vault update failed: {str(e)}")

# ==========================================
# 3. ACCOUNTING ENDPOINTS
# ==========================================

def sync_client_amc_expiry(conn, client_code: str):
    """
    Scans the accounting ledger for a specific client.
    Finds the absolute latest AMC end date.
    If no AMCs exist, it physically reverts to the Warranty End Date!
    """
    # 1. Find the latest AMC
    latest_amc = conn.execute(
        text("SELECT MAX(amc_end_date) FROM accounting WHERE client_code = :cc AND service_type = 'AMC'"),
        {"cc": client_code}
    ).fetchone()

    latest_date = latest_amc[0] if latest_amc and latest_amc[0] else None

    # 2. If there are no AMCs, fetch the Warranty End Date as the fallback
    if not latest_date:
        warranty_record = conn.execute(
            text("SELECT warranty_end_date FROM client_services WHERE client_code = :cc"),
            {"cc": client_code}
        ).fetchone()
        latest_date = warranty_record[0] if warranty_record and warranty_record[0] else None

    # 3. Update the Master Client table
    conn.execute(
        text("UPDATE client_services SET current_amc_expiry = :expiry WHERE client_code = :cc"),
        {"expiry": latest_date, "cc": client_code}
    )

@app.get("/api/accounting")
def get_accounting_records(user: dict = Depends(get_current_user)):
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT id, client_code, site_name, service_type, 
                   amount_without_gst, tendered_for_years, 
                   financial_year, renewal_date, amc_start_date, amc_end_date, created_at
            FROM accounting
            ORDER BY created_at DESC
        """)).mappings().all()
        return result

@app.post("/api/accounting", status_code=201)
def create_accounting_record(record: AccountingCreate, user: dict = Depends(get_current_user)):
    try:
        with engine.begin() as conn:
            conn.execute(
                text("""
                    INSERT INTO accounting (client_code, site_name, service_type, 
                                            amount_without_gst, tendered_for_years, financial_year,
                                            renewal_date, amc_start_date, amc_end_date)
                    VALUES (:cc, :sn, :st, :amt, :years, :fy, :rdate, :astart, :aend)
                """),
                {
                    "cc": record.client_code, "sn": record.site_name, 
                    "st": record.service_type, "amt": record.amount_without_gst, 
                    "years": record.tendered_for_years, "fy": record.financial_year,
                    "rdate": record.renewal_date, "astart": record.amc_start_date, "aend": record.amc_end_date
                }
            )

            # --- SMART SYNC: Automatically recalculate the master AMC date ---
            sync_client_amc_expiry(conn, record.client_code)

        return {"message": "Accounting record added successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add record: {str(e)}")

@app.put("/api/accounting/{record_id}")
def update_accounting_record(record_id: int, record: AccountingUpdate, user: dict = Depends(get_current_user)):
    try:
        with engine.begin() as conn:
            # Fetch the OLD client code before we update
            old_record = conn.execute(text("SELECT client_code FROM accounting WHERE id = :id"), {"id": record_id}).fetchone()
            old_client_code = old_record[0] if old_record else None
            
            conn.execute(
                text("""
                    UPDATE accounting
                    SET site_name = COALESCE(:sn, site_name),
                        service_type = COALESCE(:st, service_type),
                        amount_without_gst = COALESCE(:amt, amount_without_gst),
                        tendered_for_years = COALESCE(:years, tendered_for_years),
                        financial_year = COALESCE(:fy, financial_year),
                        renewal_date = COALESCE(:rdate, renewal_date),
                        amc_start_date = COALESCE(:astart, amc_start_date),
                        amc_end_date = COALESCE(:aend, amc_end_date)
                    WHERE id = :id
                """),
                {
                    "sn": record.site_name, "st": record.service_type, 
                    "amt": record.amount_without_gst, "years": record.tendered_for_years, 
                    "fy": record.financial_year, "rdate": record.renewal_date,
                    "astart": record.amc_start_date, "aend": record.amc_end_date, "id": record_id
                }
            )

            # --- SMART SYNC ---
            # Sync the new client code (or the current one if it didn't change)
            sync_client_amc_expiry(conn, record.client_code if hasattr(record, 'client_code') and record.client_code else old_client_code)
            
            # If the user literally changed the client_code to a different client, we must recalculate the old client too!
            if hasattr(record, 'client_code') and record.client_code and old_client_code and old_client_code != record.client_code:
                sync_client_amc_expiry(conn, old_client_code)

        return {"message": "Accounting record updated successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")

@app.delete("/api/accounting/{record_id}")
def delete_accounting_record(record_id: int, user: dict = Depends(get_current_user)):
    """Deletes a revenue record and automatically fixes the client's AMC expiry dates."""
    
    # ---> SECURED: Now strictly checks the granular 'can_delete_accounting' permission <---
    if not user.get("permissions", {}).get("can_delete_accounting") and user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Permission denied to delete accounting records.")

    try:
        with engine.begin() as conn:
            # 1. Find who this record belonged to
            existing = conn.execute(text("SELECT client_code FROM accounting WHERE id = :id"), {"id": record_id}).fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="Record not found.")

            client_code = existing[0]

            # 2. Delete the record
            conn.execute(text("DELETE FROM accounting WHERE id = :id"), {"id": record_id})

            # 3. --- SMART SYNC ---
            sync_client_amc_expiry(conn, client_code)

        return {"message": "Record deleted successfully and dates recalculated."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete record: {str(e)}")

# ==========================================
# 4. TICKET ENDPOINTS (Including the Trigger)
# ==========================================

@app.get("/api/tickets")
def get_tickets(user: dict = Depends(get_current_user)):
    """Fetches ALL fields for tickets, joined with the client's project name."""
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT t.ticket_id, t.client_code, c.project_name, 
                   t.reporter_name, t.reporter_phone, 
                   t.issue_description, t.status, 
                   t.current_koha_version, t.upgraded_koha_version, 
                   t.remarks, t.created_on, t.closed_on
            FROM tickets t
            JOIN clients c ON t.client_code = c.client_code
            ORDER BY t.created_on DESC
        """)).mappings().all()
        return result

@app.post("/api/tickets", status_code=201)
def create_ticket(ticket: TicketCreate, user: dict = Depends(get_current_user)):
    try:
        with engine.begin() as conn:
            conn.execute(
                text("""
                    INSERT INTO tickets (ticket_id, client_code, reporter_name, reporter_phone, issue_description, current_koha_version)
                    VALUES (:tid, :cc, :rn, :rp, :id, :ckv)
                """),
                {
                 "tid": ticket.ticket_id, 
                 "cc": ticket.client_code, 
                 "rn": ticket.reporter_name,
                 "rp": ticket.reporter_phone, 
                 "id": ticket.issue_description, 
                 "ckv": ticket.current_koha_version
                }
            )
        return {"message": "Ticket opened successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open ticket: {str(e)}")

@app.put("/api/tickets/{ticket_id}")
def update_ticket(ticket_id: str, ticket: TicketUpdate, user: dict = Depends(get_current_user)):
    """Updates ALL editable ticket fields and syncs Koha version if an upgrade occurred."""
    try:
        with engine.begin() as conn:
            # Update the ticket record
            conn.execute(
                text("""
                    UPDATE tickets
                    SET status = :status, 
                        remarks = :remarks, 
                        upgraded_koha_version = :upgrade,
                        reporter_name = COALESCE(:rn, reporter_name), 
                        reporter_phone = COALESCE(:rp, reporter_phone),
                        issue_description = COALESCE(:id_desc, issue_description),
                        current_koha_version = COALESCE(:ckv, current_koha_version),
                        closed_on = CASE WHEN :status IN ('Closed', 'Temporary Closed') THEN CURRENT_TIMESTAMP ELSE closed_on END
                    WHERE ticket_id = :id
                """),
                {
                    "status": ticket.status, 
                    "remarks": ticket.remarks, 
                    "upgrade": ticket.upgraded_koha_version,
                    "rn": ticket.reporter_name,
                    "rp": ticket.reporter_phone,
                    "id_desc": ticket.issue_description,
                    "ckv": ticket.current_koha_version,
                    "id": ticket_id
                }
            )

            # THE TRIGGER: Sync the master Koha version
            if ticket.upgraded_koha_version:
                client_res = conn.execute(
                    text("SELECT client_code FROM tickets WHERE ticket_id = :id"),
                    {"id": ticket_id}
                ).fetchone()

                if client_res:
                    conn.execute(
                        text("""
                            UPDATE client_services
                            SET current_koha_version = :upgrade
                            WHERE client_code = :client_code
                        """),
                        {"upgrade": ticket.upgraded_koha_version, "client_code": client_res[0]}
                    )
        return {"message": "Ticket updated and versions synchronized."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transaction failed: {str(e)}")


@app.delete("/api/tickets/{ticket_id}")
def delete_ticket(ticket_id: str, user: dict = Depends(get_current_user)):
    """Deletes a ticket from the database. Restricted to Admins and authorized users."""
    
    # ---> SECURED: Now strictly checks the granular 'can_delete_tickets' permission <---
    if not user.get("permissions", {}).get("can_delete_tickets") and user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Permission denied to delete tickets.")

    try:
        with engine.begin() as conn:
            # Check if ticket exists
            existing = conn.execute(text("SELECT ticket_id FROM tickets WHERE ticket_id = :id"), {"id": ticket_id}).fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="Ticket not found.")
                
            # Delete it
            conn.execute(text("DELETE FROM tickets WHERE ticket_id = :id"), {"id": ticket_id})

        return {"message": f"Ticket {ticket_id} deleted successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete ticket: {str(e)}")

# ==========================================
# 5. REPORTS ENDPOINTS)
# ==========================================

@app.get("/api/reports/{report_type}")
def get_reports(report_type: str, user: dict = Depends(get_current_user)):
    try:
        with engine.connect() as conn:
            if report_type == "clients":
                query = text("""
                    SELECT c.client_code, c.financial_year, c.project_name, c.project_manager, 
                           c.region, c.city, c.state, c.primary_contact_name, c.primary_contact_number, 
                           c.primary_contact_email, c.status as client_status, c.created_at as client_created_at,
                           cs.managed_by, cs.vendor_name, cs.vendor_status, cs.responsibility_covers, 
                           cs.koha_installed_on, cs.current_koha_version, cs.remarks as service_remarks,
                           cs.project_start_date, cs.project_end_date, cs.warranty_start_date, cs.warranty_end_date, cs.current_amc_expiry
                    FROM clients c
                    LEFT JOIN client_services cs ON c.client_code = cs.client_code
                    ORDER BY c.created_at DESC
                """)

            elif report_type == "financial":
                query = text("""
                    SELECT a.id as record_id, a.client_code, c.project_name, a.site_name, a.service_type, 
                           a.amount_without_gst, (a.amount_without_gst * 0.18) as calculated_gst, 
                           (a.amount_without_gst * 1.18) as total_contract_value,
                           a.tendered_for_years, a.financial_year, a.renewal_date, a.amc_start_date, a.amc_end_date,
                           a.created_at as logged_on
                    FROM accounting a
                    JOIN clients c ON a.client_code = c.client_code
                    ORDER BY a.financial_year DESC, a.created_at DESC
                """)
            
            elif report_type == "tickets":
                query = text("""
                    SELECT t.ticket_id, t.client_code, c.project_name, t.reporter_name, t.reporter_phone, 
                           t.issue_description, t.status, t.current_koha_version, t.upgraded_koha_version,
                           t.remarks, t.created_on, t.closed_on,
                           IF(t.remarks LIKE '%[Auto-closed after 7 days]%', 'Yes', 'No') as was_auto_closed
                    FROM tickets t
                    JOIN clients c ON t.client_code = c.client_code
                    ORDER BY t.created_on DESC
                """)
            
            elif report_type == "amc":
                # Uses the new absolute dates (AMC Expiry, falling back to Warranty End)
                query = text("""
                    SELECT c.client_code, c.project_name, c.status as client_status, c.primary_contact_name, c.primary_contact_number,
                           cs.koha_installed_on, cs.warranty_end_date, cs.current_amc_expiry,
                           COALESCE(cs.current_amc_expiry, cs.warranty_end_date) as exact_expiry_date,
                           DATEDIFF(COALESCE(cs.current_amc_expiry, cs.warranty_end_date), CURRENT_DATE) as days_until_expiry
                    FROM clients c
                    JOIN client_services cs ON c.client_code = cs.client_code
                    WHERE COALESCE(cs.current_amc_expiry, cs.warranty_end_date) IS NOT NULL
                    ORDER BY days_until_expiry ASC
                """)
            else:
                raise HTTPException(status_code=400, detail="Invalid report type requested.")

            result = conn.execute(query).mappings().all()
            return [dict(row) for row in result]
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")

# ==========================================
# 6. SYSTEM PREFERENCES & ROUTING ENDPOINTS
# ==========================================

@app.get("/api/settings/preferences")
def get_system_preferences(user: dict = Depends(get_current_user)):
    """Fetches the global system preferences (SMTP, Templates, Cron)."""
    if user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Superadmin access required.")
        
    with engine.connect() as conn:
        result = conn.execute(text("SELECT * FROM system_preferences WHERE id = 1")).mappings().fetchone()
        return dict(result) if result else {}

@app.put("/api/settings/preferences")
def update_system_preferences(prefs: SystemPreferencesUpdate, user: dict = Depends(get_current_user)):
    """Updates the global system preferences."""
    if user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Superadmin access required.")
        
    try:
        with engine.begin() as conn:
            conn.execute(
                text("""
                    UPDATE system_preferences SET
                        smtp_host = COALESCE(:host, smtp_host),
                        smtp_port = COALESCE(:port, smtp_port),
                        smtp_user = COALESCE(:suser, smtp_user),
                        smtp_pass = COALESCE(:spass, smtp_pass),
                        sender_email = COALESCE(:semail, sender_email),
                        cron_run_time = COALESCE(:cron, cron_run_time),
                        alert_days_before = COALESCE(:days, alert_days_before),
                        email_subject = COALESCE(:subj, email_subject),
                        email_body = COALESCE(:body, email_body),
                        session_expiry_value = COALESCE(:exp_val, session_expiry_value),
                        session_expiry_unit = COALESCE(:exp_unit, session_expiry_unit)
                    WHERE id = 1
                """),
                {
                    "host": prefs.smtp_host, "port": prefs.smtp_port, "suser": prefs.smtp_user,
                    "spass": prefs.smtp_pass, "semail": prefs.sender_email, "cron": prefs.cron_run_time,
                    "days": prefs.alert_days_before, "subj": prefs.email_subject, "body": prefs.email_body,
                    "exp_val": prefs.session_expiry_value, "exp_unit": prefs.session_expiry_unit
                }
            )
        return {"message": "System preferences updated successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")

@app.get("/api/settings/regions")
def get_region_routing(user: dict = Depends(get_current_user)):
    """Fetches all region-to-email routing rules."""
    with engine.connect() as conn:
        return conn.execute(text("SELECT * FROM region_routing ORDER BY region_name")).mappings().all()

@app.post("/api/settings/regions", status_code=201)
def create_region_routing(route: RegionRoutingCreate, user: dict = Depends(get_current_user)):
    try:
        with engine.begin() as conn:
            conn.execute(
                text("INSERT INTO region_routing (region_name, manager_email) VALUES (:rn, :me)"),
                {"rn": route.region_name, "me": route.manager_email}
            )
        return {"message": "Routing rule created."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create routing: {str(e)}")

@app.delete("/api/settings/regions/{route_id}")
def delete_region_routing(route_id: int, user: dict = Depends(get_current_user)):
    if user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Superadmin access required.")
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM region_routing WHERE id = :id"), {"id": route_id})
    return {"message": "Routing rule deleted."}

# ==========================================
# 7. USER MANAGEMENT & RBAC ENDPOINTS
# ==========================================

@app.get("/api/users")
def get_all_users(user: dict = Depends(get_current_user)):
    if user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Superadmin access required.")
    with engine.connect() as conn:
        # We explicitly DO NOT select the password_hash for security
        # ---> ADDED can_view_vault to the SELECT statement
        result = conn.execute(text("""
            SELECT id, username, role, can_manage_clients, can_manage_accounting, 
                   can_manage_tickets, can_view_reports, is_superadmin,
                   can_delete_clients, can_delete_tickets, can_delete_accounting, 
                   can_view_vault, created_at 
            FROM users ORDER BY created_at DESC
        """)).mappings().all()
        return result

@app.post("/api/users", status_code=201)
def create_new_user(new_user: UserCreate, user: dict = Depends(get_current_user)):
    if user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Superadmin access required.")
    
    # Hash the password using bcrypt
    password_bytes = new_user.password.encode('utf-8')
    hashed_password = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')

    try:
        with engine.begin() as conn:
            conn.execute(
                text("""
                    INSERT INTO users (
                        username, password_hash, role, can_manage_clients, 
                        can_manage_accounting, can_manage_tickets, can_view_reports, is_superadmin,
                        can_delete_clients, can_delete_tickets, can_delete_accounting, can_view_vault
                    ) VALUES (
                        :u, :p, :r, :cmc, :cma, :cmt, :cvr, :sa, :cdc, :cdt, :cda, :cvv
                    )
                """),
                {
                    "u": new_user.username, "p": hashed_password, "r": new_user.role,
                    "cmc": new_user.can_manage_clients, "cma": new_user.can_manage_accounting,
                    "cmt": new_user.can_manage_tickets, "cvr": new_user.can_view_reports, "sa": new_user.is_superadmin,
                    "cdc": new_user.can_delete_clients, "cdt": new_user.can_delete_tickets, "cda": new_user.can_delete_accounting,
                    "cvv": new_user.can_view_vault # <-- ADDED
                }
            )
        return {"message": "User created successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")

@app.put("/api/users/{user_id}")
def update_existing_user(user_id: int, updated_user: UserUpdate, user: dict = Depends(get_current_user)):
    if user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Superadmin access required.")
    
    try:
        with engine.begin() as conn:
            # Update permissions and role
            conn.execute(
                text("""
                    UPDATE users SET 
                        role = COALESCE(:r, role),
                        can_manage_clients = COALESCE(:cmc, can_manage_clients),
                        can_manage_accounting = COALESCE(:cma, can_manage_accounting),
                        can_manage_tickets = COALESCE(:cmt, can_manage_tickets),
                        can_view_reports = COALESCE(:cvr, can_view_reports),
                        is_superadmin = COALESCE(:sa, is_superadmin),
                        can_delete_clients = COALESCE(:cdc, can_delete_clients),
                        can_delete_tickets = COALESCE(:cdt, can_delete_tickets),
                        can_delete_accounting = COALESCE(:cda, can_delete_accounting),
                        can_view_vault = COALESCE(:cvv, can_view_vault)
                    WHERE id = :id
                """),
                {
                    "r": updated_user.role, "cmc": updated_user.can_manage_clients,
                    "cma": updated_user.can_manage_accounting, "cmt": updated_user.can_manage_tickets,
                    "cvr": updated_user.can_view_reports, "sa": updated_user.is_superadmin, 
                    "cdc": updated_user.can_delete_clients, "cdt": updated_user.can_delete_tickets, 
                    "cda": updated_user.can_delete_accounting, 
                    "cvv": updated_user.can_view_vault, # <-- ADDED
                    "id": user_id
                }
            )

            # Update password separately if it was provided
            if updated_user.password:
                password_bytes = updated_user.password.encode('utf-8')
                hashed_password = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')
                conn.execute(
                    text("UPDATE users SET password_hash = :p WHERE id = :id"),
                    {"p": hashed_password, "id": user_id}
                )

        return {"message": "User updated successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")

@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, user: dict = Depends(get_current_user)):
    if user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Superadmin access required.")
    
    try:
        with engine.begin() as conn:
            # Safety Check: Prevent deleting the primary 'admin' account
            target_user = conn.execute(text("SELECT username FROM users WHERE id = :id"), {"id": user_id}).fetchone()
            if target_user and target_user[0] == 'admin':
                raise HTTPException(status_code=400, detail="Cannot delete the primary master admin account.")
                
            conn.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
            
        return {"message": "User deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")

# ==========================================
# 8. BULK CSV IMPORT & TEMPLATE ENDPOINTS
# ==========================================

def generate_csv_template(headers: list, sample_row: list, filename: str):
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(headers)
    writer.writerow(sample_row)
    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename={filename}"
    return response

# --- 1. CLIENT IMPORTS (Includes Master and Services) ---
@app.get("/api/clients/template")
def get_clients_template(user: dict = Depends(get_current_user)):
    headers = [
        "client_code", "financial_year", "project_name", "project_manager", 
        "region", "city", "state", "primary_contact_name", "primary_contact_number", 
        "primary_contact_email", "status", "created_at",
        "managed_by", "vendor_name", "vendor_status", "warranty_amc_period_months", 
        "responsibility_covers", "koha_installed_on", "current_koha_version", 
        "project_start_date", "project_end_date", "warranty_start_date", 
        "warranty_end_date", "current_amc_expiry", "remarks"
    ]
    sample = [
        "LIB-001", "2025-2026", "Central Library", "John Doe", 
        "North", "New Delhi", "Delhi", "Jane Smith", "9876543210", 
        "jane@example.com", "Active", "2024-01-15 10:00:00",
        "Our Company", "", "N/A", "12", 
        "Full support", "2024-01-01", "23.11", 
        "2023-12-01", "2024-01-01", "2024-01-01", 
        "2025-01-01", "2025-01-31", "Historical import"
    ]
    return generate_csv_template(headers, sample, "clients_master_template.csv")

@app.post("/api/clients/import")
async def import_clients(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if not user.get("permissions", {}).get("can_manage_clients") and user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Permission denied.")
        
    contents = await file.read()
    csv_reader = csv.DictReader(io.StringIO(contents.decode('utf-8-sig')))
    success, errors = 0, []

    with engine.connect() as conn:
        for i, row in enumerate(csv_reader, 2):
            try:
                c = {k: (v.strip() if v and v.strip() else None) for k, v in row.items()}
                if not c.get('client_code') or not c.get('project_name'):
                    raise ValueError("Missing 'client_code' or 'project_name'")
                
                # Insert or Update Client Master
                conn.execute(text("""
                    INSERT INTO clients (
                        client_code, financial_year, project_name, project_manager, 
                        region, city, state, primary_contact_name, primary_contact_number, 
                        primary_contact_email, status, created_at
                    ) VALUES (
                        :cc, :fy, :pn, :pm, :rg, :ct, :st, :cn, :cnum, :cem, :status, COALESCE(:ca, CURRENT_TIMESTAMP)
                    ) ON DUPLICATE KEY UPDATE 
                        financial_year=VALUES(financial_year), project_name=VALUES(project_name), 
                        project_manager=VALUES(project_manager), region=VALUES(region), 
                        city=VALUES(city), state=VALUES(state), primary_contact_name=VALUES(primary_contact_name),
                        primary_contact_number=VALUES(primary_contact_number), primary_contact_email=VALUES(primary_contact_email),
                        status=VALUES(status)
                """), {
                    "cc": c['client_code'], "fy": c.get('financial_year', '2025-2026'), 
                    "pn": c['project_name'], "pm": c.get('project_manager'), "rg": c.get('region'), 
                    "ct": c.get('city'), "st": c.get('state'), "cn": c.get('primary_contact_name'), 
                    "cnum": c.get('primary_contact_number'), "cem": c.get('primary_contact_email'), 
                    "status": c.get('status', 'Active'), "ca": c.get('created_at')
                })
                
                # Insert or Update Client Services
                conn.execute(text("""
                    INSERT INTO client_services (
                        client_code, managed_by, vendor_name, vendor_status, warranty_amc_period_months, 
                        responsibility_covers, koha_installed_on, current_koha_version, project_start_date, 
                        project_end_date, warranty_start_date, warranty_end_date, current_amc_expiry, remarks
                    ) VALUES (
                        :cc, :mb, :vn, :vs, :wamc, :rc, :kio, :ckv, :psd, :ped, :wsd, :wed, :cae, :rem
                    ) ON DUPLICATE KEY UPDATE 
                        managed_by=VALUES(managed_by), vendor_name=VALUES(vendor_name), vendor_status=VALUES(vendor_status),
                        warranty_amc_period_months=VALUES(warranty_amc_period_months), responsibility_covers=VALUES(responsibility_covers),
                        koha_installed_on=VALUES(koha_installed_on), current_koha_version=VALUES(current_koha_version),
                        project_start_date=VALUES(project_start_date), project_end_date=VALUES(project_end_date),
                        warranty_start_date=VALUES(warranty_start_date), warranty_end_date=VALUES(warranty_end_date),
                        current_amc_expiry=VALUES(current_amc_expiry), remarks=VALUES(remarks)
                """), {
                    "cc": c['client_code'], "mb": c.get('managed_by', 'Our Company'), 
                    "vn": c.get('vendor_name'), "vs": c.get('vendor_status', 'N/A'), 
                    "wamc": c.get('warranty_amc_period_months'), "rc": c.get('responsibility_covers'), 
                    "kio": c.get('koha_installed_on'), "ckv": c.get('current_koha_version'), 
                    "psd": c.get('project_start_date'), "ped": c.get('project_end_date'), 
                    "wsd": c.get('warranty_start_date'), "wed": c.get('warranty_end_date'), 
                    "cae": c.get('current_amc_expiry'), "rem": c.get('remarks')
                })
                conn.commit()
                success += 1
            except Exception as e:
                conn.rollback()
                errors.append(f"Row {i} ({row.get('client_code', 'Unknown')}): {str(e)}")

    return {"message": f"Successfully processed {success} clients.", "errors": errors}

# --- 2. ACCOUNTING IMPORTS ---
@app.get("/api/accounting/template")
def get_accounting_template(user: dict = Depends(get_current_user)):
    headers = [
        "client_code", "site_name", "service_type", "amount_without_gst", 
        "tendered_for_years", "financial_year", "renewal_date", "amc_start_date", 
        "amc_end_date", "created_at"
    ]
    sample = [
        "LIB-001", "Central Library AMC", "AMC", "50000.00", 
        "1", "2025-2026", "2025-12-01", "2025-01-01", 
        "2026-01-01", "2024-01-15 10:00:00"
    ]
    return generate_csv_template(headers, sample, "accounting_template.csv")

@app.post("/api/accounting/import")
async def import_accounting(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if not user.get("permissions", {}).get("can_manage_accounting") and user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Permission denied.")
        
    contents = await file.read()
    csv_reader = csv.DictReader(io.StringIO(contents.decode('utf-8-sig')))
    success, errors = 0, []

    with engine.connect() as conn:
        for i, row in enumerate(csv_reader, 2):
            try:
                c = {k: (v.strip() if v and v.strip() else None) for k, v in row.items()}
                if not c.get('client_code') or not c.get('amount_without_gst') or not c.get('site_name'):
                    raise ValueError("Missing 'client_code', 'site_name', or 'amount_without_gst'")
                
                # Log Revenue (Append Only)
                conn.execute(text("""
                    INSERT INTO accounting (
                        client_code, site_name, service_type, amount_without_gst, 
                        tendered_for_years, financial_year, renewal_date, amc_start_date, amc_end_date, created_at
                    ) VALUES (
                        :cc, :sn, :st, :amt, :yrs, :fy, :rdate, :astart, :aend, COALESCE(:ca, CURRENT_TIMESTAMP)
                    )
                """), {
                    "cc": c['client_code'], "sn": c['site_name'], "st": c.get('service_type', 'AMC'), 
                    "amt": float(c['amount_without_gst']), "yrs": int(c.get('tendered_for_years', 1)), 
                    "fy": c.get('financial_year', '2025-2026'), "rdate": c.get('renewal_date'),
                    "astart": c.get('amc_start_date'), "aend": c.get('amc_end_date'), "ca": c.get('created_at')
                })
                conn.commit()
                success += 1
            except Exception as e:
                conn.rollback()
                errors.append(f"Row {i} ({row.get('client_code', 'Unknown')}): {str(e)}")

    return {"message": f"Successfully imported {success} accounting records.", "errors": errors}

# --- 3. TICKET IMPORTS (Supports Closed & Historical Tickets) ---
@app.get("/api/tickets/template")
def get_tickets_template(user: dict = Depends(get_current_user)):
    headers = [
        "ticket_id", "client_code", "reporter_name", "reporter_phone", "issue_description", 
        "status", "current_koha_version", "upgraded_koha_version", "remarks", 
        "created_on", "closed_on"
    ]
    sample = [
        "TKT-9999", "LIB-001", "Jane Smith", "9876543210", "System migration needed", 
        "Closed", "22.11", "23.11", "Migration successful", 
        "2023-12-01 10:00:00", "2023-12-05 14:30:00"
    ]
    return generate_csv_template(headers, sample, "tickets_template.csv")

@app.post("/api/tickets/import")
async def import_tickets(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if not user.get("permissions", {}).get("can_manage_tickets") and user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Permission denied.")
        
    contents = await file.read()
    csv_reader = csv.DictReader(io.StringIO(contents.decode('utf-8-sig')))
    success, errors = 0, []

    with engine.connect() as conn:
        for i, row in enumerate(csv_reader, 2):
            try:
                c = {k: (v.strip() if v and v.strip() else None) for k, v in row.items()}
                if not c.get('ticket_id') or not c.get('client_code'):
                    raise ValueError("Missing 'ticket_id' or 'client_code'")
                
                # Insert or Update Ticket
                conn.execute(text("""
                    INSERT INTO tickets (
                        ticket_id, client_code, reporter_name, reporter_phone, issue_description, 
                        status, current_koha_version, upgraded_koha_version, remarks, created_on, closed_on
                    ) VALUES (
                        :tid, :cc, :rn, :rp, :iss, :st, :ckv, :ukv, :rem, COALESCE(:co, CURRENT_TIMESTAMP), :clo
                    ) ON DUPLICATE KEY UPDATE 
                        reporter_name=VALUES(reporter_name), reporter_phone=VALUES(reporter_phone),
                        issue_description=VALUES(issue_description), status=VALUES(status),
                        current_koha_version=VALUES(current_koha_version), upgraded_koha_version=VALUES(upgraded_koha_version),
                        remarks=VALUES(remarks), closed_on=VALUES(closed_on)
                """), {
                    "tid": c['ticket_id'], "cc": c['client_code'], 
                    "rn": c.get('reporter_name', 'System Import'), "rp": c.get('reporter_phone', 'N/A'),
                    "iss": c.get('issue_description', 'Imported Ticket'), "st": c.get('status', 'Open'),
                    "ckv": c.get('current_koha_version'), "ukv": c.get('upgraded_koha_version'),
                    "rem": c.get('remarks'), "co": c.get('created_on'), "clo": c.get('closed_on')
                })
                conn.commit()
                success += 1
            except Exception as e:
                conn.rollback()
                errors.append(f"Row {i} (Ticket {row.get('ticket_id', 'Unknown')}): {str(e)}")

    return {"message": f"Successfully processed {success} tickets.", "errors": errors}
