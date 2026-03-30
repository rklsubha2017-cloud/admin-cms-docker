import React, { useState } from 'react';

export default function HandoverGenerator({ clientCode, userRole }) {
    const [showModal, setShowModal] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // State to track which checkboxes are selected. 
    // We pre-load it with the "safe" fields.
    const [selectedFields, setSelectedFields] = useState([
        'koha_opac_port', 'koha_staff_port', 'koha_admin_user', 'koha_admin_pass',
        'koha_staff_user', 'koha_staff_pass', 'sip2_institution_id', 'sip2_user',
        'sip2_pass', 'sip2_telnet_port', 'anydesk_id', 'teamviewer_id'
    ]);

    // Only render the button if the user is an Admin
    if (userRole !== 'Admin') {
        return null; 
    }

    const toggleField = (field) => {
        setSelectedFields(prev => 
            prev.includes(field) 
                ? prev.filter(f => f !== field) 
                : [...prev, field]
        );
    };

    const generatePDF = async () => {
        if (selectedFields.length === 0) {
            alert("You must select at least one field.");
            return;
        }

        setIsGenerating(true);

        try {
            const response = await fetch('http://127.0.0.1:8000/api/vault/generate-handover', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}` // Ensure this matches how you store your JWT
                },
                body: JSON.stringify({
                    client_code: clientCode,
                    selected_fields: selectedFields
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Failed to generate document');
            }

            // Convert the response to a Blob (raw binary data for the PDF)
            const blob = await response.blob();
            
            // Create a temporary link to trigger the download
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Handover_${clientCode}.pdf`;
            document.body.appendChild(link);
            link.click();
            
            // Cleanup
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
            setShowModal(false);

        } catch (error) {
            alert(`Generation Error: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div style={{ marginTop: '20px' }}>
            {/* The Trigger Button */}
            <button 
                onClick={() => setShowModal(true)}
                style={{
                    background: '#10b981', color: 'white', padding: '10px 20px', 
                    border: 'none', borderRadius: '5px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold'
                }}
            >
                <i className="fa-solid fa-file-pdf"></i> Generate Official Handover PDF
            </button>

            {/* The Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                    background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', 
                    justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{
                        background: 'white', padding: '30px', borderRadius: '8px', 
                        width: '600px', maxWidth: '90%', maxHeight: '80vh', overflowY: 'auto'
                    }}>
                        <h2 style={{ marginTop: 0, color: '#10b981' }}>Configure Handover Document</h2>
                        <p style={{ color: '#64748b', marginBottom: '20px' }}>
                            Select the fields you want to share with the client. Internal server passwords are unchecked by default.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', textAlign: 'left' }}>
                            {/* Safe Fields */}
                            <label><input type="checkbox" checked={selectedFields.includes('koha_opac_port')} onChange={() => toggleField('koha_opac_port')} /> OPAC Port</label>
                            <label><input type="checkbox" checked={selectedFields.includes('koha_staff_port')} onChange={() => toggleField('koha_staff_port')} /> Staff Port</label>
                            <label><input type="checkbox" checked={selectedFields.includes('koha_admin_user')} onChange={() => toggleField('koha_admin_user')} /> Admin Username</label>
                            <label><input type="checkbox" checked={selectedFields.includes('koha_admin_pass')} onChange={() => toggleField('koha_admin_pass')} /> Admin Password</label>
                            <label><input type="checkbox" checked={selectedFields.includes('koha_staff_user')} onChange={() => toggleField('koha_staff_user')} /> Staff Username</label>
                            <label><input type="checkbox" checked={selectedFields.includes('koha_staff_pass')} onChange={() => toggleField('koha_staff_pass')} /> Staff Password</label>
                            <label><input type="checkbox" checked={selectedFields.includes('sip2_institution_id')} onChange={() => toggleField('sip2_institution_id')} /> SIP2 Institution ID</label>
                            <label><input type="checkbox" checked={selectedFields.includes('sip2_user')} onChange={() => toggleField('sip2_user')} /> SIP2 Username</label>
                            <label><input type="checkbox" checked={selectedFields.includes('sip2_pass')} onChange={() => toggleField('sip2_pass')} /> SIP2 Password</label>
                            <label><input type="checkbox" checked={selectedFields.includes('anydesk_id')} onChange={() => toggleField('anydesk_id')} /> Anydesk ID</label>
                            <label><input type="checkbox" checked={selectedFields.includes('teamviewer_id')} onChange={() => toggleField('teamviewer_id')} /> Teamviewer ID</label>
                            
                            {/* Dangerous Fields */}
                            <label style={{ color: '#ef4444' }}><input type="checkbox" checked={selectedFields.includes('system_ip')} onChange={() => toggleField('system_ip')} /> System IP Address</label>
                            <label style={{ color: '#ef4444' }}><input type="checkbox" checked={selectedFields.includes('system_pass')} onChange={() => toggleField('system_pass')} /> System Password</label>
                            <label style={{ color: '#ef4444' }}><input type="checkbox" checked={selectedFields.includes('koha_db_name')} onChange={() => toggleField('koha_db_name')} /> Koha DB Name</label>
                            <label style={{ color: '#ef4444' }}><input type="checkbox" checked={selectedFields.includes('koha_db_user')} onChange={() => toggleField('koha_db_user')} /> Koha DB User</label>
                            <label style={{ color: '#ef4444' }}><input type="checkbox" checked={selectedFields.includes('rfid_db_user')} onChange={() => toggleField('rfid_db_user')} /> RFID DB User</label>
                            <label style={{ color: '#ef4444' }}><input type="checkbox" checked={selectedFields.includes('rfid_db_pass')} onChange={() => toggleField('rfid_db_pass')} /> RFID DB Pass</label>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '25px' }}>
                            <button 
                                onClick={() => setShowModal(false)}
                                style={{ padding: '10px 20px', border: '1px solid #cbd5e1', background: 'white', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={generatePDF}
                                disabled={isGenerating}
                                style={{ padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: isGenerating ? 'not-allowed' : 'pointer' }}
                            >
                                {isGenerating ? 'Generating PDF...' : 'Download PDF'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
