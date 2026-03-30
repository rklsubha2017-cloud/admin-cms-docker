import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy import text
from database import engine
from datetime import datetime

def run_daily_amc_scan():
    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Executing AMC Expiry Radar...")
    
    try:
        with engine.connect() as conn:
            # 1. Fetch System Preferences
            prefs_row = conn.execute(text("SELECT * FROM system_preferences WHERE id = 1")).mappings().fetchone()
            if not prefs_row:
                print("-> Cancelled: System preferences not found in database.")
                return
            
            prefs = dict(prefs_row)
            
            if not prefs.get('smtp_host') or not prefs.get('smtp_pass'):
                print("-> Cancelled: SMTP credentials are not configured in Settings.")
                return

            days_before = prefs.get('alert_days_before') or 30

            # 2. Find Expiring Clients (Exactly matching the days_before target)
            expiring_clients = conn.execute(
                text("""
                    SELECT c.client_code, c.project_name, c.region, 
                           COALESCE(cs.current_amc_expiry, cs.warranty_end_date) as expiry_date
                    FROM clients c
                    JOIN client_services cs ON c.client_code = cs.client_code
                    WHERE c.status = 'Active' 
                      AND DATEDIFF(COALESCE(cs.current_amc_expiry, cs.warranty_end_date), CURRENT_DATE) = :days
                """),
                {"days": days_before}
            ).mappings().all()

            if not expiring_clients:
                print(f"-> Clear: No AMCs expiring in exactly {days_before} days.")
                return

            print(f"-> Action Required: Found {len(expiring_clients)} contract(s) expiring soon.")

            # 3. Fetch Regional Routing Map
            routes = conn.execute(text("SELECT region_name, manager_email FROM region_routing")).mappings().all()
            route_map = {r['region_name'].lower(): r['manager_email'] for r in routes}

            # 4. Initialize SMTP Server
            print(f"-> Connecting to SMTP Server ({prefs['smtp_host']})...")
            server = smtplib.SMTP(prefs['smtp_host'], prefs['smtp_port'])
            server.starttls()
            server.login(prefs['smtp_user'], prefs['smtp_pass'])

            # 5. Build and Send Emails
            fallback_email = prefs['sender_email'] # Used if a client's region isn't mapped

            for client in expiring_clients:
                client_region = str(client['region']).lower() if client['region'] else "unassigned"
                target_email = route_map.get(client_region, fallback_email)
                
                # Inject variables into the Template
                subject = (prefs.get('email_subject') or "Action Required: AMC Expiring for {site_name}") \
                          .replace("{site_name}", client['project_name']) \
                          .replace("{client_code}", client['client_code'])
                          
                body = (prefs.get('email_body') or "The AMC for {site_name} expires on {expiry_date}.") \
                       .replace("{site_name}", client['project_name']) \
                       .replace("{client_code}", client['client_code']) \
                       .replace("{expiry_date}", str(client['expiry_date']))

                # Construct Email Container
                msg = MIMEMultipart()
                msg['From'] = prefs['sender_email']
                msg['To'] = target_email
                msg['Subject'] = subject
                msg.attach(MIMEText(body, 'plain'))

                # Dispatch
                server.send_message(msg)
                print(f"   [Sent] Alert for {client['client_code']} sent to {target_email} (Region: {client['region']})")

            # 6. Teardown
            server.quit()
            print("-> Success: All expiry alerts dispatched successfully.\n")

    except Exception as e:
        print(f"\n[CRITICAL ERROR] Automation Engine Failed: {e}\n")
