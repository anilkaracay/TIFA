export function Card({ children, style }: any) {
    return (
        <div
            style={{
                background: "var(--bg-card)",
                padding: "20px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow)",
                ...style,
            }}
        >
            {children}
        </div>
    );
}
