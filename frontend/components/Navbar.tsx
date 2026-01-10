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
        gap: "12px",
    },
    // Custom button styles
    chainButton: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 16px",
        background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
        border: "1px solid rgba(148, 163, 184, 0.3)",
        borderRadius: "12px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: 600,
        color: "#334155",
        transition: "all 0.2s ease",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
    },
    chainButtonHover: {
        background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
        borderColor: "rgba(99, 102, 241, 0.4)",
        transform: "translateY(-1px)",
        boxShadow: "0 4px 12px rgba(99, 102, 241, 0.15)",
    },
    walletButton: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 18px",
        background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        border: "none",
        borderRadius: "12px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: 600,
        color: "#ffffff",
        transition: "all 0.2s ease",
        boxShadow: "0 2px 8px rgba(99, 102, 241, 0.35)",
    },
    walletButtonHover: {
        background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
        transform: "translateY(-1px)",
        boxShadow: "0 6px 20px rgba(99, 102, 241, 0.45)",
    },
    connectButton: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "12px 24px",
        background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        border: "none",
        borderRadius: "14px",
        cursor: "pointer",
        fontSize: "15px",
        fontWeight: 600,
        color: "#ffffff",
        transition: "all 0.25s ease",
        boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)",
    },
    connectButtonHover: {
        background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
        transform: "translateY(-2px)",
        boxShadow: "0 8px 25px rgba(99, 102, 241, 0.5)",
    },
    balanceText: {
        fontWeight: 700,
        fontSize: "14px",
    },
    addressText: {
        fontWeight: 500,
        fontSize: "13px",
        opacity: 0.95,
    },
    chainIcon: {
        width: "20px",
        height: "20px",
        borderRadius: "50%",
    },
    walletAvatar: {
        width: "24px",
        height: "24px",
        borderRadius: "50%",
        border: "2px solid rgba(255, 255, 255, 0.3)",
    },
    dropdownIcon: {
        marginLeft: "4px",
        opacity: 0.7,
    },
};

export default function Navbar() {
    const pathname = usePathname();
    const [chainHover, setChainHover] = React.useState(false);
    const [walletHover, setWalletHover] = React.useState(false);
    const [connectHover, setConnectHover] = React.useState(false);

    return (
        <nav style={styles.navbar}>
            <div style={styles.navLeft}>
                <div style={styles.navTitle}>Dashboard</div>
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
                <ConnectButton.Custom>
                    {({
                        account,
                        chain,
                        openAccountModal,
                        openChainModal,
                        openConnectModal,
                        mounted,
                    }) => {
                        const ready = mounted;
                        const connected = ready && account && chain;

                        return (
                            <div
                                {...(!ready && {
                                    'aria-hidden': true,
                                    style: {
                                        opacity: 0,
                                        pointerEvents: 'none',
                                        userSelect: 'none',
                                    },
                                })}
                                style={{ display: 'flex', gap: '12px', alignItems: 'center' }}
                            >
                                {(() => {
                                    if (!connected) {
                                        return (
                                            <button
                                                onClick={openConnectModal}
                                                type="button"
                                                style={{
                                                    ...styles.connectButton,
                                                    ...(connectHover ? styles.connectButtonHover : {}),
                                                }}
                                                onMouseEnter={() => setConnectHover(true)}
                                                onMouseLeave={() => setConnectHover(false)}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                    <circle cx="12" cy="7" r="4" />
                                                </svg>
                                                Connect Wallet
                                            </button>
                                        );
                                    }

                                    if (chain.unsupported) {
                                        return (
                                            <button
                                                onClick={openChainModal}
                                                type="button"
                                                style={{
                                                    ...styles.chainButton,
                                                    background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                                                    borderColor: 'rgba(239, 68, 68, 0.4)',
                                                    color: '#dc2626',
                                                }}
                                            >
                                                ⚠️ Wrong Network
                                            </button>
                                        );
                                    }

                                    return (
                                        <>
                                            {/* Chain Selector Button */}
                                            <button
                                                onClick={openChainModal}
                                                type="button"
                                                style={{
                                                    ...styles.chainButton,
                                                    ...(chainHover ? styles.chainButtonHover : {}),
                                                }}
                                                onMouseEnter={() => setChainHover(true)}
                                                onMouseLeave={() => setChainHover(false)}
                                            >
                                                {chain.hasIcon && chain.iconUrl && (
                                                    <img
                                                        src={chain.iconUrl}
                                                        alt={chain.name ?? 'Chain'}
                                                        style={styles.chainIcon}
                                                    />
                                                )}
                                                <span>{chain.name}</span>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={styles.dropdownIcon}>
                                                    <path d="M6 9l6 6 6-6" />
                                                </svg>
                                            </button>

                                            {/* Wallet Button */}
                                            <button
                                                onClick={openAccountModal}
                                                type="button"
                                                style={{
                                                    ...styles.walletButton,
                                                    ...(walletHover ? styles.walletButtonHover : {}),
                                                }}
                                                onMouseEnter={() => setWalletHover(true)}
                                                onMouseLeave={() => setWalletHover(false)}
                                            >
                                                {account.displayBalance && (
                                                    <span style={styles.balanceText}>
                                                        {account.displayBalance}
                                                    </span>
                                                )}
                                                <span style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.3)' }} />
                                                <span style={styles.addressText}>
                                                    {account.displayName}
                                                </span>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={styles.dropdownIcon}>
                                                    <path d="M6 9l6 6 6-6" />
                                                </svg>
                                            </button>
                                        </>
                                    );
                                })()}
                            </div>
                        );
                    }}
                </ConnectButton.Custom>
            </div>
        </nav>
    );
}
