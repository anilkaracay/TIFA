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
        <>
            <style>{`
                .nav-link-modern {
                    text-decoration: none;
                    color: #64748b;
                    font-size: 15px;
                    font-weight: 500;
                    padding: 10px 16px;
                    border-radius: 8px;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    letter-spacing: -0.01em;
                }
                .nav-link-modern:hover {
                    color: #1e293b;
                    background: rgba(15, 23, 42, 0.04);
                }
                .nav-link-modern.active {
                    color: #2563eb;
                    background: rgba(37, 99, 235, 0.08);
                    font-weight: 600;
                }
                .nav-link-modern.active::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 24px;
                    height: 2px;
                    border-radius: 1px;
                    background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%);
                }
            `}</style>
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
                    </div>
                </div>
                <div style={styles.navRight}>
                    <ConnectButton />
                </div>
            </nav>
        </>
    );
}

