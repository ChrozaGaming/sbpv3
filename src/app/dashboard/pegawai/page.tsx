"use client";

import React, {useEffect, useMemo, useRef, useState} from "react";
import Link from "next/link";
import Swal from "sweetalert2";
import {
    ArrowUpDown,
    Briefcase,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    CircleAlert,
    CircleX,
    Loader2,
    Plus,
    RefreshCw,
    Search,
    Settings2,
    User2,
} from "lucide-react";

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

/* ===========================
   CONFIG (DIRECT ACTIX)
   - REST: http://localhost:8080/api/masterpegawai
   - WS  : ws://localhost:8080/ws/pegawai
   =========================== */
const API_BASE =
    (process.env.NEXT_PUBLIC_API_URL as string | undefined) || "http://localhost:8080";

function joinUrl(base: string, path: string) {
    const b = String(base || "").replace(/\/+$/, "");
    const p = String(path || "").replace(/^\/+/, "");
    return `${b}/${p}`;
}

const REST_BASE = joinUrl(API_BASE, "/api/masterpegawai");

const WS_DEFAULT =
    (process.env.NEXT_PUBLIC_MASTERPEGAWAI_WS_URL as string | undefined) ||
    joinUrl(API_BASE.replace(/^http/i, "ws"), "/ws/pegawai");

/* ===========================
   Types
   =========================== */
type StatusAktif = "aktif" | "nonaktif";

type MasterPegawaiApi = {
    pegawai_id: string;
    nik: string;
    nama_lengkap: string;
    nama_panggilan?: string | null;
    no_hp: string;
    kota_kab_ktp: string;
    provinsi_ktp: string;

    bank_nama: string;
    bank_no_rekening: string;

    status_aktif: string;
    tanggal_masuk?: string | null;
    diubah_pada?: string | null;
};

type PegawaiRow = {
    pegawai_id: string;
    nik: string;
    nama_lengkap: string;
    nama_panggilan?: string | null;
    no_hp: string;
    kota_kab_ktp?: string | null;
    provinsi_ktp?: string | null;
    bank_nama?: string | null;
    bank_no_rekening?: string | null;
    status_aktif: StatusAktif;
    tanggal_masuk?: string | null;
    diubah_pada?: string | null;
};

type SortKey = "nama" | "status" | "tanggal_masuk" | "nik";
type SortDir = "asc" | "desc";

/* ===========================
   Helpers
   =========================== */
function cn(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(" ");
}

function safeLower(v: unknown) {
    return String(v ?? "").toLowerCase();
}

function s(v: unknown) {
    // trim string aman (penting untuk bpchar dari postgres)
    const t = String(v ?? "");
    return t.trim();
}

function formatDateShort(iso?: string | null) {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "2-digit" });
}

function toRow(x: MasterPegawaiApi): PegawaiRow {
    const status = s(x.status_aktif).toLowerCase() === "nonaktif" ? "nonaktif" : "aktif";
    return {
        pegawai_id: s(x.pegawai_id),
        nik: s(x.nik),
        nama_lengkap: s(x.nama_lengkap),
        nama_panggilan: x.nama_panggilan ? s(x.nama_panggilan) : null,
        no_hp: s(x.no_hp),
        kota_kab_ktp: x.kota_kab_ktp ? s(x.kota_kab_ktp) : null,
        provinsi_ktp: x.provinsi_ktp ? s(x.provinsi_ktp) : null,
        bank_nama: x.bank_nama ? s(x.bank_nama) : null,
        bank_no_rekening: x.bank_no_rekening ? s(x.bank_no_rekening) : null,
        status_aktif: status as StatusAktif,
        tanggal_masuk: x.tanggal_masuk ?? null,
        diubah_pada: x.diubah_pada ?? null,
    };
}

