"use client";

import React, { useState, useEffect } from "react";
import useSWR from "swr";
import { useAccount } from "wagmi";
import { useToast } from "../Toast";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

interface PaymentAuthorization {
    id: string;
    companyId: string;
    mode: string;
    maxAmountPerInvoice: string;
    dailyLimit: string;
    monthlyLimit: string;
    allowedCurrencies: string[];
    allowedChains: string[];
    allowedInvoiceStatuses: string[];
    autoApproveFinancedInvoices: boolean;
    autoApproveTokenizedInvoices: boolean;
    active: boolean;
    createdAt: string;
    revokedAt: string | null;
}

const styles = {
    card: {
        background: "#ffffff",
        borderRadius: "6px",
        border: "1px solid #e5e7eb",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
        padding: "24px",
        marginBottom: "24px",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "24px",
        paddingBottom: "16px",
        borderBottom: "1px solid #e5e7eb",
    },
    title: {
        fontSize: "16px",
        fontWeight: 600,
        color: "#111827",
    },
    toggle: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },
    toggleLabel: {
        fontSize: "13px",
        color: "#6b7280",
        fontWeight: 500,
    },
    toggleSwitch: {
        position: "relative" as "relative",
        width: "44px",
        height: "24px",
        background: "#d1d5db",
        borderRadius: "12px",
        cursor: "pointer",
        transition: "background 0.2s ease",
    },
    toggleSwitchActive: {
        background: "#111827",
    },
    toggleSlider: {
        position: "absolute" as "absolute",
        top: "2px",
        left: "2px",
        width: "20px",
        height: "20px",
        background: "#ffffff",
        borderRadius: "50%",
        transition: "transform 0.2s ease",
    },
    toggleSliderActive: {
        transform: "translateX(20px)",
    },
    configPanel: {
        display: "flex",
        flexDirection: "column" as "column",
        gap: "24px",
        marginTop: "24px",
    },
    section: {
        display: "flex",
        flexDirection: "column" as "column",
        gap: "16px",
    },
    sectionTitle: {
        fontSize: "13px",
        fontWeight: 600,
        color: "#111827",
        textTransform: "uppercase" as "uppercase",
        letterSpacing: "0.05em",
        marginBottom: "8px",
    },
    formGroup: {
        display: "flex",
        flexDirection: "column" as "column",
        gap: "6px",
    },
    label: {
        fontSize: "12px",
        fontWeight: 500,
        color: "#6b7280",
    },
    input: {
        padding: "8px 12px",
        borderRadius: "4px",
        border: "1px solid #d1d5db",
        fontSize: "13px",
        color: "#111827",
        background: "#ffffff",
        fontFeatureSettings: '"tnum"',
    },
    checkboxGroup: {
        display: "flex",
        flexDirection: "column" as "column",
        gap: "8px",
    },
    checkbox: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    checkboxInput: {
        width: "16px",
        height: "16px",
        cursor: "pointer",
    },
    checkboxLabel: {
        fontSize: "13px",
        color: "#111827",
        cursor: "pointer",
    },
    preview: {
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: "4px",
        padding: "16px",
        fontSize: "13px",
        color: "#6b7280",
        lineHeight: "1.6",
    },
    actionButtons: {
        display: "flex",
        gap: "12px",
        justifyContent: "flex-end",
        marginTop: "24px",
        paddingTop: "24px",
        borderTop: "1px solid #e5e7eb",
    },
    cancelButton: {
        padding: "10px 20px",
        borderRadius: "4px",
        border: "1px solid #d1d5db",
        background: "#ffffff",
        color: "#6b7280",
        fontSize: "13px",
        fontWeight: 500,
        cursor: "pointer",
    },
    saveButton: {
        padding: "10px 20px",
        borderRadius: "4px",
        background: "#111827",
        color: "#ffffff",
        border: "none",
        fontSize: "13px",
        fontWeight: 500,
        cursor: "pointer",
    },
    saveButtonDisabled: {
        opacity: 0.5,
        cursor: "not-allowed",
    },
};

interface AgentAuthorizationPanelProps {
    companyId: string;
    onAuthorizationChanged: () => void;
}

