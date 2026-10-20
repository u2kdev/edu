"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#020617",
          color: "#e2e8f0",
          fontFamily:
            "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: "420px",
            width: "100%",
            textAlign: "center",
            padding: "32px",
            border: "1px solid #1e293b",
            borderRadius: "24px",
            background: "#0f172a",
          }}
        >
          <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 12px" }}>
            Критическая ошибка
          </h1>
          <p style={{ fontSize: "14px", color: "#94a3b8", margin: "0 0 24px" }}>
            Приложение не смогло загрузиться. Попробуйте обновить страницу.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "12px 24px",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 600,
              border: "none",
              borderRadius: "12px",
              cursor: "pointer",
            }}
          >
            Обновить
          </button>
        </div>
      </body>
    </html>
  );
}
