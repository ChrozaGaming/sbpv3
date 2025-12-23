import {NextResponse} from "next/server";

const RAW = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const REST_BASE = RAW.replace(/\/+$/, "").endsWith("/api")
    ? RAW.replace(/\/+$/, "")
    : `${RAW.replace(/\/+$/, "")}/api`;

function joinUrl(...parts: string[]) {
    return parts
        .filter(Boolean)
        .map((p) => p.replace(/^\/+|\/+$/g, ""))
        .join("/");
}

async function forward(req: Request, params: { slug: string[] }) {
    const slug = params.slug || [];
    const url = new URL(req.url);

    // /api/masterpegawai/<slug...> -> <REST_BASE>/masterpegawai/<slug...>
    const upstream = new URL(`${REST_BASE}/${joinUrl("masterpegawai", ...slug)}`);
    upstream.search = url.search;

    const method = req.method.toUpperCase();
    const headers: Record<string, string> = { Accept: "application/json" };

    let body: BodyInit | undefined = undefined;
    if (method !== "GET" && method !== "HEAD") {
        const ct = req.headers.get("content-type");
        if (ct) headers["content-type"] = ct;
        body = await req.text();
    }

    const res = await fetch(upstream.toString(), {
        method,
        headers,
        body,
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

export async function GET(req: Request, ctx: any) {
    return forward(req, ctx.params);
}
export async function PUT(req: Request, ctx: any) {
    return forward(req, ctx.params);
}
export async function DELETE(req: Request, ctx: any) {
    return forward(req, ctx.params);
}
export async function POST(req: Request, ctx: any) {
    return forward(req, ctx.params);
}
