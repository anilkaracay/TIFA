export function Button({ children, onClick, disabled, variant = "primary" }: any) {
    const base = {
        padding: "8px 14px",
        borderRadius: "var(--radius)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        border: "1px solid var(--border)",
        background: variant === "primary" ? "var(--accent)" : "var(--bg-panel)",
        color: "#fff",
        fontSize: "14px",
        transition: "0.2s",
    };

    return (
        <button onClick={disabled ? undefined : onClick} style={base}>
            {children}
        </button>
    );
}
