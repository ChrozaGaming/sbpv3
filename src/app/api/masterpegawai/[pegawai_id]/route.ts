import {NextRequest, NextResponse} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

async function proxy(req: NextRequest, path: string) {
    const headers = new Headers(req.headers);
    headers.delete("host");

    const method = req.method;
    const body = method === "GET" ? undefined : await req.text();

    const res = await fetch(API_BASE + path, {
        method,
        headers,
        body,
        cache: "no-store",
    });

    return new NextResponse(await res.text(), {
        status: res.status,
        headers: { "content-type": res.headers.get("content-type") || "application/json" },
    });
}

export async function GET(req: NextRequest, { params }: { params: { pegawai_id: string } }) {
    return proxy(req, `/masterpegawai/${params.pegawai_id}`);
}

export async function PUT(req: NextRequest, { params }: { params: { pegawai_id: string } }) {
    return proxy(req, `/masterpegawai/${params.pegawai_id}`);
}

export async function DELETE(req: NextRequest, { params }: { params: { pegawai_id: string } }) {
    return proxy(req, `/masterpegawai/${params.pegawai_id}`);
}
