// src/lib/api.ts
export async function postJSON(path: string, data: any) {
  // Boleh isi env:
  // - NEXT_PUBLIC_API_URL=http://localhost:8080
  // - atau NEXT_PUBLIC_API_URL=http://localhost:8080/api
  const rawBackend =
    (process.env.NEXT_PUBLIC_API_URL as string | undefined) ??
    "http://localhost:8080";

  // 1) buang trailing slash
  // 2) kalau di-set ke .../api, buang dulu /api nya
  const backendBase = rawBackend.replace(/\/+$/, "").replace(/\/api$/, "");

  // Semua API backend lewat prefix /api
  // `path` di sini seperti "/auth/login", "/auth/register", dst.
  const url = `${backendBase}/api${path}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    // coba baca JSON { message: "..."} kalau ada
    let message = "Request gagal";
    try {
      const body = await res.json();
      if (body && typeof body.message === "string") {
        message = body.message;
      }
    } catch {
      // kalau bukan JSON, fallback ke text
      try {
        const text = await res.text();
        if (text) message = text;
      } catch {
        // ignore
      }
    }
    throw new Error(message);
  }

  return res.json();
}
