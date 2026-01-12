"use client";

import React from "react";
import useSWR from "swr";
import Navbar from "../../../components/Navbar";
import { fetchPendingKycProfiles, approveKycProfile, rejectKycProfile } from "../../../lib/backendClient";
import { useToast } from "../../../components/Toast";
import { useAccount } from "wagmi";

const styles = {
    page: {
        minHeight: "100vh",
        background: "#f8f9fa",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
    },
    container: {
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "40px 20px",
    },
    header: {
        fontSize: "24px",
        fontWeight: 700,
        marginBottom: "24px",
        color: "#111827"
    },
    table: {
        width: "100%",
        borderCollapse: "collapse" as "collapse",
        background: "#fff",
        borderRadius: "8px",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
    },
    th: {
        textAlign: "left" as "left",
        padding: "16px",
        background: "#f9fafb",
        borderBottom: "1px solid #e5e7eb",
        fontSize: "13px",
        fontWeight: 600,
        color: "#6b7280",
        textTransform: "uppercase" as "uppercase"
    },
    td: {
        padding: "16px",
        borderBottom: "1px solid #e5e7eb",
        fontSize: "14px",
        color: "#374151"
    },
    buttonApprove: {
        background: "#10b981",
        color: "#fff",
        padding: "6px 12px",
        borderRadius: "4px",
        border: "none",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer",
        marginRight: "8px"
    },
    buttonReject: {
        background: "#ef4444",
        color: "#fff",
        padding: "6px 12px",
        borderRadius: "4px",
        border: "none",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer"
    }
};

export default function AdminCompliancePage() {
    const { showToast } = useToast();
    const { address } = useAccount(); // Ensure wallet connected for role check logic in backend

    const { data: profiles, mutate, error } = useSWR<any[]>(
        address ? "admin-pending-kyc" : null,
        () => fetchPendingKycProfiles()
    );

    const handleApprove = async (id: string) => {
        if (!confirm("Approve this profile?")) return;
        try {
            await approveKycProfile(id);
            showToast('success', "Profile approved");
            mutate();
        } catch (e: any) {
            showToast('error', "Failed: " + e.message);
        }
    };

    const handleReject = async (id: string) => {
        const reason = prompt("Enter rejection reason:");
        if (!reason) return;
        try {
            await rejectKycProfile(id, reason);
            showToast('info', "Profile rejected");
            mutate();
        } catch (e: any) {
            showToast('error', "Failed: " + e.message);
        }
    };

    if (error) return <div style={{ padding: 40 }}>Error loading profiles. Ensure you are an ADMIN.</div>;

    return (
        <div style={styles.page}>
            <Navbar />
            <div style={styles.container}>
                <h1 style={styles.header}>Compliance Review Queue</h1>

                {profiles && profiles.length === 0 && (
                    <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>No pending KYC applications.</div>
                )}

                {profiles && profiles.length > 0 && (
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <style>{`th { text-align: left; }`}</style>
                                <th style={styles.th}>Type</th>
                                <th style={styles.th}>Identity</th>
                                <th style={styles.th}>Details</th>
                                <th style={styles.th}>Submitted At</th>
                                <th style={styles.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {profiles.map(p => (
                                <tr key={p.id}>
                                    <td style={styles.td}>{p.subjectType}</td>
                                    <td style={styles.td}>
                                        <div>{p.legalName}</div>
                                        <div style={{ fontSize: 12, color: '#999' }}>{p.country}</div>
                                    </td>
                                    <td style={styles.td}>
                                        <div>{p.contactName}</div>
                                        <div style={{ fontSize: 12, color: '#999' }}>{p.contactEmail}</div>
                                    </td>
                                    <td style={styles.td}>{new Date(p.submittedAt).toLocaleDateString()}</td>
                                    <td style={styles.td}>
                                        <button style={styles.buttonApprove} onClick={() => handleApprove(p.id)}>Approve</button>
                                        <button style={styles.buttonReject} onClick={() => handleReject(p.id)}>Reject</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
