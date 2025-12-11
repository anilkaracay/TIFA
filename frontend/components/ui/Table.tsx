export function Table({ columns, data }: any) {
    return (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
                <tr>
                    {columns.map((c: any) => (
                        <th
                            key={c.key}
                            style={{
                                textAlign: "left",
                                padding: "10px",
                                color: "var(--text-muted)",
                                borderBottom: "1px solid var(--border)",
                                fontSize: "12px",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                            }}
                        >
                            {c.title}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {data.map((row: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        {columns.map((c: any) => (
                            <td key={c.key} style={{ padding: "10px", fontSize: "14px" }}>
                                {c.render ? c.render(row) : row[c.key]}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
