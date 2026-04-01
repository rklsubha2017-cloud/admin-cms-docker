-- Enable Event Scheduler
SET GLOBAL event_scheduler = ON;

-- 1. CLIENT MASTER TABLE
CREATE TABLE clients (
    client_code VARCHAR(50) PRIMARY KEY,
    financial_year VARCHAR(9) NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    project_manager VARCHAR(100),
    region VARCHAR(50),
    city VARCHAR(100),
    state VARCHAR(100),
    primary_contact_name VARCHAR(100),
    primary_contact_number VARCHAR(20),
    primary_contact_email VARCHAR(100),
    status ENUM('Active', 'Suspended') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. CLIENT SERVICE & KOHA DETAILS (Lifecycle Dates)
CREATE TABLE client_services (
    client_code VARCHAR(50) PRIMARY KEY,
    managed_by ENUM('Our Company', 'Self-Managed', 'Other') NOT NULL,
    vendor_name VARCHAR(100) NULL,
    vendor_status ENUM('Active', 'Suspended', 'N/A') DEFAULT 'N/A',
    warranty_amc_period_months INT, -- Can be kept for legacy/reference
    responsibility_covers TEXT,
    koha_installed_on DATE,
    current_koha_version VARCHAR(20),
    project_start_date DATE NULL,
    project_end_date DATE NULL,
    warranty_start_date DATE NULL,
    warranty_end_date DATE NULL,
    current_amc_expiry DATE NULL, -- The absolute truth for when their current contract ends
    remarks TEXT,
    FOREIGN KEY (client_code) REFERENCES clients(client_code) ON DELETE CASCADE
);

-- 3. ACCOUNTING TABLE (Transactional Dates)
CREATE TABLE accounting (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_code VARCHAR(50) NOT NULL,
    site_name VARCHAR(255) NOT NULL,
    service_type ENUM('Fresh Site', 'AMC', 'Migration', 'Other') NOT NULL,
    amount_without_gst DECIMAL(10, 2) NOT NULL,
    tendered_for_years INT NOT NULL,
    financial_year VARCHAR(9) NOT NULL,
    renewal_date DATE NULL,
    amc_start_date DATE NULL,
    amc_end_date DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_code) REFERENCES clients(client_code) ON DELETE CASCADE
);

-- 4. TICKET MANAGEMENT TABLE
CREATE TABLE tickets (
    ticket_id VARCHAR(50) PRIMARY KEY,
    client_code VARCHAR(50) NOT NULL,
    reporter_name VARCHAR(100) NOT NULL,
    reporter_phone VARCHAR(20) NOT NULL,
    issue_description TEXT NOT NULL,
    status ENUM('Open', 'In Progress', 'Temporary Closed', 'Closed') DEFAULT 'Open',
    current_koha_version VARCHAR(20),
    upgraded_koha_version VARCHAR(20) NULL,
    remarks TEXT,
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_on TIMESTAMP NULL,
    FOREIGN KEY (client_code) REFERENCES clients(client_code) ON DELETE CASCADE
); 

-- 5. USERS TABLE (With Granular RBAC Module Permissions)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Admin', 'User') DEFAULT 'Admin',
    can_manage_clients BOOLEAN DEFAULT TRUE,
    can_manage_accounting BOOLEAN DEFAULT FALSE,
    can_manage_tickets BOOLEAN DEFAULT TRUE,
    can_view_reports BOOLEAN DEFAULT FALSE,
    is_superadmin BOOLEAN DEFAULT FALSE,
    -- NEW: Granular Deletion Permissions
    can_delete_clients BOOLEAN DEFAULT FALSE,
    can_delete_tickets BOOLEAN DEFAULT FALSE,
    can_delete_accounting BOOLEAN DEFAULT FALSE,
    can_view_vault BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Insert default admin user (username: admin, password: admin123 - hash this in your application)
INSERT INTO users (username, password_hash, role, is_superadmin, can_manage_clients, can_manage_accounting, can_manage_tickets, can_view_reports) VALUES ('admin',   '$2b$12$YYj67.vFwbQEApuyyDON5O2T1bjYqSrfjzZi2/W48aIuNqJbSkgYS', 'Admin', TRUE, TRUE, TRUE, TRUE, TRUE); 

