export function InviteStatusBadge({ status }: { status: string }) {
  const styles = {
    pending: {
      bg: "var(--paper-2)",
      text: "var(--ink-faint)",
    },
    accepted: {
      bg: "var(--ok-wash)",
      text: "var(--ok)",
    },
    revoked: {
      bg: "var(--err-wash)",
      text: "var(--err)",
    },
  };

  const style = styles[status as keyof typeof styles] || styles.pending;

  return (
    <span
      style={{
        fontSize: "10.5px",
        fontFamily: 'var(--mono)',
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: style.text,
        background: style.bg,
        borderRadius: "var(--radius-sm)",
        padding: "3px 8px",
        display: "inline-block",
      }}
    >
      {status}
    </span>
  );
}
