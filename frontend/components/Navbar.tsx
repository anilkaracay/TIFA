"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const styles = {
    navbar: {
        background: "rgba(255, 255, 255, 0.98)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
        padding: "0 48px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        height: "72px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
        position: "sticky" as const,
        top: 0,
        zIndex: 1000,
        flexShrink: 0,
    },
    navLeft: {
        display: "flex",
        alignItems: "center",
        gap: "48px",
    },
    navTitle: {
        fontSize: "22px",
        fontWeight: 700,
        color: "#0f172a",
        letterSpacing: "-0.02em",
        background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
    },
    navLinks: {
        display: "flex",
        gap: "8px",
        alignItems: "center",
    },
    navRight: {
        display: "flex",
        alignItems: "center",
        gap: "16px",
    },
};

export default function Navbar() {
    const pathname = usePathname();

    return (
        <nav style={styles.navbar}>
                <div style={styles.navLeft}>
                    <div style={styles.navTitle}>TIFA Dashboard</div>
                    <div style={styles.navLinks}>
                        <Link href="/overview" className={`nav-link-modern ${pathname === "/overview" ? "active" : ""}`}>
                            Overview
                        </Link>
                        <Link href="/invoices" className={`nav-link-modern ${pathname === "/" || pathname?.startsWith("/invoices") ? "active" : ""}`}>
                            Invoices
                        </Link>
                        <Link href="/lp" className={`nav-link-modern ${pathname === "/lp" ? "active" : ""}`}>
                            LP Dashboard
                        </Link>
                        <Link href="/analytics" className={`nav-link-modern ${pathname === "/analytics" ? "active" : ""}`}>
                            Analytics
                        </Link>
                        <Link href="/agent" className={`nav-link-modern ${pathname === "/agent" ? "active" : ""}`}>
                            Agent Console
                        </Link>
                        {process.env.NEXT_PUBLIC_X402_ENABLED === 'true' && (
                            <Link href="/x402" className={`nav-link-modern ${pathname === "/x402" ? "active" : ""}`}>
                                x402 Payments
                            </Link>
                        )}
                    </div>
                </div>
                <div style={styles.navRight}>
                    <ConnectButton />
                </div>
            </nav>
    );
}