-- 6. SYSTEM PREFERENCES (Single Row Enforced)
CREATE TABLE system_preferences (
    id INT PRIMARY KEY DEFAULT 1, 
    smtp_host VARCHAR(255),
    smtp_port INT DEFAULT 587,
    smtp_user VARCHAR(255),
    smtp_pass VARCHAR(255),
    sender_email VARCHAR(255),
    cron_run_time TIME DEFAULT '08:00:00',
    alert_days_before INT DEFAULT 30,
    email_subject VARCHAR(255) DEFAULT 'Action Required: AMC Expiring for {site_name}',
    email_body TEXT,
    session_expiry_value INT DEFAULT 12,
    session_expiry_unit ENUM('Hours', 'Days') DEFAULT 'Hours',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CHECK (id = 1)
);
-- Insert default preferences
INSERT INTO system_preferences (id) VALUES (1);

-- 7. REGION TO EMAIL MAPPING
CREATE TABLE region_routing (
    id INT AUTO_INCREMENT PRIMARY KEY,
    region_name VARCHAR(100) UNIQUE NOT NULL,
    manager_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Create the Secure Vault Table
CREATE TABLE client_technical_vault (
    client_code VARCHAR(50) PRIMARY KEY,
    
    -- System & Remote Access
    os_details VARCHAR(255),
    system_ip VARCHAR(100),
    system_user VARCHAR(100),
    system_pass_enc TEXT,        -- Encrypted
    anydesk_id VARCHAR(100),
    anydesk_pw_enc TEXT,         -- Encrypted
    teamviewer_id VARCHAR(100),
    teamviewer_pw_enc TEXT,      -- Encrypted
    
    -- Koha Core & DB (From your "New Installation" & "Deep Inspection" tabs)
    koha_instance VARCHAR(100),
    koha_staff_port VARCHAR(10),
    koha_opac_port VARCHAR(10),
    plack_enabled BOOLEAN DEFAULT FALSE,
    mysql_root_user VARCHAR(100),
    mysql_root_pass_enc TEXT,    -- Encrypted
    mysql_db_port VARCHAR(10) DEFAULT '3306',
    koha_db_name VARCHAR(100),
    koha_db_user VARCHAR(100),
    koha_db_pass_enc TEXT,       -- Encrypted
    
    -- Security & Backups (From your "Network Security" tab)
    export_db_enabled BOOLEAN DEFAULT FALSE,
    plugin_enabled BOOLEAN DEFAULT FALSE,
    autobackup_local BOOLEAN DEFAULT FALSE,
    autobackup_gdrive BOOLEAN DEFAULT FALSE,
    ufw_global_ports VARCHAR(255),
    ufw_restricted_ports VARCHAR(255),
    ufw_allowed_ips VARCHAR(255),
    
    -- Integration (From your "SIP2 Configuration" & "Stunnel Generator" tabs)
    rfid_db_user VARCHAR(100),
    rfid_db_pass_enc TEXT,       -- Encrypted
    sip2_institution_id VARCHAR(100),
    sip2_user VARCHAR(100),
    sip2_pass_enc TEXT,          -- Encrypted
    sip2_telnet_port VARCHAR(10),
    sip2_raw_port VARCHAR(10),
    stunnel_cert_name VARCHAR(100),
    stunnel_server_ip VARCHAR(100),
    stunnel_client_ip VARCHAR(100),
    stunnel_zip_path TEXT,       -- Path to the securely saved file on the server
    
    -- App Logins
    koha_admin_user VARCHAR(100),
    koha_admin_pass_enc TEXT,    -- Encrypted
    koha_staff_user VARCHAR(100),
    koha_staff_pass_enc TEXT,    -- Encrypted
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_code) REFERENCES clients(client_code) ON DELETE CASCADE
);

-- 9. AUTOMATED STATE MANAGEMENT EVENTS
DELIMITER $$

-- Event 1: Close stale tickets
CREATE EVENT auto_close_stale_tickets
ON SCHEDULE EVERY 1 DAY
DO
BEGIN
    UPDATE tickets 
    SET status = 'Closed', remarks = CONCAT(IFNULL(remarks, ''), '\n[Auto-closed after 7 days]')
    WHERE status = 'Temporary Closed' 
    AND closed_on <= DATE_SUB(NOW(), INTERVAL 7 DAY);
END$$

-- Event 2: Suspend Expired AMCs/Warranties
CREATE EVENT auto_suspend_expired_amc
ON SCHEDULE EVERY 1 DAY STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY)
DO
BEGIN
    UPDATE clients c
    JOIN client_services cs ON c.client_code = cs.client_code
    SET c.status = 'Suspended'
    WHERE c.status = 'Active' 
      AND COALESCE(cs.current_amc_expiry, cs.warranty_end_date) < CURRENT_DATE;
END$$

DELIMITER ;
