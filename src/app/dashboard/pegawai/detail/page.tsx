"use client";

import React, {useEffect, useMemo, useRef, useState} from "react";
import Link from "next/link";
import {useRouter, useSearchParams} from "next/navigation";
import Swal from "sweetalert2";
import {
    ArrowLeft,
    Briefcase,
    CheckCircle2,
    CircleAlert,
    CircleX,
    Copy,
    CreditCard,
    FileText,
    Home,
    Loader2,
    Mail,
    MapPin,
    Phone,
    RefreshCw,
    Settings2,
    ShieldCheck,
    User2,
} from "lucide-react";

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

/* ===========================
   ENV
   =========================== */
// Base backend Actix (bukan Next.js)
const API_BASE =
    (process.env.NEXT_PUBLIC_API_URL as string | undefined) || "http://localhost:8080";

// ✅ REST langsung ke Actix (sesuai main.rs: web::scope("/api") + #[get("/masterpegawai/{id}")])
const REST_BASE = `${API_BASE.replace(/\/+$/, "")}/api/masterpegawai`;

// WS default: Actix expose di root (bukan di /api)
const WS_DEFAULT =
    (process.env.NEXT_PUBLIC_MASTERPEGAWAI_WS_URL as string | undefined) ||
    API_BASE.replace(/^http/i, "ws").replace(/\/+$/, "") + "/ws/pegawai";

/* ===========================
   Types
   =========================== */
type StatusAktif = "aktif" | "nonaktif";

type MasterPegawaiApi = {
    pegawai_id: string;

    nik: string;
    no_kk?: string | null;
    nama_lengkap: string;
    nama_panggilan?: string | null;
    jenis_kelamin: string; // "L" | "P"
    tempat_lahir?: string | null;
    tanggal_lahir?: string | null;
    agama?: string | null;

    status_perkawinan?: string | null;
    pendidikan_terakhir?: string | null;

    no_hp: string;
    email?: string | null;

    alamat_ktp: string;
    kelurahan_ktp?: string | null;
    kecamatan_ktp?: string | null;
    kota_kab_ktp: string;
    provinsi_ktp: string;
    kode_pos_ktp?: string | null;

    alamat_domisili?: string | null;
    kelurahan_domisili?: string | null;
    kecamatan_domisili?: string | null;
    kota_kab_domisili?: string | null;
    provinsi_domisili?: string | null;
    kode_pos_domisili?: string | null;

    kontak_darurat_nama?: string | null;
    kontak_darurat_hubungan?: string | null;
    kontak_darurat_no_hp?: string | null;

    npwp?: string | null;
    bpjs_kesehatan?: string | null;
    bpjs_ketenagakerjaan?: string | null;

    bank_nama: string;
    bank_no_rekening: string;
    bank_nama_pemilik: string;

    foto_url?: string | null;
    status_aktif: string;
    tanggal_masuk?: string | null;
    catatan?: string | null;

    dibuat_pada?: string | null;
    diubah_pada?: string | null;
};

type PegawaiDetail = Omit<MasterPegawaiApi, "status_aktif"> & {
    status_aktif: StatusAktif;
};

/* ===========================
   Helpers
   =========================== */
function cn(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(" ");
}

function s(v: unknown) {
    return String(v ?? "").trim();
}

function formatDateLong(iso?: string | null) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "2-digit" });
}

