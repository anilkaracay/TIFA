"use client";

import Link from "next/link";
import React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ display: "flex", height: "100vh" }}>
            {/* Sidebar */}
            <aside
                style={{
                    width: "240px",
                    background: "var(--bg-panel)",
                    padding: "20px",
                    borderRight: "1px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                }}
            >
                <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "20px" }}>
                    TIFA Dashboard
                </h2>

                <NavLink href="/">Invoices</NavLink>
                <NavLink href="/lp">LP Dashboard</NavLink>
                <NavLink href="/analytics">Analytics</NavLink>
                <NavLink href="/agent">Agent Console</NavLink>
            </aside>

            {/* Main */}
            <main
                style={{
                    flex: 1,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {/* Top Bar */}
                <header style={{
                    padding: "20px 32px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center"
                }}>
                    <ConnectButton />
                </header>

                <div style={{ padding: "32px", flex: 1 }}>
                    {children}
                </div>
            </main>
        </div>
    );
}

const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <Link
        href={href}
        style={{
            textDecoration: "none",
            color: "var(--text-muted)",
            fontSize: "15px",
            padding: "8px 12px",
            borderRadius: "var(--radius)",
            transition: "0.2s",
            display: "block",
        }}
    >
        {children}
    </Link>
);
