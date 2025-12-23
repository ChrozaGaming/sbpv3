import {NextResponse} from "next/server";

const RAW = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const REST_BASE = RAW.replace(/\/+$/, "").endsWith("/api")
    ? RAW.replace(/\/+$/, "")
    : `${RAW.replace(/\/+$/, "")}/api`;

export async function GET(req: Request) {
    const url = new URL(req.url);
    const upstream = new URL(`${REST_BASE}/masterpegawai`);
    upstream.search = url.search; // forward ?page=&limit=&q=&status=

    const res = await fetch(upstream.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
    });

    const text = await res.text();
    return new NextResponse(text, {
        status: res.status,
        headers: {
            "content-type": res.headers.get("content-type") ?? "application/json",
            "cache-control": "no-store",
        },
    });
}