function formatDateTime(iso?: string | null) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString("id-ID", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function maskRek(rek?: string | null) {
    const v = String(rek ?? "").replace(/\s+/g, "");
    if (!v) return "—";
    if (v.length <= 4) return v;
    return `•••• ${v.slice(-4)}`;
}

function toDetail(x: MasterPegawaiApi): PegawaiDetail {
    const raw = s(x.status_aktif).toLowerCase();
    return {
        ...x,
        pegawai_id: s(x.pegawai_id),
        nik: s(x.nik),
        nama_lengkap: s(x.nama_lengkap),
        nama_panggilan: x.nama_panggilan ? s(x.nama_panggilan) : null,
        no_hp: s(x.no_hp),
        email: x.email ? s(x.email) : null,
        alamat_ktp: s(x.alamat_ktp),
        kota_kab_ktp: s(x.kota_kab_ktp),
        provinsi_ktp: s(x.provinsi_ktp),
        bank_nama: s(x.bank_nama),
        bank_no_rekening: s(x.bank_no_rekening),
        bank_nama_pemilik: s(x.bank_nama_pemilik),
        status_aktif: raw === "aktif" ? "aktif" : "nonaktif",
    };
}

function toJKLabel(jk?: string | null) {
    if (jk === "P") return "Perempuan";
    if (jk === "L") return "Laki-laki";
    return "—";
}

async function safeJson(res: Response) {
    const text = await res.text();
    try {
        return text ? JSON.parse(text) : null;
    } catch {
        return { success: false, message: text || `HTTP ${res.status}` };
    }
}

function unwrapRow(json: any): MasterPegawaiApi | null {
    // bentuk normal: { success: true, data: {...} }
    if (json?.success && json?.data?.pegawai_id) return json.data as MasterPegawaiApi;
    // bentuk nested (kadang fetch wrapper): { data: { success, data } }
    if (json?.data?.success && json?.data?.data?.pegawai_id) return json.data.data as MasterPegawaiApi;
    // fallback: langsung object
    if (json?.pegawai_id) return json as MasterPegawaiApi;
    return null;
}

/* ===========================
   SweetAlert2 (anti-spam)
   =========================== */
const Toast = Swal.mixin({
    toast: true,
    position: "bottom-end",
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true,
});

type ToastKey =
    | "ws_online"
    | "ws_offline"
    | "ws_timeout"
    | "ws_error"
    | "ws_reconnect"
    | "rest_error"
    | "rest_loaded"
    | "copied";

function useToastGate() {
    const lastAtRef = useRef<Record<string, number>>({});

    function fire(
        key: ToastKey,
        opt: {
            icon: "success" | "info" | "warning" | "error";
            title: string;
            text?: string;
            cooldownMs?: number;
        }
    ) {
        const now = Date.now();
        const cooldown = opt.cooldownMs ?? 12_000;
        const last = lastAtRef.current[key] ?? 0;
        if (now - last < cooldown) return;

        lastAtRef.current[key] = now;
        Toast.fire({ icon: opt.icon, title: opt.title, text: opt.text });
    }

    return { fire };
}

/* ===========================
   UI atoms
   =========================== */
function StatusBadge({ status }: { status: StatusAktif }) {
    const isAktif = status === "aktif";
    return (
        <span
            className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold",
                isAktif
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-700"
            )}
        >
      {isAktif ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
            {isAktif ? "Aktif" : "Nonaktif"}
    </span>
    );
}

function LivePill({ wsStatus }: { wsStatus: "connecting" | "online" | "offline" }) {
    const pill =
        wsStatus === "online"
            ? {
                label: "Live",
                cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
                icon: <CheckCircle2 className="h-4 w-4" />,
            }
            : wsStatus === "connecting"
                ? {
                    label: "Connecting",
                    cls: "bg-slate-50 text-slate-700 border-slate-200",
                    icon: <Loader2 className="h-4 w-4 animate-spin" />,
                }
                : {
                    label: "Offline",
                    cls: "bg-rose-50 text-rose-700 border-rose-200",
                    icon: <CircleX className="h-4 w-4" />,
                };

    return (
        <span className={cn("inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold", pill.cls)}>
      {pill.icon}
            {pill.label}
    </span>
    );
}

function Field({
                   label,
                   value,
                   mono,
               }: {
    label: string;
    value?: React.ReactNode;
    mono?: boolean;
}) {
    const isPrimitive =
        typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value == null;

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold text-slate-500">{label}</p>

            {isPrimitive ? (
                <p className={cn("mt-1 text-sm font-semibold text-slate-900 break-words", mono && "font-mono")}>
                    {value == null || value === "" ? "—" : String(value)}
                </p>
            ) : (
                <div className={cn("mt-1 text-sm font-semibold text-slate-900 break-words", mono && "font-mono")}>{value}</div>
            )}
        </div>
    );
}