export default function AgentAuthorizationPanel({ companyId, onAuthorizationChanged }: AgentAuthorizationPanelProps) {
    const { address } = useAccount();
    const { showToast } = useToast();
    const [isEnabled, setIsEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [config, setConfig] = useState({
        maxAmountPerInvoice: "1000000",
        dailyLimit: "10000000",
        monthlyLimit: "100000000",
        allowedCurrencies: ["USDC"],
        allowedChains: ["base"],
        allowedInvoiceStatuses: ["FINANCED", "TOKENIZED"],
        autoApproveFinancedInvoices: true,
        autoApproveTokenizedInvoices: false,
    });

    // Fetch existing authorization
    const { data: existingAuth, mutate } = useSWR<PaymentAuthorization>(
        companyId ? `payment-authorization-${companyId}` : null,
        async () => {
            const res = await fetch(`${BACKEND_URL}/payment-authorization/${companyId}`);
            if (res.status === 404) return null;
            if (!res.ok) throw new Error("Failed to fetch authorization");
            return res.json();
        }
    );

    useEffect(() => {
        if (existingAuth) {
            setIsEnabled(existingAuth.active && existingAuth.mode === "AGENT_AUTHORIZED");
            setConfig({
                maxAmountPerInvoice: existingAuth.maxAmountPerInvoice,
                dailyLimit: existingAuth.dailyLimit,
                monthlyLimit: existingAuth.monthlyLimit,
                allowedCurrencies: existingAuth.allowedCurrencies,
                allowedChains: existingAuth.allowedChains,
                allowedInvoiceStatuses: existingAuth.allowedInvoiceStatuses,
                autoApproveFinancedInvoices: existingAuth.autoApproveFinancedInvoices,
                autoApproveTokenizedInvoices: existingAuth.autoApproveTokenizedInvoices,
            });
        }
    }, [existingAuth]);

    const handleToggle = async () => {
        if (!address) {
            showToast("error", "Please connect your wallet");
            return;
        }

        setIsLoading(true);
        try {
            if (isEnabled && existingAuth) {
                // Revoke
                const res = await fetch(`${BACKEND_URL}/payment-authorization/${existingAuth.id}/revoke`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-address": address,
                    },
                });

                if (!res.ok) throw new Error("Failed to revoke authorization");
                setIsEnabled(false);
                showToast("success", "Agent authorization revoked");
            } else {
                // Create
                const res = await fetch(`${BACKEND_URL}/payment-authorization`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-address": address,
                    },
                    body: JSON.stringify({
                        companyId,
                        ...config,
                    }),
                });

                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.error || "Failed to create authorization");
                }
                setIsEnabled(true);
                showToast("success", "Agent authorization enabled");
            }
            mutate();
            onAuthorizationChanged();
        } catch (error: any) {
            console.error("Authorization toggle error:", error);
            showToast("error", error.message || "Failed to update authorization");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!address || !existingAuth) return;

        setIsLoading(true);
        try {
            const res = await fetch(`${BACKEND_URL}/payment-authorization/${existingAuth.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "x-wallet-address": address,
                },
                body: JSON.stringify(config),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Failed to update authorization");
            }

            showToast("success", "Authorization updated");
            mutate();
            onAuthorizationChanged();
        } catch (error: any) {
            console.error("Authorization update error:", error);
            showToast("error", error.message || "Failed to update authorization");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={styles.card}>
            <div style={styles.header}>
                <div>
                    <h3 style={styles.title}>Agent-Authorized Payments</h3>
                    <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
                        Allow the finance agent to execute invoice payments automatically under defined rules.
                    </p>
                </div>
                <div style={styles.toggle}>
                    <span style={styles.toggleLabel}>{isEnabled ? "ON" : "OFF"}</span>
                    <div
                        style={{
                            ...styles.toggleSwitch,
                            ...(isEnabled ? styles.toggleSwitchActive : {}),
                        }}
                        onClick={handleToggle}
                    >
                        <div
                            style={{
                                ...styles.toggleSlider,
                                ...(isEnabled ? styles.toggleSliderActive : {}),
                            }}
                        />
                    </div>
                </div>
            </div>

            {isEnabled && (
                <div style={styles.configPanel}>
                    {/* Limits Section */}
                    <div style={styles.section}>
                        <div style={styles.sectionTitle}>Limits</div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Max Amount Per Invoice</label>
                            <input
                                type="text"
                                value={config.maxAmountPerInvoice}
                                onChange={(e) => setConfig({ ...config, maxAmountPerInvoice: e.target.value })}
                                style={styles.input}
                                disabled={isLoading}
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Daily Limit</label>
                            <input
                                type="text"
                                value={config.dailyLimit}
                                onChange={(e) => setConfig({ ...config, dailyLimit: e.target.value })}
                                style={styles.input}
                                disabled={isLoading}
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Monthly Limit</label>
                            <input
                                type="text"
                                value={config.monthlyLimit}
                                onChange={(e) => setConfig({ ...config, monthlyLimit: e.target.value })}
                                style={styles.input}
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    {/* Scope Section */}
                    <div style={styles.section}>
                        <div style={styles.sectionTitle}>Scope</div>
                        <div style={styles.checkboxGroup}>
                            <label style={styles.checkbox}>
                                <input
                                    type="checkbox"
                                    checked={config.allowedInvoiceStatuses.includes("FINANCED")}
                                    onChange={(e) => {
                                        const statuses = e.target.checked
                                            ? [...config.allowedInvoiceStatuses, "FINANCED"]
                                            : config.allowedInvoiceStatuses.filter((s) => s !== "FINANCED");
                                        setConfig({ ...config, allowedInvoiceStatuses: statuses });
                                    }}
                                    style={styles.checkboxInput}
                                    disabled={isLoading}
                                />
                                <span style={styles.checkboxLabel}>FINANCED invoices</span>
                            </label>
                            <label style={styles.checkbox}>
                                <input
                                    type="checkbox"
                                    checked={config.allowedInvoiceStatuses.includes("TOKENIZED")}
                                    onChange={(e) => {
                                        const statuses = e.target.checked
                                            ? [...config.allowedInvoiceStatuses, "TOKENIZED"]
                                            : config.allowedInvoiceStatuses.filter((s) => s !== "TOKENIZED");
                                        setConfig({ ...config, allowedInvoiceStatuses: statuses });
                                    }}
                                    style={styles.checkboxInput}
                                    disabled={isLoading}
                                />
                                <span style={styles.checkboxLabel}>TOKENIZED invoices</span>
                            </label>
                        </div>
                    </div>

                    {/* Preview */}
                    <div style={styles.preview}>
                        <strong>Preview:</strong> Based on current rules, the agent would auto-pay invoices matching
                        the configured criteria. Limits and scope can be adjusted at any time.
                    </div>

                    {/* Action Buttons */}
                    <div style={styles.actionButtons}>
                        <button
                            style={styles.cancelButton}
                            onClick={handleToggle}
                            disabled={isLoading}
                        >
                            Disable
                        </button>
                        <button
                            style={{
                                ...styles.saveButton,
                                ...(isLoading ? styles.saveButtonDisabled : {}),
                            }}
                            onClick={handleSave}
                            disabled={isLoading}
                        >
                            {isLoading ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}






