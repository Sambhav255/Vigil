import Link from "next/link";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#09090b",
        color: "#e4e4e7",
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 520 }}>
        <h1 style={{ fontSize: 28, marginBottom: 10 }}>Page Not Found</h1>
        <p style={{ color: "#a1a1aa", marginBottom: 16 }}>
          The page you requested does not exist or has moved.
        </p>
        <Link href="/" style={{ color: "#93c5fd" }}>
          Return to Vigil dashboard
        </Link>
      </div>
    </main>
  );
}
