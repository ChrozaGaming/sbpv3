"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

// ════════════════════════════════════════════════════════════════
// CONFIG — sesuaikan dengan environment
// ════════════════════════════════════════════════════════════════
const API_BASE =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const API = `${API_BASE}/api`;
const WS_URL =
    (process.env.NEXT_PUBLIC_WS_URL || API_BASE.replace(/^http/, "ws")) +
    "/ws/invoice";

// ════════════════════════════════════════════════════════════════
// TIPE DATA — sesuai Rust model
// ════════════════════════════════════════════════════════════════
type StatusDB =
    | "belum_bayar"
    | "lunas"
    | "sebagian"
    | "terlambat"
    | "batal";

type StatusDisplay =
    | "Belum Bayar"
    | "Lunas"
    | "Sebagian"
    | "Terlambat"
    | "Batal";

type FrekuensiTagihan =
    | "harian"
    | "mingguan"
    | "bulanan"
    | "tahunan"
    | "sekali";

interface Invoice {
    invoice_id: string;
    nomor_invoice: string;
    jenis_tagihan: string;
    nama_pemilik: string;
    deskripsi: string | null;
    frekuensi: FrekuensiTagihan;
    periode: string | null;
    jumlah: number;
    jumlah_dibayar: number;
    tanggal_dibuat: string;
    jatuh_tempo: string;
    status: StatusDB;
    kontak_hp: string | null;
    kontak_email: string | null;
    nomor_id_meter: string | null;
    pemakaian: number | null;
    satuan_pemakaian: string | null;
    harga_satuan: number | null;
    reminder_aktif: boolean;
    reminder_metode: string | null;
    reminder_hari_before: string | null;
    reminder_berikutnya: string | null;
    catatan: string | null;
    created_at: string;
    updated_at: string;
}

interface FreqConfig {
    key: FrekuensiTagihan;
    label: string;
    desc: string;
    icon: string;
    grad: string;
    light: string;
    ring: string;
    text: string;
    bg: string;
    border: string;
    pill: string;
    accent: string;
    barColor: string;
}

// ════════════════════════════════════════════════════════════════
// STATUS MAPPING: DB ↔ Display
// ════════════════════════════════════════════════════════════════
const STATUS_MAP: Record<StatusDB, StatusDisplay> = {
    belum_bayar: "Belum Bayar",
    lunas: "Lunas",
    sebagian: "Sebagian",
    terlambat: "Terlambat",
    batal: "Batal",
};

const STATUS_REVERSE: Record<string, StatusDB | "Semua"> = {
    Semua: "Semua" as any,
    "Belum Bayar": "belum_bayar",
    Lunas: "lunas",
    Sebagian: "sebagian",
    Terlambat: "terlambat",
};

function displayStatus(s: StatusDB): StatusDisplay {
    return STATUS_MAP[s] ?? (s as any);
}

// ════════════════════════════════════════════════════════════════
// KONFIGURASI FREKUENSI
// ════════════════════════════════════════════════════════════════
const FREQ: FreqConfig[] = [
    {
        key: "bulanan",
        label: "Bulanan",
        desc: "Tiap bulan",
        icon: "📅",
        grad: "from-blue-500 to-indigo-600",
        light: "from-blue-50 to-indigo-50",
        ring: "ring-blue-400/30",
        text: "text-blue-700",
        bg: "bg-blue-50",
        border: "border-blue-300",
        pill: "bg-blue-100 text-blue-700",
        accent: "#4f46e5",
        barColor: "bg-blue-500",
    },
    {
        key: "mingguan",
        label: "Mingguan",
        desc: "Tiap minggu",
        icon: "🔁",
        grad: "from-violet-500 to-purple-600",
        light: "from-violet-50 to-purple-50",
        ring: "ring-violet-400/30",
        text: "text-violet-700",
        bg: "bg-violet-50",
        border: "border-violet-300",
        pill: "bg-violet-100 text-violet-700",
        accent: "#7c3aed",
        barColor: "bg-violet-500",
    },
    {
        key: "harian",
        label: "Harian",
        desc: "Tiap hari",
        icon: "⚡",
        grad: "from-amber-400 to-orange-500",
        light: "from-amber-50 to-orange-50",
        ring: "ring-amber-400/30",
        text: "text-amber-700",
        bg: "bg-amber-50",
        border: "border-amber-300",
        pill: "bg-amber-100 text-amber-700",
        accent: "#d97706",
        barColor: "bg-amber-500",
    },
    {
        key: "tahunan",
        label: "Tahunan",
        desc: "Tiap tahun",
        icon: "📆",
        grad: "from-emerald-500 to-teal-600",
        light: "from-emerald-50 to-teal-50",
        ring: "ring-emerald-400/30",
        text: "text-emerald-700",
        bg: "bg-emerald-50",
        border: "border-emerald-300",
        pill: "bg-emerald-100 text-emerald-700",
        accent: "#059669",
        barColor: "bg-emerald-500",
    },
    {
        key: "sekali",
        label: "Sekali Bayar",
        desc: "Non-rutin",
        icon: "🎯",
        grad: "from-rose-500 to-pink-600",
        light: "from-rose-50 to-pink-50",
        ring: "ring-rose-400/30",
        text: "text-rose-700",
        bg: "bg-rose-50",
        border: "border-rose-300",
        pill: "bg-rose-100 text-rose-700",
        accent: "#e11d48",
        barColor: "bg-rose-500",
    },
];

