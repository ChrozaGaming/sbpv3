"use client";

import { useState, useEffect, useCallback, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { v4 as uuidv4 } from "uuid";

// ════════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════════
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const API = `${API_BASE}/api`;

// ════════════════════════════════════════════════════════════════
// TIPE DATA
// ════════════════════════════════════════════════════════════════
type StatusDB =
    | "belum_bayar"
    | "lunas"
    | "sebagian"
    | "terlambat"
    | "batal";

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
    reminder_aktif: boolean;
    catatan: string | null;
    created_at: string;
    updated_at: string;
}

interface Pembayaran {
    pembayaran_id: string;
    invoice_id: string;
    nominal: number;
    sisa_setelah_bayar: number;
    metode_bayar: string;
    referensi: string | null;
    bukti_url: string | null;
    dibayar_oleh: string | null;
    tanggal_bayar: string;
    catatan: string | null;
    created_at: string;
}

// ════════════════════════════════════════════════════════════════
// CONFIG PER FREKUENSI
// ════════════════════════════════════════════════════════════════
interface FreqCfg {
    icon: string;
    label: string;
    grad: string;
    light: string;
    text: string;
    border: string;
    accent: string;
}

const FREQ_MAP: Record<FrekuensiTagihan, FreqCfg> = {
    bulanan: {
        icon: "📅",
        label: "Bulanan",
        grad: "from-blue-500 to-indigo-600",
        light: "from-blue-50 to-indigo-50",
        text: "text-blue-700",
        border: "border-blue-300",
        accent: "#4f46e5",
    },
    mingguan: {
        icon: "🔁",
        label: "Mingguan",
        grad: "from-violet-500 to-purple-600",
        light: "from-violet-50 to-purple-50",
        text: "text-violet-700",
        border: "border-violet-300",
        accent: "#7c3aed",
    },
    harian: {
        icon: "⚡",
        label: "Harian",
        grad: "from-amber-400 to-orange-500",
        light: "from-amber-50 to-orange-50",
        text: "text-amber-700",
        border: "border-amber-300",
        accent: "#d97706",
    },
    tahunan: {
        icon: "📆",
        label: "Tahunan",
        grad: "from-emerald-500 to-teal-600",
        light: "from-emerald-50 to-teal-50",
        text: "text-emerald-700",
        border: "border-emerald-300",
        accent: "#059669",
    },
    sekali: {
        icon: "🎯",
        label: "Sekali Bayar",
        grad: "from-rose-500 to-pink-600",
        light: "from-rose-50 to-pink-50",
        text: "text-rose-700",
        border: "border-rose-300",
        accent: "#e11d48",
    },
};

// ════════════════════════════════════════════════════════════════
// STATUS MAP
// ════════════════════════════════════════════════════════════════
const STATUS_DISPLAY: Record<StatusDB, string> = {
    belum_bayar: "Belum Bayar",
    lunas: "Lunas",
    sebagian: "Sebagian",
    terlambat: "Terlambat",
    batal: "Batal",
};

const STATUS_COLOR: Record<
    StatusDB,
    { bg: string; text: string; dot: string }
> = {
    belum_bayar: {
        bg: "bg-amber-50 border-amber-200",
        text: "text-amber-700",
        dot: "bg-amber-400",
    },
    lunas: {
        bg: "bg-emerald-50 border-emerald-200",
        text: "text-emerald-700",
        dot: "bg-emerald-400",
    },
    sebagian: {
        bg: "bg-sky-50 border-sky-200",
        text: "text-sky-700",
        dot: "bg-sky-400",
    },
    terlambat: {
        bg: "bg-rose-50 border-rose-200",
        text: "text-rose-700",
        dot: "bg-rose-500",
    },
    batal: {
        bg: "bg-neutral-100 border-neutral-300",
        text: "text-neutral-500",
        dot: "bg-neutral-400",
    },
};

