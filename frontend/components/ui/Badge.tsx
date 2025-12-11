export function Badge({ children, color = "#6366f1" }: any) {
    return (
        <span
            style={{
                padding: "3px 8px",
                borderRadius: "var(--radius)",
                background: "rgba(99,102,241,0.15)",
                color,
                fontSize: "12px",
                border: `1px solid ${color}`,
            }}
        >
            {children}
        </span>
    );
}