// ════════════════════════════════════════════════════════════════
// UTILITAS
// ════════════════════════════════════════════════════════════════
function formatRupiah(n: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(n);
}

function formatTanggal(t: string): string {
    return new Date(t).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function hitungProgress(d: number, t: number): number {
    return t <= 0 ? 0 : Math.min(Math.round((d / t) * 100), 100);
}

// ════════════════════════════════════════════════════════════════
// KOMPONEN KECIL
// ════════════════════════════════════════════════════════════════
function StatusBadge({ status }: { status: StatusDB }) {
    const label = displayStatus(status);
    const m: Record<
        StatusDB,
        { bg: string; brd: string; t: string; d: string; pulse?: boolean }
    > = {
        belum_bayar: {
            bg: "bg-gradient-to-r from-amber-50 to-yellow-50",
            brd: "border-amber-200",
            t: "text-amber-700",
            d: "bg-amber-400",
        },
        lunas: {
            bg: "bg-gradient-to-r from-emerald-50 to-green-50",
            brd: "border-emerald-200",
            t: "text-emerald-700",
            d: "bg-emerald-400",
        },
        sebagian: {
            bg: "bg-gradient-to-r from-sky-50 to-cyan-50",
            brd: "border-sky-200",
            t: "text-sky-700",
            d: "bg-sky-400",
        },
        terlambat: {
            bg: "bg-gradient-to-r from-rose-50 to-red-50",
            brd: "border-rose-200",
            t: "text-rose-700",
            d: "bg-rose-500",
            pulse: true,
        },
        batal: {
            bg: "bg-neutral-100",
            brd: "border-neutral-300",
            t: "text-neutral-500",
            d: "bg-neutral-400",
        },
    };
    const c = m[status] ?? m.batal;
    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${c.bg} ${c.brd} ${c.t}`}
        >
            <span
                className={`w-1.5 h-1.5 rounded-full ${c.d} ${c.pulse ? "animate-pulse" : ""}`}
            />
            {label}
        </span>
    );
}

function CircleProgress({
    persen,
    accent,
    size = 52,
}: {
    persen: number;
    accent: string;
    size?: number;
}) {
    const stroke = 5;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const offset = c - (persen / 100) * c;
    return (
        <svg width={size} height={size} className="transform -rotate-90">
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="#f1f5f9"
                strokeWidth={stroke}
            />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={accent}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset 0.8s ease" }}
            />
        </svg>
    );
}

function BarProgress({
    persen,
    colorClass,
}: {
    persen: number;
    colorClass: string;
}) {
    return (
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${colorClass}`}
                style={{ width: `${persen}%` }}
            />
        </div>
    );
}

function LoadingSkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            <div className="h-16 bg-slate-200/50 rounded-2xl" />
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-24 bg-slate-200/50 rounded-2xl" />
                ))}
            </div>
            <div className="h-10 bg-slate-200/50 rounded-2xl" />
            <div className="h-64 bg-slate-200/50 rounded-2xl" />
        </div>
    );
}