const METODE_OPTIONS = [
    { value: "tunai", label: "Tunai", icon: "💵" },
    { value: "transfer", label: "Transfer Bank", icon: "🏦" },
    { value: "qris", label: "QRIS", icon: "📱" },
    { value: "potong_gaji", label: "Potong Gaji", icon: "💼" },
    { value: "lainnya", label: "Lainnya", icon: "📋" },
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

function displayRupiah(v: string): string {
    const n = parseInt(v);
    return isNaN(n) ? "" : new Intl.NumberFormat("id-ID").format(n);
}

function formatTanggal(t: string): string {
    return new Date(t).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function formatWaktu(t: string): string {
    return new Date(t).toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

const ic =
    "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400/30 transition-all";

// ════════════════════════════════════════════════════════════════
// HALAMAN BAYAR INVOICE
// ════════════════════════════════════════════════════════════════
export default function BayarInvoicePage({
    params,
}: {
    params: Promise<{ invoiceId: string }>;
}) {
    const { invoiceId } = use(params);
    const router = useRouter();

    // State
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [riwayat, setRiwayat] = useState<Pembayaran[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Form
    const [nominal, setNominal] = useState("");
    const [metodeBayar, setMetodeBayar] = useState("tunai");
    const [referensi, setReferensi] = useState("");
    const [dibayarOleh, setDibayarOleh] = useState("");
    const [tanggalBayar, setTanggalBayar] = useState(
        new Date().toISOString().split("T")[0]
    );
    const [catatan, setCatatan] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{
        type: "success" | "error";
        msg: string;
    } | null>(null);

    // Derived
    const sisa = invoice ? invoice.jumlah - invoice.jumlah_dibayar : 0;
    const nominalNum = parseInt(nominal) || 0;
    const isLunas = invoice?.status === "lunas";
    const isBatal = invoice?.status === "batal";
    const canPay = !isLunas && !isBatal && sisa > 0;
    const fCfg = invoice ? FREQ_MAP[invoice.frekuensi] : FREQ_MAP.bulanan;
    const persen = invoice && invoice.jumlah > 0
        ? Math.round((invoice.jumlah_dibayar / invoice.jumlah) * 100)
        : 0;

    // ── Fetch invoice + riwayat ──
    const fetchData = useCallback(async () => {
        if (!invoiceId) {
            setError("ID Invoice tidak ditemukan di URL");
            setLoading(false);
            return;
        }
        try {
            const [invRes, riwRes] = await Promise.all([
                fetch(`${API}/invoice/${invoiceId}`),
                fetch(`${API}/invoice/${invoiceId}/pembayaran?limit=100`),
            ]);
            const invJson = await invRes.json();
            const riwJson = await riwRes.json();

            if (invJson.success) {
                setInvoice(invJson.data);
            } else {
                setError(invJson.message || "Invoice tidak ditemukan");
            }
            if (riwJson.success && Array.isArray(riwJson.data)) {
                setRiwayat(riwJson.data);
            }
        } catch {
            setError("Tidak bisa terhubung ke server");
        } finally {
            setLoading(false);
        }
    }, [invoiceId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ── Bayar Lunas (isi otomatis sisa) ──
    const bayarLunas = () => {
        setNominal(sisa.toString());
    };

    // ── Submit pembayaran ──
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting || !invoice || !canPay) return;

        if (nominalNum <= 0) {
            setToast({ type: "error", msg: "Nominal harus lebih dari 0" });
            setTimeout(() => setToast(null), 3000);
            return;
        }

        setSubmitting(true);
        setToast(null);

        const payload = {
            pembayaran_id: uuidv4(),
            nominal: Math.min(nominalNum, sisa),
            metode_bayar: metodeBayar,
            referensi: referensi.trim() || null,
            bukti_url: null,
            dibayar_oleh: dibayarOleh.trim() || null,
            tanggal_bayar: tanggalBayar || null,
            catatan: catatan.trim() || null,
        };

        try {
            const res = await fetch(
                `${API}/invoice/${invoice.invoice_id}/pembayaran`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }
            );
            const json = await res.json();

            if (json.success) {
                setToast({ type: "success", msg: "Pembayaran berhasil dicatat!" });
                // Update local state
                if (json.data?.invoice) setInvoice(json.data.invoice);
                if (json.data?.pembayaran)
                    setRiwayat((prev) => [json.data.pembayaran, ...prev]);
                // Reset form
                setNominal("");
                setReferensi("");
                setCatatan("");
                setDibayarOleh("");
                setTimeout(() => setToast(null), 3000);
            } else {
                setToast({
                    type: "error",
                    msg: json.message || "Gagal memproses pembayaran",
                });
                setTimeout(() => setToast(null), 4000);
            }
        } catch {
            setToast({ type: "error", msg: "Tidak bisa terhubung ke server" });
            setTimeout(() => setToast(null), 4000);
        } finally {
            setSubmitting(false);
        }
    };

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
            bg-gradient-to-br ${fCfg.light} via-white to-slate-50
          `}
                >
                    {/* Toast */}
                    {toast && (
                        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce">
                            <div
                                className={`${toast.type === "success"
                                        ? `bg-gradient-to-r ${fCfg.grad}`
                                        : "bg-gradient-to-r from-rose-500 to-red-600"
                                    } text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-extrabold flex items-center gap-2`}
                            >
                                {toast.type === "success" ? (
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                ) : (
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                )}
                                {toast.msg}
                            </div>
                        </div>
                    )}

                    <div className="w-full max-w-4xl mx-auto px-4 sm:px-5 lg:px-6 xl:px-8 py-4 lg:py-6 space-y-4 lg:space-y-5">
                        {/* ══ TITLE BAR ══ */}
                        <div className="flex items-center gap-3">
                            <Link
                                href="/dashboard/keuangan/invoice"
                                className="p-2 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                                </svg>
                            </Link>
                            <div className="flex-1 min-w-0">
                                <h1 className="text-base sm:text-lg lg:text-xl font-extrabold text-slate-900 tracking-tight">
                                    Bayar Invoice
                                </h1>
                                <p className="text-[10px] lg:text-[11px] text-slate-400 mt-0.5">
                                    Catat pembayaran cicil atau lunas
                                </p>
                            </div>
                        </div>

                        {/* ══ LOADING ══ */}
                        {loading && (
                            <div className="space-y-4 animate-pulse">
                                <div className="h-40 bg-slate-200/50 rounded-2xl" />
                                <div className="h-60 bg-slate-200/50 rounded-2xl" />
                            </div>
                        )}

                        {/* ══ ERROR ══ */}
                        {error && !loading && (
                            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-center">
                                <p className="text-rose-600 font-bold text-sm">{error}</p>
                                <Link
                                    href="/dashboard/keuangan/invoice"
                                    className="inline-block mt-3 px-5 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition-colors"
                                >
                                    Kembali ke Daftar
                                </Link>
                            </div>
                        )}

                        {/* ══ KONTEN UTAMA ══ */}
                        {invoice && !loading && (
                            <>
                                {/* ─── INFO CARD ─── */}
                                <div className="bg-white/90 backdrop-blur rounded-2xl border border-slate-200/60 overflow-hidden shadow-lg">
                                    <div className={`h-2 bg-gradient-to-r ${fCfg.grad}`} />
                                    <div className="p-4 lg:p-6">
                                        {/* Header */}
                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${fCfg.grad} flex items-center justify-center text-xl shadow-lg`}
                                                >
                                                    {fCfg.icon}
                                                </div>
                                                <div>
                                                    <p className="font-mono text-xs font-extrabold text-slate-500 bg-slate-100 inline-block px-2 py-0.5 rounded-md">
                                                        {invoice.nomor_invoice}
                                                    </p>
                                                    <h2 className="text-base lg:text-lg font-extrabold text-slate-900 mt-0.5">
                                                        {invoice.jenis_tagihan}
                                                    </h2>
                                                    <p className="text-[11px] text-slate-400">
                                                        {invoice.nama_pemilik}
                                                        {invoice.periode ? ` — ${invoice.periode}` : ""}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border ${STATUS_COLOR[invoice.status].bg} ${STATUS_COLOR[invoice.status].text}`}>
                                                <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[invoice.status].dot} ${invoice.status === "terlambat" ? "animate-pulse" : ""}`} />
                                                {STATUS_DISPLAY[invoice.status]}
                                            </div>
                                        </div>

                                        {/* Angka */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
                                            {/* Total */}
                                            <div className="bg-slate-50 rounded-xl p-3 lg:p-4 border border-slate-100">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                                    Total Tagihan
                                                </p>
                                                <p className="text-lg lg:text-xl font-extrabold text-slate-800">
                                                    {formatRupiah(invoice.jumlah)}
                                                </p>
                                            </div>
                                            {/* Terbayar */}
                                            <div className="bg-emerald-50 rounded-xl p-3 lg:p-4 border border-emerald-100">
                                                <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mb-1">
                                                    Sudah Dibayar
                                                </p>
                                                <p className="text-lg lg:text-xl font-extrabold text-emerald-700">
                                                    {formatRupiah(invoice.jumlah_dibayar)}
                                                </p>
                                            </div>
                                            {/* Sisa */}
                                            <div
                                                className={`rounded-xl p-3 lg:p-4 border ${sisa > 0
                                                        ? "bg-amber-50 border-amber-100"
                                                        : "bg-emerald-50 border-emerald-100"
                                                    }`}
                                            >
                                                <p
                                                    className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${sisa > 0 ? "text-amber-500" : "text-emerald-500"
                                                        }`}
                                                >
                                                    Sisa Tagihan
                                                </p>
                                                <p
                                                    className={`text-lg lg:text-xl font-extrabold ${sisa > 0 ? "text-amber-700" : "text-emerald-700"
                                                        }`}
                                                >
                                                    {formatRupiah(sisa)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="mt-4">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <p className="text-[11px] font-bold text-slate-500">
                                                    Progress Pembayaran
                                                </p>
                                                <p className="text-[11px] font-extrabold text-slate-700">
                                                    {persen}%
                                                </p>
                                            </div>
                                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ease-out ${persen >= 100
                                                            ? "bg-gradient-to-r from-emerald-400 to-green-500"
                                                            : `bg-gradient-to-r ${fCfg.grad}`
                                                        }`}
                                                    style={{ width: `${Math.min(persen, 100)}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Info tambahan */}
                                        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-slate-400">
                                            <span>
                                                Jatuh tempo:{" "}
                                                <strong className={`${invoice.status === "terlambat" ? "text-rose-500" : "text-slate-600"}`}>
                                                    {formatTanggal(invoice.jatuh_tempo)}
                                                </strong>
                                            </span>
                                            {invoice.kontak_hp && (
                                                <span>
                                                    HP: <strong className="text-slate-600">{invoice.kontak_hp}</strong>
                                                </span>
                                            )}
                                            {invoice.deskripsi && (
                                                <span>
                                                    Ket: <strong className="text-slate-600">{invoice.deskripsi}</strong>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* ─── FORM BAYAR ─── */}
                                {canPay ? (
                                    <form
                                        onSubmit={handleSubmit}
                                        className="bg-white/90 backdrop-blur rounded-2xl border border-slate-200/60 overflow-hidden shadow-lg"
                                    >
                                        <div className={`h-1.5 bg-gradient-to-r ${fCfg.grad}`} />
                                        <div className="p-4 lg:p-6 space-y-4 lg:space-y-5">
                                            <div>
                                                <h3 className="text-sm font-extrabold text-slate-800">
                                                    Catat Pembayaran
                                                </h3>
                                                <p className="text-[11px] text-slate-400 mt-0.5">
                                                    Bayar sebagian (cicil) atau langsung lunas
                                                </p>
                                            </div>

                                            {/* Nominal */}
                                            <div>
                                                <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                                    Nominal Bayar <span className="text-rose-400">*</span>
                                                </label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-slate-400">
                                                        Rp
                                                    </span>
                                                    <input
                                                        type="text"
                                                        className={`${ic} pl-12 text-xl font-extrabold`}
                                                        placeholder="0"
                                                        value={nominal ? displayRupiah(nominal) : ""}
                                                        onChange={(e) =>
                                                            setNominal(e.target.value.replace(/[^0-9]/g, ""))
                                                        }
                                                        required
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2 mt-2">
                                                    {nominalNum > 0 && (
                                                        <p className={`text-xs font-bold ${fCfg.text}`}>
                                                            = Rp {displayRupiah(nominal)}
                                                        </p>
                                                    )}
                                                    {nominalNum > sisa && (
                                                        <p className="text-xs text-amber-500 font-semibold">
                                                            (maks {formatRupiah(sisa)}, otomatis di-clamp)
                                                        </p>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={bayarLunas}
                                                        className={`ml-auto text-[11px] font-extrabold px-3 py-1.5 rounded-lg bg-gradient-to-r ${fCfg.grad} text-white shadow-md hover:opacity-90 transition-all active:scale-95`}
                                                    >
                                                        Bayar Lunas ({formatRupiah(sisa)})
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Metode Bayar */}
                                            <div>
                                                <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                                    Metode Bayar <span className="text-rose-400">*</span>
                                                </label>
                                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                                    {METODE_OPTIONS.map((m) => (
                                                        <button
                                                            key={m.value}
                                                            type="button"
                                                            onClick={() => setMetodeBayar(m.value)}
                                                            className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border-2 transition-all duration-200 text-center ${metodeBayar === m.value
                                                                    ? `bg-gradient-to-b ${fCfg.light} ${fCfg.border} shadow-md ring-2 ring-offset-1 ${fCfg.text}`
                                                                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                                                                }`}
                                                        >
                                                            <span className="text-base">{m.icon}</span>
                                                            <span className="text-[9px] font-extrabold leading-tight">
                                                                {m.label}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Detail */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                                        Tanggal Bayar
                                                    </label>
                                                    <input
                                                        type="date"
                                                        className={ic}
                                                        value={tanggalBayar}
                                                        onChange={(e) => setTanggalBayar(e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                                        Dibayar Oleh
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className={ic}
                                                        placeholder="Nama pembayar"
                                                        value={dibayarOleh}
                                                        onChange={(e) => setDibayarOleh(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                                    No Referensi / Kwitansi
                                                </label>
                                                <input
                                                    type="text"
                                                    className={ic}
                                                    placeholder="No transfer, kwitansi, dsb"
                                                    value={referensi}
                                                    onChange={(e) => setReferensi(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                                    Catatan
                                                </label>
                                                <textarea
                                                    className={`${ic} resize-none`}
                                                    rows={2}
                                                    placeholder="Catatan opsional..."
                                                    value={catatan}
                                                    onChange={(e) => setCatatan(e.target.value)}
                                                />
                                            </div>

                                            {/* Tombol */}
                                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                                <button
                                                    type="submit"
                                                    disabled={submitting || nominalNum <= 0}
                                                    className={`flex-1 px-6 py-3 rounded-xl text-sm font-extrabold text-white bg-gradient-to-r ${fCfg.grad} hover:opacity-90 shadow-lg hover:shadow-xl transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed`}
                                                >
                                                    {submitting ? (
                                                        <span className="flex items-center justify-center gap-2">
                                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                                                                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
                                                            </svg>
                                                            Memproses...
                                                        </span>
                                                    ) : nominalNum >= sisa ? (
                                                        "Bayar Lunas"
                                                    ) : (
                                                        "Bayar Cicilan"
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </form>
                                ) : (
                                    /* Sudah lunas banner */
                                    <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl border border-emerald-200/60 p-5 lg:p-6 text-center shadow-sm">
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-500 mx-auto flex items-center justify-center mb-3 shadow-lg">
                                            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                            </svg>
                                        </div>
                                        <p className="text-lg font-extrabold text-emerald-800">
                                            {isLunas ? "Invoice Sudah Lunas" : "Tidak Dapat Dibayar"}
                                        </p>
                                        <p className="text-sm text-emerald-600 mt-1">
                                            {isLunas
                                                ? "Seluruh tagihan telah dibayarkan"
                                                : `Status invoice: ${STATUS_DISPLAY[invoice.status]}`}
                                        </p>
                                    </div>
                                )}

                                {/* ─── RIWAYAT PEMBAYARAN ─── */}
                                <div className="bg-white/90 backdrop-blur rounded-2xl border border-slate-200/60 overflow-hidden shadow-lg">
                                    <div className="px-4 lg:px-5 py-3 lg:py-3.5 border-b border-slate-100 bg-slate-50/50">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-extrabold text-slate-700">
                                                Riwayat Pembayaran
                                            </h3>
                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
                                                {riwayat.length} transaksi
                                            </span>
                                        </div>
                                    </div>

                                    {riwayat.length === 0 ? (
                                        <div className="py-12 text-center">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-100 mx-auto flex items-center justify-center text-xl mb-3 opacity-50">
                                                💳
                                            </div>
                                            <p className="text-slate-400 font-bold text-sm">
                                                Belum ada pembayaran
                                            </p>
                                            <p className="text-slate-300 text-xs mt-1">
                                                Catat pembayaran pertama di form atas
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-50">
                                            {riwayat.map((p, idx) => {
                                                const metodeLabel =
                                                    METODE_OPTIONS.find((m) => m.value === p.metode_bayar)?.label ??
                                                    p.metode_bayar;
                                                const metodeIcon =
                                                    METODE_OPTIONS.find((m) => m.value === p.metode_bayar)?.icon ?? "💳";
                                                return (
                                                    <div
                                                        key={p.pembayaran_id}
                                                        className="px-4 lg:px-5 py-3 lg:py-4 hover:bg-slate-50/50 transition-colors"
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            {/* Nomor urut */}
                                                            <div
                                                                className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-extrabold shrink-0 ${p.sisa_setelah_bayar <= 0
                                                                        ? "bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-md"
                                                                        : "bg-slate-100 text-slate-500"
                                                                    }`}
                                                            >
                                                                {riwayat.length - idx}
                                                            </div>
                                                            {/* Detail */}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <p className="text-sm font-extrabold text-slate-800">
                                                                        {formatRupiah(p.nominal)}
                                                                    </p>
                                                                    <span className="text-[10px] text-slate-400 shrink-0">
                                                                        {formatTanggal(p.tanggal_bayar)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-400">
                                                                    <span className="inline-flex items-center gap-1 font-semibold">
                                                                        {metodeIcon} {metodeLabel}
                                                                    </span>
                                                                    {p.dibayar_oleh && (
                                                                        <span>
                                                                            oleh{" "}
                                                                            <strong className="text-slate-600">
                                                                                {p.dibayar_oleh}
                                                                            </strong>
                                                                        </span>
                                                                    )}
                                                                    {p.referensi && (
                                                                        <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">
                                                                            #{p.referensi}
                                                                        </span>
                                                                    )}
                                                                    <span>
                                                                        Sisa:{" "}
                                                                        <strong
                                                                            className={
                                                                                p.sisa_setelah_bayar <= 0
                                                                                    ? "text-emerald-600"
                                                                                    : "text-amber-600"
                                                                            }
                                                                        >
                                                                            {formatRupiah(p.sisa_setelah_bayar)}
                                                                        </strong>
                                                                    </span>
                                                                </div>
                                                                {p.catatan && (
                                                                    <p className="text-[10px] text-slate-300 mt-1 italic">
                                                                        {p.catatan}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Tombol kembali */}
                                <div className="pb-8">
                                    <Link
                                        href="/dashboard/keuangan/invoice"
                                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 hover:shadow-sm transition-all"
                                    >
                                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                                        </svg>
                                        Kembali ke Daftar
                                    </Link>
                                </div>
                            </>
                        )}
                    </div>
                </main>

                <Footer />
            </div>
        </div>
    );
}