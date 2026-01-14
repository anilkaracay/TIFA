import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { submitKycProfile } from '../../lib/backendClient';
import { useToast } from '../Toast';

interface KycSubmissionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    subjectType: 'LP' | 'ISSUER';
}

export const KycSubmissionModal: React.FC<KycSubmissionModalProps> = ({
    isOpen, onClose, onSuccess, subjectType
}) => {
    const { address } = useAccount();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        legalName: '',
        registrationNumber: '',
        country: '',
        contactName: '',
        contactEmail: ''
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await submitKycProfile({
                ...formData,
                subjectType,
            }, address);

            showToast('success', 'KYC info submitted successfully');
            onSuccess();
            onClose();
        } catch (err: any) {
            showToast('error', err.message || 'Failed to submit KYC');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <h2 style={styles.title}>Identity Verification ({subjectType})</h2>
                    <button onClick={onClose} style={styles.closeBtn}>&times;</button>
                </div>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <p style={styles.subtitle}>
                        Please provide your details to comply with regulatory requirements.
                    </p>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>Legal Name / Company Name</label>
                        <input
                            required
                            name="legalName"
                            value={formData.legalName}
                            onChange={handleChange}
                            style={styles.input}
                            placeholder="e.g. Acme Corp or John Doe"
                        />
                    </div>

                    <div style={styles.twoCol}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Country</label>
                            <input
                                required
                                name="country"
                                value={formData.country}
                                onChange={handleChange}
                                style={styles.input}
                                placeholder="Country of residence"
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Gov ID / Tax ID</label>
                            <input
                                required
                                name="registrationNumber"
                                value={formData.registrationNumber}
                                onChange={handleChange}
                                style={styles.input}
                                placeholder="Registration No."
                            />
                        </div>
                    </div>

                    <hr style={styles.divider} />

                    <div style={styles.twoCol}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Contact Name</label>
                            <input
                                required
                                name="contactName"
                                value={formData.contactName}
                                onChange={handleChange}
                                style={styles.input}
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Email Address</label>
                            <input
                                required
                                type="email"
                                name="contactEmail"
                                value={formData.contactEmail}
                                onChange={handleChange}
                                style={styles.input}
                            />
                        </div>
                    </div>

                    <div style={styles.footer}>
                        <button type="button" onClick={onClose} style={styles.cancelBtn}>
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} style={styles.submitBtn}>
                            {loading ? 'Submitting...' : 'Submit Verification'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed' as const,
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
    },
    modal: {
        backgroundColor: '#fff',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '500px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
    },
    header: {
        padding: '20px 24px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        margin: 0,
        fontSize: '18px',
        fontWeight: 600,
        color: '#111827',
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        fontSize: '24px',
        cursor: 'pointer',
        color: '#6b7280',
    },
    form: {
        padding: '24px',
    },
    subtitle: {
        marginTop: 0,
        marginBottom: '20px',
        color: '#6b7280',
        fontSize: '14px',
    },
    formGroup: {
        marginBottom: '16px',
        flex: 1,
    },
    twoCol: {
        display: 'flex',
        gap: '16px',
    },
    label: {
        display: 'block',
        fontSize: '13px',
        fontWeight: 500,
        color: '#374151',
        marginBottom: '6px',
    },
    input: {
        width: '100%',
        padding: '10px 12px',
        borderRadius: '6px',
        border: '1px solid #d1d5db',
        fontSize: '14px',
        outline: 'none',
        transition: 'border-color 0.2s',
    },
    divider: {
        border: 'none',
        borderTop: '1px solid #e5e7eb',
        margin: '20px 0',
    },
    footer: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
        marginTop: '24px',
    },
    cancelBtn: {
        padding: '10px 16px',
        borderRadius: '6px',
        border: '1px solid #d1d5db',
        background: '#fff',
        color: '#374151',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
    },
    submitBtn: {
        padding: '10px 20px',
        borderRadius: '6px',
        border: 'none',
        background: '#09090b',
        color: '#fff',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
    },
};