async function safeJson(res: Response) {
    const text = await res.text();
    try {
        return text ? JSON.parse(text) : null;
    } catch {
        return { success: false, message: text || `HTTP ${res.status}` };
    }
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
    | "rest_loaded";

function useToastGate() {
    const lastAtRef = useRef<Record<string, number>>({});

    function fire(
        key: ToastKey,
        opt: { icon: "success" | "info" | "warning" | "error"; title: string; text?: string; cooldownMs?: number }
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
   Page
   =========================== */
export default function Page() {
    const [open, setOpen] = useState(true);
    const { fire } = useToastGate();

    const [rows, setRows] = useState<PegawaiRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    // websocket
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<number | null>(null);
    const reconnectAttempt = useRef(0);

    const [wsStatus, setWsStatus] = useState<"connecting" | "online" | "offline">("connecting");
    const wsStatusRef = useRef<"connecting" | "online" | "offline">("connecting");
    const [wsError, setWsError] = useState<string | null>(null);

    const [wsEndpoint, setWsEndpoint] = useState<string>(WS_DEFAULT);
    const [wsEndpointDraft, setWsEndpointDraft] = useState<string>(WS_DEFAULT);
    const [showWsConfig, setShowWsConfig] = useState(false);

    // guards
    const connIdRef = useRef(0);
    const intentionalCloseRef = useRef(false);

    // UI
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | StatusAktif>("all");
    const [sortKey, setSortKey] = useState<SortKey>("nama");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const stats = useMemo(() => {
        const total = rows.length;
        const aktif = rows.filter((r) => r.status_aktif === "aktif").length;
        return { total, aktif, nonaktif: total - aktif };
    }, [rows]);

    const filteredSorted = useMemo(() => {
        const q = query.trim().toLowerCase();
        let list = rows;

        if (statusFilter !== "all") list = list.filter((r) => r.status_aktif === statusFilter);

        if (q) {
            list = list.filter((r) => {
                const hay =
                    `${r.nik} ${r.nama_lengkap} ${r.nama_panggilan ?? ""} ${r.no_hp} ${r.kota_kab_ktp ?? ""} ${r.provinsi_ktp ?? ""} ${
                        r.bank_nama ?? ""
                    }`.toLowerCase();
                return hay.includes(q);
            });
        }

        const dir = sortDir === "asc" ? 1 : -1;

        return [...list].sort((a, b) => {
            if (sortKey === "nama") return safeLower(a.nama_lengkap).localeCompare(safeLower(b.nama_lengkap)) * dir;
            if (sortKey === "nik") return safeLower(a.nik).localeCompare(safeLower(b.nik)) * dir;
            if (sortKey === "status") return safeLower(a.status_aktif).localeCompare(safeLower(b.status_aktif)) * dir;
            if (sortKey === "tanggal_masuk") {
                const ta = a.tanggal_masuk ? new Date(a.tanggal_masuk).getTime() : 0;
                const tb = b.tanggal_masuk ? new Date(b.tanggal_masuk).getTime() : 0;
                return (ta - tb) * dir;
            }
            return 0;
        });
    }, [rows, query, statusFilter, sortKey, sortDir]);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredSorted.length / pageSize)), [filteredSorted.length]);

    const paged = useMemo(() => {
        const p = Math.min(page, totalPages);
        const start = (p - 1) * pageSize;
        return filteredSorted.slice(start, start + pageSize);
    }, [filteredSorted, page, totalPages]);

    useEffect(() => setPage(1), [query, statusFilter, sortKey, sortDir]);

    function setWsStatusSafe(next: "connecting" | "online" | "offline") {
        wsStatusRef.current = next;
        setWsStatus(next);
    }

    function upsertRow(next: PegawaiRow) {
        if (!next?.pegawai_id) return;
        setRows((prev) => {
            const idx = prev.findIndex((x) => x.pegawai_id === next.pegawai_id);
            if (idx === -1) return [next, ...prev];
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...next };
            return copy;
        });
    }

    function deleteRow(id: string) {
        if (!id) return;
        setRows((prev) => prev.filter((x) => x.pegawai_id !== id));
    }

    // debounced list refresh
    const refetchTimer = useRef<number | null>(null);
    function refetchListDebounced(ms = 250) {
        if (refetchTimer.current) window.clearTimeout(refetchTimer.current);
        refetchTimer.current = window.setTimeout(() => {
            fetchList();
        }, ms);
    }

    async function fetchList() {
        setLoading(true);
        setLoadError(null);

        try {
            const res = await fetch(`${REST_BASE}?page=1&limit=200`, {
                cache: "no-store",
                // kalau butuh cookie/jwt via cookie, aktifkan:
                // credentials: "include",
            });
            const json = await safeJson(res);

            if (!res.ok || !json?.success) throw new Error(json?.message || `HTTP ${res.status}`);

            const data: MasterPegawaiApi[] = Array.isArray(json.data) ? json.data : [];
            setRows(data.map(toRow));

            fire("rest_loaded", {
                icon: "success",
                title: "Data pegawai dimuat",
                text: `${data.length} data`,
                cooldownMs: 30_000,
            });
        } catch (e: any) {
            const msg = e?.message || "Gagal mengambil data.";
            setLoadError(msg);
            fire("rest_error", { icon: "error", title: "Gagal load data", text: msg, cooldownMs: 12_000 });
        } finally {
            setLoading(false);
        }
    }

    async function fetchDetailById(id: string) {
        const res = await fetch(`${REST_BASE}/${encodeURIComponent(id)}`, {
            cache: "no-store",
            // credentials: "include",
        });
        const json = await safeJson(res);
        if (!res.ok || !json?.success || !json?.data) throw new Error(json?.message || `HTTP ${res.status}`);
        return toRow(json.data as MasterPegawaiApi);
    }

    /* ===========================
       WebSocket (anti-spam + anti stale)
       =========================== */
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

    function normalizeWsUrl(url: string) {
        if (typeof window !== "undefined") {
            const isHttps = window.location.protocol === "https:";
            if (isHttps && url.startsWith("ws://")) return url.replace("ws://", "wss://");
        }
        return url;
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
        const pegawai_id = payload.pegawai_id ? String(payload.pegawai_id) : null;

        try {
            if ((event === "created" || event === "updated") && pegawai_id) {
                const full = await fetchDetailById(pegawai_id);
                upsertRow(full);

                fire("ws_online", {
                    icon: event === "created" ? "success" : "info",
                    title: event === "created" ? "Pegawai ditambahkan" : "Pegawai diperbarui",
                    text: `${full.nama_lengkap || "—"} (${full.nik || "—"})`,
                    cooldownMs: 1200,
                });

                refetchListDebounced(500);
                return;
            }

            if (event === "deleted" && pegawai_id) {
                deleteRow(pegawai_id);
                fire("ws_online", {
                    icon: "warning",
                    title: "Pegawai dihapus",
                    text: `ID: ${pegawai_id}`,
                    cooldownMs: 1200,
                });
                refetchListDebounced(500);
            }
        } catch (e: any) {
            fire("ws_error", {
                icon: "warning",
                title: "Realtime update gagal",
                text: e?.message || "Tidak bisa ambil detail pegawai.",
                cooldownMs: 10_000,
            });
            refetchListDebounced(300);
        }
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

            const openTimeout = window.setTimeout(() => {
                if (connIdRef.current !== connId) return; // stale
                if (ws.readyState !== WebSocket.OPEN) {
                    try {
                        ws.close();
                    } catch {}

                    setWsStatusSafe("offline");
                    setWsError("Timeout (cek path WS Actix)");

                    fire("ws_timeout", {
                        icon: "error",
                        title: "Realtime timeout",
                        text: "Cek route WS Actix (path /ws/pegawai) & server hidup.",
                        cooldownMs: 20_000,
                    });

                    scheduleReconnect("Timeout (cek path WS Actix)");
                }
            }, 8000);

            ws.onopen = () => {
                if (connIdRef.current !== connId) return; // stale
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
                if (connIdRef.current !== connId) return; // stale
                handleWsMessage(String(ev.data));
            };

            ws.onerror = () => {
                if (connIdRef.current !== connId) return; // stale
                setWsError("WebSocket error");
                fire("ws_error", {
                    icon: "warning",
                    title: "WebSocket error",
                    text: "Cek backend WS / reverse proxy",
                    cooldownMs: 20_000,
                });
            };

            ws.onclose = () => {
                if (connIdRef.current !== connId) return; // stale
                if (intentionalCloseRef.current) return;

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

    useEffect(() => {
        fetchList();
        connectWS(wsEndpoint);

        return () => {
            if (refetchTimer.current) window.clearTimeout(refetchTimer.current);
            cleanupWS();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const statusPill = useMemo(() => {
        if (wsStatus === "online") {
            return {
                label: "Live",
                cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
                icon: <CheckCircle2 className="h-4 w-4" />,
            };
        }
        if (wsStatus === "connecting") {
            return {
                label: "Connecting",
                cls: "bg-slate-50 text-slate-700 border-slate-200",
                icon: <Loader2 className="h-4 w-4 animate-spin" />,
            };
        }
        return {
            label: "Offline",
            cls: "bg-rose-50 text-rose-700 border-rose-200",
            icon: <CircleX className="h-4 w-4" />,
        };
    }, [wsStatus]);

    function toggleSort(key: SortKey) {
        if (sortKey !== key) {
            setSortKey(key);
            setSortDir("asc");
            return;
        }
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    }

    return (
        <div className="flex h-[100dvh] w-full max-w-full bg-slate-100 overflow-hidden text-slate-800">
            <div className="shrink-0">
                <Sidebar open={open} setOpen={setOpen} />
            </div>

            <div className="flex flex-col flex-1 min-w-0 w-full">
                <Header onToggle={() => setOpen(!open)} />

                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <main className="p-5 md:p-8 max-w-7xl mx-auto w-full space-y-6">
                        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-white shadow-sm">
                                        <Briefcase className="h-6 w-6" />
                                    </div>

                                    <div>
                                        <h1 className="text-xl font-bold text-slate-900">Data Pegawai</h1>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Monitoring master pegawai lapangan secara real-time via WebSocket.
                                        </p>

                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                          className={cn(
                              "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold",
                              statusPill.cls
                          )}
                      >
                        {statusPill.icon}
                          {statusPill.label}
                      </span>

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
                                    </div>
                                </div>

                                <div className="flex flex-col sm:items-end gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => fetchList()}
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

                                        <Link
                                            href="/dashboard/pegawai/formpegawai"
                                            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Tambah Pegawai
                                        </Link>
                                    </div>

                                    <p className="text-xs text-slate-500">
                                        REST: <span className="font-mono">{REST_BASE}</span>
                                        <br />
                                        WS: <span className="font-mono">{wsEndpoint}</span>
                                    </p>
                                </div>
                            </div>

                            {showWsConfig && (
                                <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
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

                        {/* Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <StatCard title="Total Pegawai" value={stats.total} icon={<User2 className="h-5 w-5" />} />
                            <StatCard title="Aktif" value={stats.aktif} icon={<CheckCircle2 className="h-5 w-5" />} accent="emerald" />
                            <StatCard title="Nonaktif" value={stats.nonaktif} icon={<CircleX className="h-5 w-5" />} accent="rose" />
                        </div>

                        {/* Table */}
                        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <div className="p-5 md:p-6 border-b border-slate-200">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                                        <div className="relative w-full sm:w-[360px]">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <input
                                                value={query}
                                                onChange={(e) => setQuery(e.target.value)}
                                                placeholder="Cari: nama, NIK, no HP, kota, bank..."
                                                className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200/60"
                                            />
                                        </div>

                                        <select
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value as any)}
                                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200/60"
                                        >
                                            <option value="all">Semua Status</option>
                                            <option value="aktif">Aktif</option>
                                            <option value="nonaktif">Nonaktif</option>
                                        </select>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setQuery("");
                                                setStatusFilter("all");
                                                setSortKey("nama");
                                                setSortDir("asc");
                                                setPage(1);
                                            }}
                                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                                        >
                                            Reset
                                        </button>
                                    </div>

                                    <div className="text-sm text-slate-600">
                                        Menampilkan <span className="font-semibold text-slate-900">{filteredSorted.length}</span> data
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-[980px] w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr className="text-left text-xs font-bold text-slate-600">
                                        <ThSort label="NIK" active={sortKey === "nik"} dir={sortDir} onClick={() => toggleSort("nik")} />
                                        <ThSort label="Nama" active={sortKey === "nama"} dir={sortDir} onClick={() => toggleSort("nama")} />
                                        <th className="px-5 py-3">No HP</th>
                                        <th className="px-5 py-3">Kota/Prov</th>
                                        <th className="px-5 py-3">Bank</th>
                                        <ThSort label="Status" active={sortKey === "status"} dir={sortDir} onClick={() => toggleSort("status")} />
                                        <ThSort
                                            label="Tanggal Masuk"
                                            active={sortKey === "tanggal_masuk"}
                                            dir={sortDir}
                                            onClick={() => toggleSort("tanggal_masuk")}
                                        />
                                        <th className="px-5 py-3 text-right">Aksi</th>
                                    </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-200">
                                    {loading ? (
                                        <>
                                            <SkeletonRow />
                                            <SkeletonRow />
                                            <SkeletonRow />
                                        </>
                                    ) : paged.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
                                                Tidak ada data yang cocok dengan filter.
                                            </td>
                                        </tr>
                                    ) : (
                                        paged.map((r) => (
                                            <tr key={r.pegawai_id || `${r.nik}-${r.no_hp}`} className="hover:bg-slate-50/80 transition">
                                                <td className="px-5 py-4 text-sm font-semibold text-slate-900">{r.nik?.trim() ? r.nik : "-"}</td>

                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-900 text-white">
                                                            <User2 className="h-4 w-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold text-slate-900 truncate">
                                                                {r.nama_lengkap?.trim() ? r.nama_lengkap : "—"}
                                                            </p>
                                                            <p className="text-xs text-slate-500 truncate">
                                                                {r.nama_panggilan?.trim() ? `(${r.nama_panggilan})` : "—"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4 text-sm text-slate-700">{r.no_hp?.trim() ? r.no_hp : "-"}</td>

                                                <td className="px-5 py-4 text-sm text-slate-700">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold">{r.kota_kab_ktp?.trim() ? r.kota_kab_ktp : "-"}</span>
                                                        <span className="text-xs text-slate-500">{r.provinsi_ktp?.trim() ? r.provinsi_ktp : "-"}</span>
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4 text-sm text-slate-700">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold">{r.bank_nama?.trim() ? r.bank_nama : "-"}</span>
                                                        <span className="text-xs text-slate-500">
                                {r.bank_no_rekening?.trim()
                                    ? `•••• ${String(r.bank_no_rekening).replace(/\s+/g, "").slice(-4)}`
                                    : "—"}
                              </span>
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <StatusBadge status={r.status_aktif} />
                                                </td>

                                                <td className="px-5 py-4 text-sm text-slate-700">{formatDateShort(r.tanggal_masuk)}</td>

                                                <td className="px-5 py-4 text-right">
                                                    <div className="inline-flex items-center gap-2">
                                                        <Link
                                                            href={`/dashboard/pegawai/formpegawai?id=${encodeURIComponent(r.pegawai_id)}`}
                                                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                                                        >
                                                            Edit
                                                        </Link>
                                                        <Link
                                                            href={`/dashboard/pegawai/detail?id=${encodeURIComponent(r.pegawai_id)}`}
                                                            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
                                                        >
                                                            Detail
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between p-5 md:p-6 border-t border-slate-200 bg-white">
                                <div className="text-sm text-slate-600">
                                    Page <span className="font-semibold text-slate-900">{page}</span> /{" "}
                                    <span className="font-semibold text-slate-900">{totalPages}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={page <= 1}
                                        className={cn(
                                            "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold shadow-sm transition",
                                            page <= 1
                                                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                        )}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Prev
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={page >= totalPages}
                                        className={cn(
                                            "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold shadow-sm transition",
                                            page >= totalPages
                                                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                        )}
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </main>

                    <Footer />
                </div>
            </div>
        </div>
    );
}

/* ===========================
   UI components
   =========================== */
function StatCard({
                      title,
                      value,
                      icon,
                      accent,
                  }: {
    title: string;
    value: number;
    icon: React.ReactNode;
    accent?: "emerald" | "rose";
}) {
    const accentCls =
        accent === "emerald"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : accent === "rose"
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-white border-slate-200 text-slate-800";

    return (
        <div className={cn("rounded-3xl border p-5 shadow-sm", accentCls)}>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold opacity-80">{title}</p>
                    <p className="mt-1 text-2xl font-extrabold">{value}</p>
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-white shadow-sm">{icon}</div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: StatusAktif }) {
    const isAktif = status === "aktif";
    return (
        <span
            className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold",
                isAktif ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-700"
            )}
        >
      {isAktif ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
            {isAktif ? "Aktif" : "Nonaktif"}
    </span>
    );
}

function ThSort({
                    label,
                    active,
                    dir,
                    onClick,
                }: {
    label: string;
    active: boolean;
    dir: "asc" | "desc";
    onClick: () => void;
}) {
    return (
        <th className="px-5 py-3">
            <button
                type="button"
                onClick={onClick}
                className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-2 py-1 transition",
                    active ? "text-slate-900" : "text-slate-600 hover:text-slate-900"
                )}
                title="Sort"
            >
                {label}
                <ArrowUpDown className={cn("h-4 w-4", active ? "opacity-100" : "opacity-60")} />
                {active && <span className="text-[10px] font-black">{dir === "asc" ? "▲" : "▼"}</span>}
            </button>
        </th>
    );
}

function SkeletonRow() {
    return (
        <tr className="animate-pulse">
            <td className="px-5 py-4">
                <div className="h-4 w-24 rounded bg-slate-200" />
            </td>
            <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-2xl bg-slate-200" />
                    <div className="space-y-2">
                        <div className="h-4 w-40 rounded bg-slate-200" />
                        <div className="h-3 w-24 rounded bg-slate-200" />
                    </div>
                </div>
            </td>
            <td className="px-5 py-4">
                <div className="h-4 w-28 rounded bg-slate-200" />
            </td>
            <td className="px-5 py-4">
                <div className="h-4 w-32 rounded bg-slate-200" />
            </td>
            <td className="px-5 py-4">
                <div className="h-4 w-28 rounded bg-slate-200" />
            </td>
            <td className="px-5 py-4">
                <div className="h-6 w-24 rounded bg-slate-200" />
            </td>
            <td className="px-5 py-4">
                <div className="h-4 w-24 rounded bg-slate-200" />
            </td>
            <td className="px-5 py-4 text-right">
                <div className="inline-flex gap-2">
                    <div className="h-8 w-16 rounded bg-slate-200" />
                    <div className="h-8 w-16 rounded bg-slate-200" />
                </div>
            </td>
        </tr>
    );
}