function Section({
                     title,
                     icon,
                     children,
                 }: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 p-5">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">{icon}</div>
                <div>
                    <p className="text-sm font-extrabold text-slate-900">{title}</p>
                    <p className="text-xs text-slate-500">Detail informasi pegawai.</p>
                </div>
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

/* ===========================
   Page
   =========================== */
export default function Page() {
    const router = useRouter();
    const sp = useSearchParams();
    const id = sp.get("id")?.trim() || "";

    const [open, setOpen] = useState(true);
    const { fire } = useToastGate();

    const [detail, setDetail] = useState<PegawaiDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    // WS
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<number | null>(null);
    const reconnectAttempt = useRef(0);

    const [wsStatus, setWsStatus] = useState<"connecting" | "online" | "offline">("connecting");
    const wsStatusRef = useRef<"connecting" | "online" | "offline">("connecting");

    const [wsError, setWsError] = useState<string | null>(null);

    const [wsEndpoint, setWsEndpoint] = useState<string>(WS_DEFAULT);
    const [wsEndpointDraft, setWsEndpointDraft] = useState<string>(WS_DEFAULT);
    const [showWsConfig, setShowWsConfig] = useState(false);

    // guards (anti stale + intentional close)
    const connIdRef = useRef(0);
    const intentionalCloseRef = useRef(false);

    function setWsStatusSafe(next: "connecting" | "online" | "offline") {
        wsStatusRef.current = next;
        setWsStatus(next);
    }

    function normalizeWsUrl(url: string) {
        if (typeof window !== "undefined") {
            const isHttps = window.location.protocol === "https:";
            if (isHttps && url.startsWith("ws://")) return url.replace("ws://", "wss://");
        }
        return url;
    }

    function cleanupWS() {
        if (reconnectTimer.current) {
            window.clearTimeout(reconnectTimer.current);
            reconnectTimer.current = null;
        }
        if (wsRef.current) {
            intentionalCloseRef.current = true;
            try {
                wsRef.current.onopen = null;
                wsRef.current.onclose = null;
                wsRef.current.onerror = null;
                wsRef.current.onmessage = null;
                wsRef.current.close();
            } catch {}
            wsRef.current = null;
        }
    }

    function scheduleReconnect(reason?: string) {
        reconnectAttempt.current += 1;
        const attempt = reconnectAttempt.current;

        const MAX_TRIES = 12;
        if (attempt > MAX_TRIES) {
            setWsStatusSafe("offline");
            setWsError("Auto reconnect berhenti (max tries). Klik Reconnect.");
            fire("ws_offline", {
                icon: "warning",
                title: "Realtime berhenti",
                text: "Klik Reconnect untuk coba lagi.",
                cooldownMs: 25_000,
            });
            return;
        }

        const delay = Math.min(12_000, 800 * Math.pow(2, attempt - 1));
        setWsStatusSafe("offline");
        setWsError(reason ?? "WebSocket offline");

        fire("ws_reconnect", {
            icon: "info",
            title: "Realtime offline",
            text: `Retry dalam ${Math.round(delay / 1000)}s`,
            cooldownMs: 15_000,
        });

        if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
        reconnectTimer.current = window.setTimeout(() => connectWS(wsEndpoint, { silent: true }), delay);
    }

    function connectWS(url: string, opt?: { silent?: boolean }) {
        cleanupWS();
        intentionalCloseRef.current = false;

        setWsError(null);
        setWsStatusSafe("connecting");

        const silent = Boolean(opt?.silent);
        const wsUrl = normalizeWsUrl(url);
        const connId = ++connIdRef.current;

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            // 8s timeout biar ga false negative
            const openTimeout = window.setTimeout(() => {
                if (connIdRef.current !== connId) return;
                if (ws.readyState !== WebSocket.OPEN) {
                    try {
                        ws.close();
                    } catch {}
                    setWsStatusSafe("offline");
                    setWsError("Timeout (cek path WS Actix)");

                    fire("ws_timeout", {
                        icon: "error",
                        title: "Realtime timeout",
                        text: "Cek route WS di Actix (mis. /ws/pegawai) & server hidup.",
                        cooldownMs: 20_000,
                    });

                    scheduleReconnect("Timeout (cek path WS Actix)");
                }
            }, 8000);

            ws.onopen = () => {
                if (connIdRef.current !== connId) return;
                window.clearTimeout(openTimeout);

                reconnectAttempt.current = 0;
                setWsStatusSafe("online");
                setWsError(null);

                if (!silent) {
                    fire("ws_online", {
                        icon: "success",
                        title: "Realtime tersambung",
                        text: "WebSocket online",
                        cooldownMs: 12_000,
                    });
                }
            };

            ws.onmessage = (ev) => {
                if (connIdRef.current !== connId) return;
                handleWsMessage(String(ev.data));
            };

            ws.onerror = () => {
                if (connIdRef.current !== connId) return;
                setWsError("WebSocket error");
                fire("ws_error", {
                    icon: "warning",
                    title: "WebSocket error",
                    text: "Cek backend WS / reverse proxy",
                    cooldownMs: 20_000,
                });
            };

            ws.onclose = () => {
                if (connIdRef.current !== connId) return;
                if (intentionalCloseRef.current) return; // kita yang close

                if (wsStatusRef.current !== "offline") {
                    setWsStatusSafe("offline");
                    setWsError("WebSocket closed");
                    fire("ws_offline", {
                        icon: "warning",
                        title: "Realtime putus",
                        text: "Mencoba reconnect...",
                        cooldownMs: 20_000,
                    });
                }
                scheduleReconnect("WebSocket closed");
            };
        } catch (e: any) {
            const msg = e?.message || "Gagal konek WebSocket";
            setWsError(msg);
            setWsStatusSafe("offline");
            fire("ws_error", { icon: "error", title: "Gagal konek WebSocket", text: msg, cooldownMs: 20_000 });
            scheduleReconnect(msg);
        }
    }

    async function fetchDetail() {
        if (!id) {
            setLoadError("ID tidak ditemukan");
            setDetail(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setLoadError(null);

        try {
            // ✅ langsung ke Actix, bukan /api proxy Next.js
            const url = `${REST_BASE}/${encodeURIComponent(id)}`;
            const res = await fetch(url, {
                cache: "no-store",
                // kalau kamu pakai cookie auth, biarkan ini:
                credentials: "include",
                headers: { Accept: "application/json" },
            });

            const json = await safeJson(res);
            if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);

            const row = unwrapRow(json);
            if (!row) {
                console.log("DEBUG RESPONSE:", json);
                throw new Error("Response detail tidak valid (cek shape JSON).");
            }

            setDetail(toDetail(row));
            fire("rest_loaded", { icon: "success", title: "Detail dimuat", text: row.nama_lengkap || "—", cooldownMs: 10_000 });
        } catch (e: any) {
            const msg = e?.message || "Gagal load detail";
            setLoadError(msg);
            setDetail(null);
            fire("rest_error", { icon: "error", title: "Gagal load detail", text: msg, cooldownMs: 12_000 });
        } finally {
            setLoading(false);
        }
    }

    async function handleWsMessage(raw: string) {
        let msg: any;
        try {
            msg = JSON.parse(raw);
        } catch {
            return;
        }
        if (!msg || typeof msg !== "object") return;
        if (msg.tipe !== "masterpegawai") return;

        const event = String(msg.event || "");
        const payload = msg.payload || {};
        const pegawai_id = payload.pegawai_id ? String(payload.pegawai_id) : "";

        // hanya respon untuk id ini
        if (!pegawai_id || pegawai_id !== id) return;

        if (event === "updated" || event === "created") {
            await fetchDetail();
            return;
        }

        if (event === "deleted") {
            Swal.fire({
                icon: "warning",
                title: "Data dihapus",
                text: "Pegawai ini sudah dihapus. Kamu akan kembali ke daftar pegawai.",
                confirmButtonText: "OK",
            }).then(() => {
                router.push("/dashboard/pegawai");
            });
        }
    }

    async function copy(text: string | null | undefined, label: string) {
        const t = String(text ?? "").trim();
        if (!t) {
            fire("copied", { icon: "warning", title: "Kosong", text: `${label} tidak ada`, cooldownMs: 1200 });
            return;
        }
        try {
            await navigator.clipboard.writeText(t);
            fire("copied", { icon: "success", title: "Copied", text: `${label} disalin`, cooldownMs: 800 });
        } catch {
            fire("copied", { icon: "warning", title: "Gagal copy", text: "Browser menolak clipboard", cooldownMs: 1500 });
        }
    }

    useEffect(() => {
        fetchDetail();
        connectWS(wsEndpoint);

        return () => cleanupWS();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const headline = useMemo(() => {
        if (!detail) return { name: "—", sub: "—" };

        const jk = toJKLabel(detail.jenis_kelamin);
        const pendidikan = detail.pendidikan_terakhir || "—";
        const status = detail.status_perkawinan || "—";

        return {
            name: detail.nama_lengkap || "—",
            sub: `${jk} • ${pendidikan} • ${status}`,
        };
    }, [detail]);

    return (
        <div className="flex h-[100dvh] w-full max-w-full bg-slate-100 overflow-hidden text-slate-800">
            <div className="shrink-0">
                <Sidebar open={open} setOpen={setOpen} />
            </div>

            <div className="flex flex-col flex-1 min-w-0 w-full">
                <Header onToggle={() => setOpen(!open)} />

                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <main className="p-5 md:p-8 max-w-7xl mx-auto w-full space-y-6">
                        {/* Header Card */}
                        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-white shadow-sm">
                                        <Briefcase className="h-6 w-6" />
                                    </div>

                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h1 className="text-xl font-bold text-slate-900 truncate">Detail Pegawai</h1>
                                            <LivePill wsStatus={wsStatus} />
                                            {detail?.status_aktif && <StatusBadge status={detail.status_aktif} />}
                                        </div>

                                        <p className="mt-1 text-sm text-slate-600">
                                            Lihat data master pegawai lapangan, otomatis update via WebSocket.
                                        </p>

                                        <div className="mt-4 flex flex-wrap items-center gap-2">
                                            {wsError && (
                                                <span className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                          <CircleAlert className="h-4 w-4" />
                                                    {wsError}
                        </span>
                                            )}

                                            {loadError && (
                                                <span className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                          <CircleX className="h-4 w-4" />
                                                    {loadError}
                        </span>
                                            )}
                                        </div>

                                        <p className="mt-3 text-xs text-slate-500">
                                            REST (direct):{" "}
                                            <span className="font-mono">
                        {REST_BASE}/{id || "{id}"}
                      </span>
                                            <br />
                                            WS: <span className="font-mono">{wsEndpoint}</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:items-end gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Link
                                            href="/dashboard/pegawai"
                                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                                        >
                                            <ArrowLeft className="h-4 w-4" />
                                            Kembali
                                        </Link>

                                        <button
                                            type="button"
                                            onClick={() => fetchDetail()}
                                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                            Refresh
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                reconnectAttempt.current = 0;
                                                connectWS(wsEndpoint, { silent: false });
                                            }}
                                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                            Reconnect
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setShowWsConfig((v) => !v)}
                                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                                        >
                                            <Settings2 className="h-4 w-4" />
                                            WS
                                        </button>

                                        {detail?.pegawai_id && (
                                            <Link
                                                href={`/dashboard/pegawai/formpegawai?id=${encodeURIComponent(detail.pegawai_id)}`}
                                                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                                            >
                                                Edit
                                            </Link>
                                        )}
                                    </div>

                                    {showWsConfig && (
                                        <div className="mt-3 w-full sm:w-[520px] rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                            <p className="text-xs font-bold text-slate-600">Konfigurasi WebSocket</p>
                                            <div className="mt-3 flex flex-col md:flex-row gap-3">
                                                <input
                                                    value={wsEndpointDraft}
                                                    onChange={(e) => setWsEndpointDraft(e.target.value)}
                                                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200/60"
                                                    placeholder="ws://localhost:8080/ws/pegawai"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const next = wsEndpointDraft.trim();
                                                        if (!next) return;
                                                        setWsEndpoint(next);
                                                        reconnectAttempt.current = 0;
                                                        connectWS(next, { silent: false });
                                                    }}
                                                    className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                                                >
                                                    Pakai & Connect
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* hero */}
                            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                                {loading ? (
                                    <div className="flex items-center gap-3 text-slate-600">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Memuat detail pegawai...
                                    </div>
                                ) : detail ? (
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="grid h-14 w-14 place-items-center rounded-3xl bg-slate-900 text-white shadow-sm">
                                                <User2 className="h-6 w-6" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-lg font-extrabold text-slate-900 truncate">{headline.name}</p>
                                                <p className="text-sm text-slate-600">{headline.sub}</p>

                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <span className="rounded-xl border border-slate-200 bg-white px-3 py-1.5">
                            ID: <span className="font-mono font-bold">{detail.pegawai_id}</span>
                          </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => copy(detail.pegawai_id, "Pegawai ID")}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-bold hover:bg-slate-50"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                        Copy
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
                                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                                <p className="text-xs font-bold text-slate-500">NIK</p>
                                                <div className="mt-1 flex items-center justify-between gap-2">
                                                    <p className="text-sm font-extrabold text-slate-900 font-mono">{detail.nik || "—"}</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => copy(detail.nik, "NIK")}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold hover:bg-slate-50"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                        Copy
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                                <p className="text-xs font-bold text-slate-500">No HP</p>
                                                <p className="mt-1 text-sm font-extrabold text-slate-900">{detail.no_hp || "—"}</p>
                                            </div>

                                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                                <p className="text-xs font-bold text-slate-500">Last Update</p>
                                                <p className="mt-1 text-sm font-extrabold text-slate-900">{formatDateTime(detail.diubah_pada)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-slate-600">Tidak ada data.</div>
                                )}
                            </div>
                        </div>

                        {/* CONTENT */}
                        {loading ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <SkeletonCard />
                                <SkeletonCard />
                                <SkeletonCard />
                                <SkeletonCard />
                            </div>
                        ) : !detail ? (
                            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                                <p className="text-sm text-slate-600">Data tidak ditemukan atau gagal dimuat.</p>
                                <div className="mt-4 flex justify-center gap-2">
                                    <button
                                        onClick={() => fetchDetail()}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                        Coba lagi
                                    </button>
                                    <Link
                                        href="/dashboard/pegawai"
                                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                        Kembali
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <Section title="Identitas" icon={<User2 className="h-5 w-5" />}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Field label="Nama Lengkap" value={detail.nama_lengkap} />
                                        <Field label="Nama Panggilan" value={detail.nama_panggilan || "—"} />
                                        <Field label="NIK" value={detail.nik} mono />
                                        <Field label="No KK" value={detail.no_kk || "—"} mono />
                                        <Field label="Jenis Kelamin" value={toJKLabel(detail.jenis_kelamin)} />
                                        <Field label="Agama" value={detail.agama || "—"} />
                                        <Field label="Tempat Lahir" value={detail.tempat_lahir || "—"} />
                                        <Field label="Tanggal Lahir" value={formatDateLong(detail.tanggal_lahir)} />
                                    </div>
                                </Section>

                                <Section title="Status & Pendidikan" icon={<ShieldCheck className="h-5 w-5" />}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Field label="Status Perkawinan" value={detail.status_perkawinan || "—"} />
                                        <Field label="Pendidikan Terakhir" value={detail.pendidikan_terakhir || "—"} />
                                        <Field label="Status Aktif" value={<StatusBadge status={detail.status_aktif} />} />
                                        <Field label="Tanggal Masuk" value={formatDateLong(detail.tanggal_masuk)} />
                                    </div>
                                </Section>

                                <Section title="Kontak" icon={<Phone className="h-5 w-5" />}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Field
                                            label="No HP"
                                            value={
                                                detail.no_hp ? (
                                                    <span className="inline-flex items-center gap-2">
                            <Phone className="h-4 w-4 text-slate-500" />
                                                        {detail.no_hp}
                          </span>
                                                ) : (
                                                    "—"
                                                )
                                            }
                                        />
                                        <Field
                                            label="Email"
                                            value={
                                                detail.email ? (
                                                    <span className="inline-flex items-center gap-2">
                            <Mail className="h-4 w-4 text-slate-500" />
                                                        {detail.email}
                          </span>
                                                ) : (
                                                    "—"
                                                )
                                            }
                                        />
                                    </div>
                                </Section>

                                <Section title="Alamat KTP" icon={<Home className="h-5 w-5" />}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Field label="Alamat" value={detail.alamat_ktp || "—"} />
                                        <Field label="Kelurahan" value={detail.kelurahan_ktp || "—"} />
                                        <Field label="Kecamatan" value={detail.kecamatan_ktp || "—"} />
                                        <Field label="Kota/Kab" value={detail.kota_kab_ktp || "—"} />
                                        <Field label="Provinsi" value={detail.provinsi_ktp || "—"} />
                                        <Field label="Kode Pos" value={detail.kode_pos_ktp || "—"} mono />
                                    </div>
                                </Section>

                                <Section title="Alamat Domisili" icon={<MapPin className="h-5 w-5" />}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Field label="Alamat" value={detail.alamat_domisili || "—"} />
                                        <Field label="Kelurahan" value={detail.kelurahan_domisili || "—"} />
                                        <Field label="Kecamatan" value={detail.kecamatan_domisili || "—"} />
                                        <Field label="Kota/Kab" value={detail.kota_kab_domisili || "—"} />
                                        <Field label="Provinsi" value={detail.provinsi_domisili || "—"} />
                                        <Field label="Kode Pos" value={detail.kode_pos_domisili || "—"} mono />
                                    </div>
                                </Section>

                                <Section title="Kontak Darurat" icon={<CircleAlert className="h-5 w-5" />}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Field label="Nama" value={detail.kontak_darurat_nama || "—"} />
                                        <Field label="Hubungan" value={detail.kontak_darurat_hubungan || "—"} />
                                        <Field label="No HP" value={detail.kontak_darurat_no_hp || "—"} />
                                    </div>
                                </Section>

                                <Section title="Legal & Kepesertaan" icon={<FileText className="h-5 w-5" />}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Field label="NPWP" value={detail.npwp || "—"} mono />
                                        <Field label="BPJS Kesehatan" value={detail.bpjs_kesehatan || "—"} mono />
                                        <Field label="BPJS Ketenagakerjaan" value={detail.bpjs_ketenagakerjaan || "—"} mono />
                                    </div>
                                </Section>

                                <Section title="Bank" icon={<CreditCard className="h-5 w-5" />}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Field label="Nama Bank" value={detail.bank_nama || "—"} />
                                        <Field label="Nama Pemilik" value={detail.bank_nama_pemilik || "—"} />
                                        <Field
                                            label="No Rekening"
                                            value={
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-mono">{maskRek(detail.bank_no_rekening)}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => copy(detail.bank_no_rekening, "No Rekening")}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold hover:bg-slate-50"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                        Copy
                                                    </button>
                                                </div>
                                            }
                                        />
                                    </div>
                                </Section>

                                <Section title="Lainnya" icon={<Briefcase className="h-5 w-5" />}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Field label="Foto URL" value={detail.foto_url || "—"} />
                                        <Field label="Catatan" value={detail.catatan || "—"} />
                                    </div>
                                </Section>

                                <Section title="Audit" icon={<ShieldCheck className="h-5 w-5" />}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Field label="Dibuat Pada" value={formatDateTime(detail.dibuat_pada)} />
                                        <Field label="Diubah Pada" value={formatDateTime(detail.diubah_pada)} />
                                    </div>
                                </Section>
                            </div>
                        )}
                    </main>

                    <Footer />
                </div>
            </div>
        </div>
    );
}

function SkeletonCard() {
    return (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-pulse">
            <div className="border-b border-slate-200 bg-slate-50 p-5">
                <div className="h-4 w-40 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-52 rounded bg-slate-200" />
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="h-16 rounded-2xl bg-slate-200" />
                <div className="h-16 rounded-2xl bg-slate-200" />
                <div className="h-16 rounded-2xl bg-slate-200" />
                <div className="h-16 rounded-2xl bg-slate-200" />
            </div>
        </div>
    );
}