// ════════════════════════════════════════════════════════════════
// HALAMAN UTAMA — FULL SCREEN + API + WEBSOCKET
// ════════════════════════════════════════════════════════════════
export default function InvoicePage() {
    const [activeTab, setActiveTab] = useState<FrekuensiTagihan>("bulanan");
    const [filterStatus, setFilterStatus] = useState("Semua");
    const [searchQuery, setSearchQuery] = useState("");

    // ── Data dari API ──
    const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

    const fc = FREQ.find((f) => f.key === activeTab)!;

    // ── Fetch semua invoice dari API ──
    const fetchInvoices = useCallback(async () => {
        try {
            const res = await fetch(`${API}/invoice?limit=200`);
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                setAllInvoices(json.data);
                setError(null);
            } else {
                setError(json.message || "Gagal memuat data");
            }
        } catch (err) {
            setError("Tidak bisa terhubung ke server");
        } finally {
            setLoading(false);
        }
    }, []);

    // ── WebSocket: realtime updates ──
    const connectWs = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("[WS Invoice] Connected");
            if (reconnectTimer.current) {
                clearTimeout(reconnectTimer.current);
                reconnectTimer.current = null;
            }
        };

        ws.onmessage = (evt) => {
            try {
                const msg = JSON.parse(evt.data);
                if (msg.tipe !== "invoice") return;

                if (msg.event === "created") {
                    setAllInvoices((prev) => [msg.payload, ...prev]);
                } else if (msg.event === "updated") {
                    setAllInvoices((prev) =>
                        prev.map((inv) =>
                            inv.invoice_id === msg.payload.invoice_id ? msg.payload : inv
                        )
                    );
                } else if (msg.event === "deleted") {
                    setAllInvoices((prev) =>
                        prev.filter(
                            (inv) => inv.invoice_id !== msg.payload.invoice_id
                        )
                    );
                }
            } catch {
                // ignore non-JSON
            }
        };

        ws.onclose = () => {
            console.log("[WS Invoice] Disconnected — reconnecting...");
            reconnectTimer.current = setTimeout(connectWs, 3000);
        };

        ws.onerror = () => ws.close();
    }, []);

    useEffect(() => {
        fetchInvoices();
        connectWs();
        return () => {
            wsRef.current?.close();
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        };
    }, [fetchInvoices, connectWs]);

    // ── Data terfilter ──
    const filtered = useMemo(() => {
        const statusFilter =
            filterStatus === "Semua"
                ? null
                : STATUS_REVERSE[filterStatus] ?? null;
        return allInvoices.filter((inv) => {
            if (inv.frekuensi !== activeTab) return false;
            if (statusFilter && inv.status !== statusFilter) return false;
            const q = searchQuery.toLowerCase();
            if (
                q &&
                !inv.nomor_invoice.toLowerCase().includes(q) &&
                !inv.nama_pemilik.toLowerCase().includes(q) &&
                !inv.jenis_tagihan.toLowerCase().includes(q) &&
                !(inv.deskripsi ?? "").toLowerCase().includes(q)
            )
                return false;
            return true;
        });
    }, [allInvoices, activeTab, filterStatus, searchQuery]);

    // ── Statistik ──
    const st = useMemo(() => {
        const ti = allInvoices.filter((i) => i.frekuensi === activeTab);
        const total = ti.reduce((s, i) => s + i.jumlah, 0);
        const dibayar = ti.reduce((s, i) => s + i.jumlah_dibayar, 0);
        return {
            total,
            dibayar,
            lunas: ti.filter((i) => i.status === "lunas").length,
            belum: ti.filter(
                (i) => i.status === "belum_bayar" || i.status === "terlambat"
            ).length,
            terlambat: ti.filter((i) => i.status === "terlambat").length,
            count: ti.length,
            persen: total > 0 ? Math.round((dibayar / total) * 100) : 0,
        };
    }, [allInvoices, activeTab]);

    const countPerTab = useMemo(() => {
        const c: Record<FrekuensiTagihan, number> = {
            harian: 0,
            mingguan: 0,
            bulanan: 0,
            tahunan: 0,
            sekali: 0,
        };
        allInvoices.forEach((i) => c[i.frekuensi]++);
        return c;
    }, [allInvoices]);

    const alertPerTab = useMemo(() => {
        const c: Record<FrekuensiTagihan, number> = {
            harian: 0,
            mingguan: 0,
            bulanan: 0,
            tahunan: 0,
            sekali: 0,
        };
        allInvoices.forEach((i) => {
            if (i.status === "belum_bayar" || i.status === "terlambat")
                c[i.frekuensi]++;
        });
        return c;
    }, [allInvoices]);

    // ════════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════════
    return (
        <div className="flex h-screen w-full overflow-hidden">
            <Sidebar />

            <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
                <Header />

                <main
                    className={`
            flex-1 min-h-0 overflow-y-auto overflow-x-hidden
            transition-colors duration-500
            bg-gradient-to-br ${fc.light} via-white to-slate-50
          `}
                >
                    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-5 lg:px-6 xl:px-8 py-4 lg:py-6 space-y-4 lg:space-y-5">
                        {/* ══ TITLE BAR ══ */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div
                                    className={`w-10 h-10 lg:w-11 lg:h-11 rounded-2xl bg-gradient-to-br ${fc.grad} flex items-center justify-center text-lg lg:text-xl shadow-lg transition-all duration-500`}
                                >
                                    {fc.icon}
                                </div>
                                <div>
                                    <h1 className="text-base sm:text-lg lg:text-xl font-extrabold text-slate-900 tracking-tight">
                                        Manajemen Tagihan
                                    </h1>
                                    <p className="text-[10px] lg:text-[11px] text-slate-400 mt-0.5">
                                        Kelola invoice berdasarkan frekuensi pembayaran
                                    </p>
                                </div>
                            </div>
                            <Link
                                href="/dashboard/keuangan/invoice/tambahinvoice"
                                className={`
                  inline-flex items-center justify-center gap-2
                  bg-gradient-to-r ${fc.grad} hover:opacity-90
                  text-white text-sm font-bold px-5 py-2.5 rounded-xl
                  transition-all shadow-lg hover:shadow-xl active:scale-[0.97]
                `}
                            >
                                <svg
                                    width="15"
                                    height="15"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M12 4.5v15m7.5-7.5h-15"
                                    />
                                </svg>
                                <span className="hidden sm:inline">Buat Invoice</span>
                                <span className="sm:hidden">Buat</span>
                            </Link>
                        </div>

                        {/* ══ FREQUENCY TABS ══ */}
                        <div className="flex gap-2 lg:gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                            {FREQ.map((tab) => {
                                const active = activeTab === tab.key;
                                const alert = alertPerTab[tab.key];
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => {
                                            setActiveTab(tab.key);
                                            setFilterStatus("Semua");
                                            setSearchQuery("");
                                        }}
                                        className={`
                      relative flex items-center gap-2 lg:gap-3
                      px-3 lg:px-5 py-3 lg:py-4 rounded-2xl border-2
                      transition-all duration-300
                      min-w-[110px] lg:min-w-[155px] text-left shrink-0
                      ${active
                                                ? `bg-gradient-to-br ${tab.light} ${tab.border} shadow-lg ${tab.ring} ring-4`
                                                : "bg-white/80 backdrop-blur border-slate-200/60 hover:border-slate-300 hover:shadow-md"
                                            }
                    `}
                                    >
                                        <div
                                            className={`
                        w-8 h-8 lg:w-10 lg:h-10 rounded-xl
                        flex items-center justify-center text-base lg:text-lg
                        transition-all duration-300
                        ${active
                                                    ? `bg-gradient-to-br ${tab.grad} shadow-md text-white`
                                                    : "bg-slate-100 grayscale"
                                                }
                      `}
                                        >
                                            {tab.icon}
                                        </div>
                                        <div>
                                            <p
                                                className={`text-xs lg:text-sm font-extrabold transition-colors ${active ? tab.text : "text-slate-600"
                                                    }`}
                                            >
                                                {tab.label}
                                            </p>
                                            <p
                                                className={`text-[9px] lg:text-[10px] font-medium ${active
                                                    ? `${tab.text} opacity-60`
                                                    : "text-slate-400"
                                                    }`}
                                            >
                                                {countPerTab[tab.key]} tagihan
                                            </p>
                                        </div>
                                        {alert > 0 && (
                                            <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-br from-rose-500 to-red-600 text-white text-[9px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-lg">
                                                {alert}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* ══ LOADING / ERROR ══ */}
                        {loading && <LoadingSkeleton />}

                        {error && (
                            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-500 text-lg shrink-0">
                                    !
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-rose-700">{error}</p>
                                    <p className="text-[11px] text-rose-400 mt-0.5">
                                        Pastikan backend berjalan di {API_BASE}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setLoading(true);
                                        setError(null);
                                        fetchInvoices();
                                    }}
                                    className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition-colors shrink-0"
                                >
                                    Retry
                                </button>
                            </div>
                        )}

                        {!loading && !error && (
                            <>
                                {/* ══ STAT CARDS ══ */}
                                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
                                    <div
                                        className="col-span-2 xl:col-span-1 relative overflow-hidden rounded-2xl p-4 lg:p-5 text-white shadow-xl"
                                        style={{
                                            background: `linear-gradient(135deg, ${fc.accent}, ${fc.accent}dd)`,
                                        }}
                                    >
                                        <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/10 -translate-y-8 translate-x-8" />
                                        <div className="absolute bottom-0 left-0 w-14 h-14 rounded-full bg-white/5 translate-y-6 -translate-x-6" />
                                        <p className="text-[10px] lg:text-xs font-bold uppercase tracking-widest opacity-70 mb-1">
                                            Total Tagihan
                                        </p>
                                        <p className="text-xl lg:text-2xl font-extrabold tracking-tight">
                                            {formatRupiah(st.total)}
                                        </p>
                                        <p className="text-[10px] lg:text-[11px] opacity-60 mt-1">
                                            {st.count} invoice
                                        </p>
                                    </div>

                                    <div className="bg-white rounded-2xl border border-slate-200/60 p-4 lg:p-5 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                                    Terbayar
                                                </p>
                                                <p className="text-xl lg:text-2xl font-extrabold text-slate-800">
                                                    {st.persen}%
                                                </p>
                                                <p className="text-[10px] lg:text-[11px] text-emerald-600 font-semibold mt-1">
                                                    {formatRupiah(st.dibayar)}
                                                </p>
                                            </div>
                                            <CircleProgress persen={st.persen} accent={fc.accent} />
                                        </div>
                                    </div>

                                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200/60 p-4 lg:p-5 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-sm font-extrabold shadow-md">
                                                {st.belum}
                                            </div>
                                            <div>
                                                <p className="text-[9px] lg:text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                                                    Belum Bayar
                                                </p>
                                                <p className="text-base lg:text-lg font-extrabold text-amber-800">
                                                    {st.belum} Invoice
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gradient-to-br from-rose-50 to-red-50 rounded-2xl border border-rose-200/60 p-4 lg:p-5 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={`w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white text-sm font-extrabold shadow-md ${st.terlambat > 0 ? "animate-pulse" : ""
                                                    }`}
                                            >
                                                {st.terlambat}
                                            </div>
                                            <div>
                                                <p className="text-[9px] lg:text-[10px] font-bold text-rose-500 uppercase tracking-widest">
                                                    Terlambat
                                                </p>
                                                <p className="text-base lg:text-lg font-extrabold text-rose-800">
                                                    {st.terlambat} Invoice
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ══ PROGRESS BAR ══ */}
                                <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200/60 p-4 lg:p-5 shadow-sm">
                                    <div className="flex items-center justify-between mb-2 lg:mb-3">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className={`w-3 h-3 rounded-full bg-gradient-to-r ${fc.grad}`}
                                            />
                                            <p className="text-xs font-bold text-slate-600">
                                                Progress — {fc.label}
                                            </p>
                                        </div>
                                        <p className="text-[11px] lg:text-xs font-extrabold text-slate-800">
                                            {formatRupiah(st.dibayar)}{" "}
                                            <span className="text-slate-300 font-normal">/</span>{" "}
                                            {formatRupiah(st.total)}
                                        </p>
                                    </div>
                                    <div className="w-full h-2.5 lg:h-3 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full bg-gradient-to-r ${fc.grad} transition-all duration-700 ease-out shadow-sm`}
                                            style={{ width: `${st.persen}%` }}
                                        />
                                    </div>
                                </div>

                                {/* ══ SEARCH & FILTER ══ */}
                                <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200/60 p-3 lg:p-4 shadow-sm">
                                    <div className="flex flex-col sm:flex-row gap-2 lg:gap-3">
                                        <div className="relative flex-1">
                                            <svg
                                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
                                                width="15"
                                                height="15"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                                                />
                                            </svg>
                                            <input
                                                type="text"
                                                placeholder={`Cari di tagihan ${fc.label.toLowerCase()}...`}
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400/40 transition-all"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1 lg:gap-1.5 overflow-x-auto scrollbar-hide">
                                            {[
                                                "Semua",
                                                "Belum Bayar",
                                                "Lunas",
                                                "Sebagian",
                                                "Terlambat",
                                            ].map((s) => (
                                                <button
                                                    key={s}
                                                    onClick={() => setFilterStatus(s)}
                                                    className={`whitespace-nowrap px-3 lg:px-4 py-2 rounded-xl text-[11px] lg:text-xs font-bold transition-all duration-200 ${filterStatus === s
                                                        ? `bg-gradient-to-r ${fc.grad} text-white shadow-md`
                                                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                                        }`}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* ══ TABLE ══ */}
                                <div className="bg-white/90 backdrop-blur rounded-2xl border border-slate-200/60 overflow-hidden shadow-lg">
                                    <div
                                        className={`px-4 lg:px-5 py-3 lg:py-3.5 flex items-center gap-3 bg-gradient-to-r ${fc.light} border-b border-slate-100`}
                                    >
                                        <div
                                            className={`w-7 h-7 lg:w-8 lg:h-8 rounded-lg bg-gradient-to-br ${fc.grad} flex items-center justify-center text-sm shadow-sm`}
                                        >
                                            {fc.icon}
                                        </div>
                                        <div>
                                            <h2 className={`text-sm font-extrabold ${fc.text}`}>
                                                Tagihan {fc.label}
                                            </h2>
                                            <p
                                                className={`text-[9px] lg:text-[10px] ${fc.text} opacity-50 font-medium`}
                                            >
                                                {filtered.length} records
                                            </p>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table
                                            className="w-full text-sm"
                                            style={{ minWidth: 820 }}
                                        >
                                            <thead>
                                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                                    {[
                                                        "Invoice",
                                                        "Jenis",
                                                        "Pemilik",
                                                        "Periode",
                                                        "Jumlah",
                                                        "Progress",
                                                        "Tempo",
                                                        "Status",
                                                        "Rem.",
                                                        "Aksi",
                                                    ].map((h, i) => (
                                                        <th
                                                            key={i}
                                                            className={`py-2.5 lg:py-3 px-3 lg:px-4 font-bold text-slate-400 text-[10px] uppercase tracking-wider ${h === "Jumlah"
                                                                ? "text-right"
                                                                : h === "Rem." || h === "Aksi"
                                                                    ? "text-center"
                                                                    : "text-left"
                                                                }`}
                                                        >
                                                            {h}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {filtered.length === 0 ? (
                                                    <tr>
                                                        <td
                                                            colSpan={10}
                                                            className="py-16 lg:py-20 text-center"
                                                        >
                                                            <div
                                                                className={`w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-gradient-to-br ${fc.light} mx-auto flex items-center justify-center text-2xl lg:text-3xl mb-3 opacity-60`}
                                                            >
                                                                {fc.icon}
                                                            </div>
                                                            <p className="text-slate-400 font-bold text-sm">
                                                                Tidak ada tagihan{" "}
                                                                {fc.label.toLowerCase()}
                                                            </p>
                                                            <p className="text-slate-300 text-xs mt-1">
                                                                Ubah filter atau buat invoice baru
                                                            </p>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filtered.map((inv) => {
                                                        const persen = hitungProgress(
                                                            inv.jumlah_dibayar,
                                                            inv.jumlah
                                                        );
                                                        return (
                                                            <tr
                                                                key={inv.invoice_id}
                                                                className="hover:bg-slate-50/80 transition-all duration-200 group"
                                                            >
                                                                <td className="py-3 lg:py-3.5 px-3 lg:px-4">
                                                                    <span className="font-mono text-[11px] font-extrabold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                                                        {inv.nomor_invoice}
                                                                    </span>
                                                                </td>
                                                                <td className="py-3 lg:py-3.5 px-3 lg:px-4">
                                                                    <span
                                                                        className={`text-[11px] ${fc.pill} px-2 py-0.5 rounded-lg font-bold`}
                                                                    >
                                                                        {inv.jenis_tagihan}
                                                                    </span>
                                                                </td>
                                                                <td className="py-3 lg:py-3.5 px-3 lg:px-4">
                                                                    <p className="font-bold text-slate-700 text-sm">
                                                                        {inv.nama_pemilik}
                                                                    </p>
                                                                    <p className="text-[10px] text-slate-400 truncate max-w-[120px] lg:max-w-[180px]">
                                                                        {inv.deskripsi ?? "-"}
                                                                    </p>
                                                                </td>
                                                                <td className="py-3 lg:py-3.5 px-3 lg:px-4 text-[11px] text-slate-500 font-medium">
                                                                    {inv.periode ?? "-"}
                                                                </td>
                                                                <td className="py-3 lg:py-3.5 px-3 lg:px-4 text-right font-extrabold text-slate-800">
                                                                    {formatRupiah(inv.jumlah)}
                                                                </td>
                                                                <td className="py-3 lg:py-3.5 px-3 lg:px-4 w-28 lg:w-32">
                                                                    {inv.status === "lunas" ? (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
                                                                                <svg
                                                                                    width="10"
                                                                                    height="10"
                                                                                    fill="none"
                                                                                    viewBox="0 0 24 24"
                                                                                    stroke="white"
                                                                                    strokeWidth={3}
                                                                                >
                                                                                    <path
                                                                                        strokeLinecap="round"
                                                                                        strokeLinejoin="round"
                                                                                        d="M4.5 12.75l6 6 9-13.5"
                                                                                    />
                                                                                </svg>
                                                                            </div>
                                                                            <span className="text-[11px] font-extrabold text-emerald-600">
                                                                                Lunas
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="space-y-1">
                                                                            <BarProgress
                                                                                persen={persen}
                                                                                colorClass={fc.barColor}
                                                                            />
                                                                            <p className="text-[9px] text-slate-400 font-medium">
                                                                                {formatRupiah(inv.jumlah_dibayar)} (
                                                                                {persen}%)
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="py-3 lg:py-3.5 px-3 lg:px-4">
                                                                    <span
                                                                        className={`text-[11px] font-semibold ${inv.status === "terlambat"
                                                                            ? "text-rose-500"
                                                                            : "text-slate-500"
                                                                            }`}
                                                                    >
                                                                        {formatTanggal(inv.jatuh_tempo)}
                                                                    </span>
                                                                </td>
                                                                <td className="py-3 lg:py-3.5 px-3 lg:px-4">
                                                                    <StatusBadge status={inv.status} />
                                                                </td>
                                                                <td className="py-3 lg:py-3.5 px-3 lg:px-4 text-center">
                                                                    {inv.reminder_aktif ? (
                                                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                                                                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                                                            On
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[10px] text-slate-300">
                                                                            Off
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                {/* ── Aksi: Bayar ── */}
                                                                <td className="py-3 lg:py-3.5 px-3 lg:px-4 text-center">
                                                                    {inv.status !== "lunas" &&
                                                                        inv.status !== "batal" ? (
                                                                        <Link
                                                                            href={`/dashboard/keuangan/invoice/bayarinvoice/${inv.invoice_id}`}
                                                                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-extrabold text-white bg-gradient-to-r ${fc.grad} shadow-sm hover:opacity-90 hover:shadow-md transition-all active:scale-95`}
                                                                        >
                                                                            <svg
                                                                                width="11"
                                                                                height="11"
                                                                                fill="none"
                                                                                viewBox="0 0 24 24"
                                                                                stroke="currentColor"
                                                                                strokeWidth={2.5}
                                                                            >
                                                                                <path
                                                                                    strokeLinecap="round"
                                                                                    strokeLinejoin="round"
                                                                                    d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
                                                                                />
                                                                            </svg>
                                                                            Bayar
                                                                        </Link>
                                                                    ) : inv.status === "lunas" ? (
                                                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-500">
                                                                            <svg
                                                                                width="10"
                                                                                height="10"
                                                                                fill="none"
                                                                                viewBox="0 0 24 24"
                                                                                stroke="currentColor"
                                                                                strokeWidth={3}
                                                                            >
                                                                                <path
                                                                                    strokeLinecap="round"
                                                                                    strokeLinejoin="round"
                                                                                    d="M4.5 12.75l6 6 9-13.5"
                                                                                />
                                                                            </svg>
                                                                            Sudah Dibayar
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[9px] text-slate-300">
                                                                            —
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="px-4 lg:px-5 py-2.5 lg:py-3 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
                                        <p className="text-[11px] text-slate-400">
                                            <span className="font-bold text-slate-600">
                                                {filtered.length}
                                            </span>{" "}
                                            tagihan {fc.label.toLowerCase()}
                                        </p>
                                        <button
                                            className={`text-[11px] font-bold ${fc.text} hover:underline`}
                                        >
                                            Lihat Semua
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </main>

                <Footer />
            </div>

            <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
        </div>
    );
}