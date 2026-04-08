import Link from "next/link";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#09090b",
        color: "#e4e4e7",
        padding: 24,
        fontFamily: "var(--font-mono), ui-monospace, monospace",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        {/* Brand mark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginBottom: 32,
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.25C17.25 23.15 21 18.25 21 13V7l-9-5z"
              stroke="#52525b"
              strokeWidth="1.5"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="12" cy="12" r="3" stroke="#52525b" strokeWidth="1.5" fill="none" />
          </svg>
          <span
            style={{
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: "0.22em",
              color: "#71717a",
            }}
          >
            VIGIL
          </span>
        </div>

        {/* Error code */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: "#27272a",
            lineHeight: 1,
            marginBottom: 12,
          }}
        >
          404
        </div>

        <h1
          style={{
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 8,
            color: "#e4e4e7",
            letterSpacing: "0.04em",
          }}
        >
          SECTOR NOT FOUND
        </h1>
        <p
          style={{
            color: "#71717a",
            fontSize: 13,
            marginBottom: 28,
            lineHeight: 1.6,
          }}
        >
          The requested page does not exist or has been decommissioned.
        </p>

        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "10px 24px",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#818cf8",
            background: "rgba(99, 102, 241, 0.10)",
            border: "1px solid rgba(99, 102, 241, 0.20)",
            borderRadius: 6,
            textDecoration: "none",
            transition: "background 150ms, border-color 150ms",
          }}
        >
          Return to Dashboard
        </Link>
      </div>
    </main>
  );
}
