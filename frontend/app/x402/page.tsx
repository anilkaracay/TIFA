"use client";

import React, { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import Navbar from "../../components/Navbar";
import X402Wizard from "../../components/x402/X402Wizard";
import ActiveSessions from "../../components/x402/ActiveSessions";
import PaymentHistory from "../../components/x402/PaymentHistory";
import X402Stats from "../../components/x402/X402Stats";
import AgentAuthorizationPanel from "../../components/x402/AgentAuthorizationPanel";

const styles = {
    page: {
        minHeight: "100vh",
        background: "#fafbfc",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
        display: "flex",
        flexDirection: "column" as "column",
        width: "100%",
    },
    container: {
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "48px 56px",
        flex: 1,
        width: "100%",
        boxSizing: "border-box" as "border-box",
    },
    header: {
        marginBottom: "40px",
        paddingBottom: "24px",
        borderBottom: "1px solid #e5e7eb",
    },
    title: {
        fontSize: "28px",
        fontWeight: 600,
        color: "#111827",
        letterSpacing: "-0.01em",
        marginBottom: "8px",
        lineHeight: "1.3",
    },
    subtitle: {
        fontSize: "14px",
        color: "#6b7280",
        fontWeight: 400,
        lineHeight: "1.5",
        maxWidth: "680px",
    },
    layout: {
        display: "grid",
        gridTemplateColumns: "1fr 380px",
        gap: "32px",
        width: "100%",
    },
    mainContent: {
        display: "flex",
        flexDirection: "column" as "column",
        gap: "0",
        minWidth: 0,
    },
    sidebar: {
        display: "flex",
        flexDirection: "column" as "column",
        gap: "24px",
        minWidth: 0,
    },
};

export default function X402Page() {
    const [refreshKey, setRefreshKey] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const { address } = useAccount();
    const [companyId, setCompanyId] = useState<string | null>(null);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 1024);
        };
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // Get company ID from wallet (simplified - in production, use proper company resolution)
    useEffect(() => {
        if (address) {
            // For now, use a default company ID - in production, resolve from wallet
            setCompanyId("COMP-DEBTOR-003"); // Placeholder
        }
    }, [address]);

    const handlePaymentComplete = () => {
        setRefreshKey(prev => prev + 1);
    };

    const handleAuthorizationChanged = () => {
        setRefreshKey(prev => prev + 1);
    };

    return (
        <div style={styles.page}>
            <Navbar />
            <div
                style={{
                    ...styles.container,
                    ...(isMobile ? { padding: "32px 24px" } : {}),
                }}
            >
                <div style={styles.header}>
                    <h1 style={styles.title}>x402 Payments</h1>
                    <p style={styles.subtitle}>
                        Programmatic invoice settlement using the x402 payment protocol. 
                        Execute payments through HTTP-native, verifiable, on-chain transactions.
                    </p>
                </div>

                {/* Metrics Overview */}
                <X402Stats key={`stats-${refreshKey}`} />

                {/* Agent Authorization Panel */}
                {companyId && (
                    <AgentAuthorizationPanel
                        companyId={companyId}
                        onAuthorizationChanged={handleAuthorizationChanged}
                    />
                )}

                {/* Main Layout */}
                <div
                    style={{
                        ...styles.layout,
                        ...(isMobile ? { gridTemplateColumns: "1fr" } : {}),
                    }}
                >
                    {/* Main Content - Payment Workflow */}
                    <div style={styles.mainContent}>
                        <X402Wizard onPaymentComplete={handlePaymentComplete} />
                    </div>

                    {/* Sidebar - Monitoring */}
                    <div style={styles.sidebar}>
                        <ActiveSessions key={`sessions-${refreshKey}`} />
                        <PaymentHistory key={`history-${refreshKey}`} />
                    </div>
                </div>
            </div>
        </div>
    );
}
