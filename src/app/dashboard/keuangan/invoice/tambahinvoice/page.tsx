"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { v4 as uuidv4 } from "uuid";

// ════════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════════
const API_BASE =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const API = `${API_BASE}/api`;

// ════════════════════════════════════════════════════════════════
// TIPE DATA
// ════════════════════════════════════════════════════════════════
type FrekuensiTagihan =
    | "harian"
    | "mingguan"
    | "bulanan"
    | "tahunan"
    | "sekali";

interface InvoiceForm {
    frekuensi: FrekuensiTagihan;
    jenisTagihan: string;
    jenisCustom: string;
    namaPemilik: string;
    nomorIdMeter: string;
    deskripsi: string;
    periodeHari: string;
    periodeMinggu: string;
    periodeBulan: string;
    periodeTahun: string;
    jumlahTagihan: string;
    pemakaian: string;
    satuanPemakaian: string;
    hargaSatuan: string;
    tanggalJatuhTempo: string;
    kontakHP: string;
    kontakEmail: string;
    reminderAktif: boolean;
    reminderMetode: string;
    reminderHariBefore: string;
    catatan: string;
}

const INITIAL: InvoiceForm = {
    frekuensi: "bulanan",
    jenisTagihan: "",
    jenisCustom: "",
    namaPemilik: "",
    nomorIdMeter: "",
    deskripsi: "",
    periodeHari: "",
    periodeMinggu: "",
    periodeBulan: "",
    periodeTahun: "",
    jumlahTagihan: "",
    pemakaian: "",
    satuanPemakaian: "",
    hargaSatuan: "",
    tanggalJatuhTempo: "",
    kontakHP: "",
    kontakEmail: "",
    reminderAktif: true,
    reminderMetode: "whatsapp",
    reminderHariBefore: "",
    catatan: "",
};

// ════════════════════════════════════════════════════════════════
// KONFIGURASI FREKUENSI
// ════════════════════════════════════════════════════════════════
interface FreqOption {
    key: FrekuensiTagihan;
    label: string;
    desc: string;
    icon: string;
    grad: string;
    light: string;
    text: string;
    border: string;
    ring: string;
    accent: string;
    reminderLabel: string;
    reminderDesc: string;
    reminderOptions: { value: string; label: string }[];
}

const FREQ_OPTIONS: FreqOption[] = [
    {
        key: "harian",
        label: "Harian",
        desc: "Tiap hari",
        icon: "⚡",
        grad: "from-amber-400 to-orange-500",
        light: "from-amber-50 to-orange-50",
        text: "text-amber-700",
        border: "border-amber-300",
        ring: "ring-amber-400/30",
        accent: "#d97706",
        reminderLabel: "Ingatkan tiap hari jam",
        reminderDesc: "Dikirim setiap hari pada waktu pilihan",
        reminderOptions: [
            { value: "pagi", label: "Pagi (07:00)" },
            { value: "siang", label: "Siang (12:00)" },
            { value: "sore", label: "Sore (17:00)" },
        ],
    },
    {
        key: "mingguan",
        label: "Mingguan",
        desc: "Tiap minggu",
        icon: "🔁",
        grad: "from-violet-500 to-purple-600",
        light: "from-violet-50 to-purple-50",
        text: "text-violet-700",
        border: "border-violet-300",
        ring: "ring-violet-400/30",
        accent: "#7c3aed",
        reminderLabel: "Berapa hari sebelum jatuh tempo",
        reminderDesc: "Dikirim tiap minggu sebelum jatuh tempo",
        reminderOptions: [
            { value: "1", label: "1 hari" },
            { value: "2", label: "2 hari" },
            { value: "3", label: "3 hari" },
        ],
    },
    {
        key: "bulanan",
        label: "Bulanan",
        desc: "Tiap bulan",
        icon: "📅",
        grad: "from-blue-500 to-indigo-600",
        light: "from-blue-50 to-indigo-50",
        text: "text-blue-700",
        border: "border-blue-300",
        ring: "ring-blue-400/30",
        accent: "#4f46e5",
        reminderLabel: "Berapa hari sebelum jatuh tempo",
        reminderDesc: "Dikirim tiap bulan sebelum jatuh tempo",
        reminderOptions: [
            { value: "3", label: "3 hari" },
            { value: "5", label: "5 hari" },
            { value: "7", label: "7 hari" },
            { value: "14", label: "14 hari" },
        ],
    },
    {
        key: "tahunan",
        label: "Tahunan",
        desc: "Tiap tahun",
        icon: "📆",
        grad: "from-emerald-500 to-teal-600",
        light: "from-emerald-50 to-teal-50",
        text: "text-emerald-700",
        border: "border-emerald-300",
        ring: "ring-emerald-400/30",
        accent: "#059669",
        reminderLabel: "Berapa lama sebelum jatuh tempo",
        reminderDesc: "Dikirim menjelang jatuh tempo tahunan",
        reminderOptions: [
            { value: "7", label: "1 minggu" },
            { value: "14", label: "2 minggu" },
            { value: "30", label: "1 bulan" },
            { value: "60", label: "2 bulan" },
        ],
    },
    {
        key: "sekali",
        label: "Sekali Bayar",
        desc: "Non-rutin",
        icon: "🎯",
        grad: "from-rose-500 to-pink-600",
        light: "from-rose-50 to-pink-50",
        text: "text-rose-700",
        border: "border-rose-300",
        ring: "ring-rose-400/30",
        accent: "#e11d48",
        reminderLabel: "Berapa hari sebelum jatuh tempo",
        reminderDesc: "Dikirim sekali sebelum deadline",
        reminderOptions: [
            { value: "1", label: "1 hari" },
            { value: "3", label: "3 hari" },
            { value: "7", label: "7 hari" },
            { value: "14", label: "14 hari" },
        ],
    },
];

const JENIS_TAGIHAN: Record<FrekuensiTagihan, string[]> = {
    harian: [
        "Parkir",
        "Catering / Makan",
        "Transportasi",
        "Sewa Harian",
        "Lainnya",
    ],
    mingguan: [
        "Laundry",
        "Cleaning Service",
        "Jasa Kebersihan",
        "Sewa Mingguan",
        "Lainnya",
    ],
    bulanan: [
        "Listrik",
        "Air PDAM",
        "Internet",
        "Telepon",
        "BPJS Kesehatan",
        "BPJS Ketenagakerjaan",
        "TV Kabel",
        "Gas",
        "Sewa / Kontrak",
        "Cicilan",
        "Lainnya",
    ],
    tahunan: [
        "Pajak Kendaraan",
        "PBB",
        "Asuransi",
        "Pajak Usaha",
        "Domain / Hosting",
        "Lainnya",
    ],
    sekali: [
        "Renovasi",
        "Pembelian Alat",
        "Jasa Konsultan",
        "Biaya Proyek",
        "Pembelian Furniture",
        "Lainnya",
    ],
};

const SATUAN = [
    "kWh",
    "m³",
    "Liter",
    "Mbps",
    "Bulan",
    "Tahun",
    "Unit",
    "Porsi",
    "Orang",
];

const METODE_DISPLAY: Record<string, string> = {
    whatsapp: "WhatsApp",
    sms: "SMS",
    email: "Email",
};

// ════════════════════════════════════════════════════════════════
// UTILITAS
// ════════════════════════════════════════════════════════════════
function displayRupiah(v: string): string {
    const n = parseInt(v);
    return isNaN(n) ? "" : new Intl.NumberFormat("id-ID").format(n);
}

function getPeriode(form: InvoiceForm): string | null {
    switch (form.frekuensi) {
        case "harian":
            return form.periodeHari || null;
        case "mingguan":
            return form.periodeMinggu || null;
        case "bulanan":
            return form.periodeBulan || null;
        case "tahunan":
            return form.periodeTahun || null;
        default:
            return null;
    }
}

const ic =
    "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400/30 transition-all";

// ════════════════════════════════════════════════════════════════
// KOMPONEN KECIL
// ════════════════════════════════════════════════════════════════
function Section({
    title,
    sub,
    children,
    grad,
}: {
    title: string;
    sub?: string;
    children: React.ReactNode;
    grad?: string;
}) {
    return (
        <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm">
            {grad && <div className={`h-1.5 bg-gradient-to-r ${grad}`} />}
            <div className="p-4 lg:p-6 space-y-4 lg:space-y-5">
                <div>
                    <h3 className="text-sm font-extrabold text-slate-800">{title}</h3>
                    {sub && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
                    )}
                </div>
                {children}
            </div>
        </div>
    );
}

function Label({ text, required }: { text: string; required?: boolean }) {
    return (
        <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            {text}
            {required && <span className="text-rose-400">*</span>}
        </label>
    );
}

function PreviewRow({
    label,
    value,
    valueColor = "text-white",
}: {
    label: string;
    value: string;
    valueColor?: string;
}) {
    return (
        <div className="flex justify-between">
            <span className="text-sm text-slate-400">{label}</span>
            <span className={`text-sm font-bold ${valueColor}`}>{value}</span>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════
// HALAMAN FORM — FULL SCREEN + POST TO API
// ════════════════════════════════════════════════════════════════════
export default function TambahInvoicePage() {
    const router = useRouter();
    const [form, setForm] = useState<InvoiceForm>(INITIAL);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{
        type: "success" | "error";
        msg: string;
    } | null>(null);

    const set = useCallback(
        (field: keyof InvoiceForm, value: string | boolean) => {
            setForm((prev) => ({ ...prev, [field]: value }));
        },
        []
    );

    const fCfg = useMemo(
        () => FREQ_OPTIONS.find((f) => f.key === form.frekuensi)!,
        [form.frekuensi]
    );

    const jenisOptions = useMemo(
        () => JENIS_TAGIHAN[form.frekuensi],
        [form.frekuensi]
    );

    const jenisAktual =
        form.jenisTagihan === "Lainnya" ? form.jenisCustom : form.jenisTagihan;

    const hitungOtomatis = () => {
        const p = parseFloat(form.pemakaian);
        const h = parseFloat(form.hargaSatuan);
        if (!isNaN(p) && !isNaN(h) && p > 0 && h > 0)
            set("jumlahTagihan", (p * h).toString());
    };

    const handleChangeFrekuensi = (key: FrekuensiTagihan) => {
        setForm((prev) => ({
            ...prev,
            frekuensi: key,
            jenisTagihan: "",
            jenisCustom: "",
            reminderHariBefore: "",
        }));
    };

    // ── Submit ke API ──
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;

        // Client validation
        if (!jenisAktual) {
            setToast({ type: "error", msg: "Pilih jenis tagihan" });
            setTimeout(() => setToast(null), 3000);
            return;
        }

        setSubmitting(true);
        setToast(null);

        const jumlah = parseInt(form.jumlahTagihan) || 0;
        const pemakaianNum = parseFloat(form.pemakaian) || null;
        const hargaSatuanNum = parseFloat(form.hargaSatuan) || null;

        const payload = {
            invoice_id: uuidv4(),
            // nomor_invoice: null → backend auto-generate
            jenis_tagihan: jenisAktual,
            nama_pemilik: form.namaPemilik.trim(),
            deskripsi: form.deskripsi.trim() || null,
            frekuensi: form.frekuensi,
            periode: getPeriode(form),
            jumlah,
            jumlah_dibayar: 0,
            tanggal_dibuat: new Date().toISOString().split("T")[0],
            jatuh_tempo: form.tanggalJatuhTempo,
            status: "belum_bayar",
            kontak_hp: form.kontakHP.trim() || null,
            kontak_email: form.kontakEmail.trim() || null,
            nomor_id_meter: form.nomorIdMeter.trim() || null,
            pemakaian: pemakaianNum,
            satuan_pemakaian: form.satuanPemakaian || null,
            harga_satuan: hargaSatuanNum,
            reminder_aktif: form.reminderAktif,
            reminder_metode: form.reminderAktif
                ? form.reminderMetode || null
                : null,
            reminder_hari_before: form.reminderAktif
                ? form.reminderHariBefore || null
                : null,
            reminder_berikutnya: null,
            catatan: form.catatan.trim() || null,
        };

        try {
            const res = await fetch(`${API}/invoice`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();

            if (json.success) {
                setToast({ type: "success", msg: "Invoice berhasil disimpan!" });
                setTimeout(() => {
                    router.push("/dashboard/keuangan/invoice");
                }, 1500);
            } else {
                setToast({
                    type: "error",
                    msg: json.message || "Gagal menyimpan invoice",
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
                                    <svg
                                        width="16"
                                        height="16"
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
                                ) : (
                                    <svg
                                        width="16"
                                        height="16"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={3}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                )}
                                {toast.msg}
                            </div>
                        </div>
                    )}

                    <div className="w-full max-w-3xl mx-auto px-4 sm:px-5 lg:px-6 xl:px-8 py-4 lg:py-6">
                        {/* ══ TITLE BAR ══ */}
                        <div className="flex items-center gap-3 mb-5 lg:mb-6">
                            <Link
                                href="/dashboard/keuangan/invoice"
                                className="p-2 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                                    />
                                </svg>
                            </Link>
                            <div className="flex-1 min-w-0">
                                <h1 className="text-base sm:text-lg lg:text-xl font-extrabold text-slate-900 tracking-tight">
                                    Buat Invoice Baru
                                </h1>
                                <p className="text-[10px] lg:text-[11px] text-slate-400 mt-0.5">
                                    Lengkapi informasi tagihan
                                </p>
                            </div>
                            <span className="hidden sm:block text-[11px] font-mono text-slate-400 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 shrink-0">
                                Auto-generate
                            </span>
                        </div>

                        {/* ══ FORM ══ */}
                        <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-5">
                            {/* 1. FREKUENSI */}
                            <Section
                                title="Frekuensi Tagihan"
                                sub="Seberapa sering tagihan ini perlu dibayar?"
                            >
                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                    {FREQ_OPTIONS.map((opt) => {
                                        const active = form.frekuensi === opt.key;
                                        return (
                                            <button
                                                key={opt.key}
                                                type="button"
                                                onClick={() => handleChangeFrekuensi(opt.key)}
                                                className={`flex flex-col items-center gap-1 px-2 py-3 lg:py-3.5 rounded-2xl border-2 transition-all duration-300 ${active
                                                    ? `bg-gradient-to-b ${opt.light} ${opt.border} shadow-lg ${opt.ring} ring-4`
                                                    : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md"
                                                    }`}
                                            >
                                                <div
                                                    className={`w-8 h-8 lg:w-9 lg:h-9 rounded-xl flex items-center justify-center text-base transition-all ${active
                                                        ? `bg-gradient-to-br ${opt.grad} shadow-md`
                                                        : "bg-slate-100 grayscale"
                                                        }`}
                                                >
                                                    {opt.icon}
                                                </div>
                                                <span
                                                    className={`text-[9px] lg:text-[10px] font-extrabold ${active ? opt.text : "text-slate-500"
                                                        }`}
                                                >
                                                    {opt.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </Section>

                            {/* 2. JENIS */}
                            <Section
                                title="Jenis Tagihan"
                                sub={`Kategori tagihan ${fCfg.label.toLowerCase()}`}
                                grad={fCfg.grad}
                            >
                                <div className="flex flex-wrap gap-2">
                                    {jenisOptions.map((j) => (
                                        <button
                                            key={j}
                                            type="button"
                                            onClick={() => {
                                                set("jenisTagihan", j);
                                                set("jenisCustom", "");
                                            }}
                                            className={`px-3 lg:px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all duration-200 ${form.jenisTagihan === j
                                                ? `bg-gradient-to-r ${fCfg.grad} text-white border-transparent shadow-md`
                                                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:shadow-sm"
                                                }`}
                                        >
                                            {j}
                                        </button>
                                    ))}
                                </div>
                                {form.jenisTagihan === "Lainnya" && (
                                    <div>
                                        <Label text="Nama Jenis Tagihan" required />
                                        <input
                                            type="text"
                                            className={ic}
                                            placeholder="Ketik jenis tagihan..."
                                            value={form.jenisCustom}
                                            onChange={(e) => set("jenisCustom", e.target.value)}
                                        />
                                    </div>
                                )}
                            </Section>

                            {/* 3. DETAIL */}
                            <Section
                                title="Detail Tagihan"
                                sub="Informasi pemilik dan deskripsi"
                            >
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                                    <div>
                                        <Label text="Nama Pemilik" required />
                                        <input
                                            type="text"
                                            className={ic}
                                            placeholder="Nama pemilik tagihan"
                                            value={form.namaPemilik}
                                            onChange={(e) => set("namaPemilik", e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <Label text="No ID / Meter / Polis" />
                                        <input
                                            type="text"
                                            className={ic}
                                            placeholder="Opsional"
                                            value={form.nomorIdMeter}
                                            onChange={(e) => set("nomorIdMeter", e.target.value)}
                                        />
                                        <p className="text-[9px] text-slate-300 mt-1">
                                            No pelanggan, meter, polis, dsb.
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <Label text="Deskripsi" />
                                    <textarea
                                        className={`${ic} resize-none`}
                                        rows={2}
                                        placeholder="Keterangan tagihan"
                                        value={form.deskripsi}
                                        onChange={(e) => set("deskripsi", e.target.value)}
                                    />
                                </div>
                                {form.frekuensi === "harian" && (
                                    <div>
                                        <Label text="Tanggal" required />
                                        <input
                                            type="date"
                                            className={ic}
                                            value={form.periodeHari}
                                            onChange={(e) => set("periodeHari", e.target.value)}
                                            required
                                        />
                                    </div>
                                )}
                                {form.frekuensi === "mingguan" && (
                                    <div>
                                        <Label text="Minggu ke-" required />
                                        <input
                                            type="text"
                                            className={ic}
                                            placeholder="Minggu ke-4 Februari"
                                            value={form.periodeMinggu}
                                            onChange={(e) => set("periodeMinggu", e.target.value)}
                                            required
                                        />
                                    </div>
                                )}
                                {form.frekuensi === "bulanan" && (
                                    <div>
                                        <Label text="Bulan" required />
                                        <input
                                            type="month"
                                            className={ic}
                                            value={form.periodeBulan}
                                            onChange={(e) => set("periodeBulan", e.target.value)}
                                            required
                                        />
                                    </div>
                                )}
                                {form.frekuensi === "tahunan" && (
                                    <div>
                                        <Label text="Tahun" required />
                                        <input
                                            type="number"
                                            className={ic}
                                            placeholder="2024"
                                            min="2020"
                                            max="2099"
                                            value={form.periodeTahun}
                                            onChange={(e) => set("periodeTahun", e.target.value)}
                                            required
                                        />
                                    </div>
                                )}
                            </Section>

                            {/* 4. NOMINAL */}
                            <Section
                                title="Nominal Tagihan"
                                sub="Jumlah yang harus dibayarkan"
                            >
                                <div className="bg-slate-50/80 rounded-xl p-3 lg:p-4 border border-slate-100 space-y-3">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                        Kalkulator Pemakaian (Opsional)
                                    </p>
                                    <div className="grid grid-cols-3 gap-2 lg:gap-3">
                                        <div>
                                            <Label text="Pemakaian" />
                                            <input
                                                type="number"
                                                className={ic}
                                                placeholder="150"
                                                value={form.pemakaian}
                                                onChange={(e) => set("pemakaian", e.target.value)}
                                                onBlur={hitungOtomatis}
                                                min="0"
                                            />
                                        </div>
                                        <div>
                                            <Label text="Satuan" />
                                            <select
                                                className={ic}
                                                value={form.satuanPemakaian}
                                                onChange={(e) =>
                                                    set("satuanPemakaian", e.target.value)
                                                }
                                            >
                                                <option value="">Pilih</option>
                                                {SATUAN.map((s) => (
                                                    <option key={s} value={s}>
                                                        {s}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <Label text="Harga/Satuan" />
                                            <input
                                                type="number"
                                                className={ic}
                                                placeholder="1500"
                                                value={form.hargaSatuan}
                                                onChange={(e) => set("hargaSatuan", e.target.value)}
                                                onBlur={hitungOtomatis}
                                                min="0"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={hitungOtomatis}
                                        className={`text-[11px] font-bold ${fCfg.text} bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:shadow-sm transition-all`}
                                    >
                                        Hitung Otomatis
                                    </button>
                                </div>
                                <div>
                                    <Label text="Jumlah Tagihan (Rp)" required />
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-slate-400">
                                            Rp
                                        </span>
                                        <input
                                            type="text"
                                            className={`${ic} pl-12 text-xl font-extrabold`}
                                            placeholder="0"
                                            value={
                                                form.jumlahTagihan
                                                    ? displayRupiah(form.jumlahTagihan)
                                                    : ""
                                            }
                                            onChange={(e) =>
                                                set(
                                                    "jumlahTagihan",
                                                    e.target.value.replace(/[^0-9]/g, "")
                                                )
                                            }
                                            required
                                        />
                                    </div>
                                    {form.jumlahTagihan && (
                                        <p className={`text-xs font-bold mt-1.5 ${fCfg.text}`}>
                                            = Rp {displayRupiah(form.jumlahTagihan)}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label text="Tanggal Jatuh Tempo" required />
                                    <input
                                        type="date"
                                        className={ic}
                                        value={form.tanggalJatuhTempo}
                                        onChange={(e) =>
                                            set("tanggalJatuhTempo", e.target.value)
                                        }
                                        required
                                    />
                                </div>
                            </Section>

                            {/* 5. KONTAK */}
                            <Section
                                title="Kontak Pemilik"
                                sub="Nomor HP/WA untuk reminder"
                            >
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                                    <div>
                                        <Label text="No HP / WhatsApp" required />
                                        <input
                                            type="tel"
                                            className={ic}
                                            placeholder="081234567890"
                                            value={form.kontakHP}
                                            onChange={(e) => set("kontakHP", e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <Label text="Email" />
                                        <input
                                            type="email"
                                            className={ic}
                                            placeholder="email@contoh.com"
                                            value={form.kontakEmail}
                                            onChange={(e) => set("kontakEmail", e.target.value)}
                                        />
                                    </div>
                                </div>
                            </Section>

                            {/* 6. REMINDER */}
                            <Section
                                title={`Pengingat — ${fCfg.label}`}
                                sub={`Reminder otomatis untuk tagihan ${fCfg.label.toLowerCase()}`}
                                grad={fCfg.grad}
                            >
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div
                                        className="relative"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            set("reminderAktif", !form.reminderAktif);
                                        }}
                                    >
                                        <div
                                            className={`rounded-full transition-all duration-300 ${form.reminderAktif
                                                ? `bg-gradient-to-r ${fCfg.grad}`
                                                : "bg-slate-200"
                                                }`}
                                            style={{ width: 44, height: 24 }}
                                        />
                                        <div
                                            className="absolute bg-white rounded-full shadow-md transition-transform duration-300"
                                            style={{
                                                top: 2,
                                                left: form.reminderAktif ? 22 : 2,
                                                width: 20,
                                                height: 20,
                                            }}
                                        />
                                    </div>
                                    <span className="text-sm font-bold text-slate-600 group-hover:text-slate-800 transition-colors">
                                        Aktifkan pengingat
                                    </span>
                                </label>
                                {form.reminderAktif && (
                                    <div className="space-y-4 pt-1">
                                        <div
                                            className={`flex items-start gap-3 px-4 py-3 rounded-xl bg-gradient-to-r ${fCfg.light} border ${fCfg.border}/30`}
                                        >
                                            <span className="text-lg mt-0.5">{fCfg.icon}</span>
                                            <div>
                                                <p
                                                    className={`text-[11px] font-extrabold ${fCfg.text}`}
                                                >
                                                    {fCfg.reminderLabel}
                                                </p>
                                                <p
                                                    className={`text-[9px] ${fCfg.text} opacity-50 mt-0.5`}
                                                >
                                                    {fCfg.reminderDesc}
                                                </p>
                                            </div>
                                        </div>
                                        <div>
                                            <Label text="Kapan?" required />
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                {fCfg.reminderOptions.map((opt) => (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() =>
                                                            set("reminderHariBefore", opt.value)
                                                        }
                                                        className={`px-3 py-2.5 rounded-xl text-[11px] font-bold border-2 transition-all duration-200 ${form.reminderHariBefore === opt.value
                                                            ? `bg-gradient-to-r ${fCfg.grad} text-white border-transparent shadow-md`
                                                            : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                                                            }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <Label text="Kirim Via" required />
                                            <div className="flex gap-2">
                                                {(["whatsapp", "sms", "email"] as const).map(
                                                    (m) => (
                                                        <button
                                                            key={m}
                                                            type="button"
                                                            onClick={() => set("reminderMetode", m)}
                                                            className={`flex-1 px-3 py-2.5 rounded-xl text-[11px] font-bold border-2 transition-all duration-200 ${form.reminderMetode === m
                                                                ? `bg-gradient-to-r ${fCfg.grad} text-white border-transparent shadow-md`
                                                                : "bg-white text-slate-500 border-slate-200"
                                                                }`}
                                                        >
                                                            {METODE_DISPLAY[m]}
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </Section>

                            {/* 7. CATATAN */}
                            <Section
                                title="Catatan Tambahan"
                                sub="Opsional: referensi internal"
                            >
                                <textarea
                                    className={`${ic} resize-none`}
                                    rows={3}
                                    placeholder="Catatan tambahan..."
                                    value={form.catatan}
                                    onChange={(e) => set("catatan", e.target.value)}
                                />
                            </Section>

                            {/* ══ PREVIEW ══ */}
                            {form.jenisTagihan &&
                                form.namaPemilik &&
                                form.jumlahTagihan && (
                                    <div
                                        className="rounded-2xl overflow-hidden shadow-2xl"
                                        style={{
                                            background:
                                                "linear-gradient(135deg,#1e293b,#0f172a,#1e1b4b)",
                                        }}
                                    >
                                        <div
                                            className={`h-1.5 bg-gradient-to-r ${fCfg.grad}`}
                                        />
                                        <div className="p-5 lg:p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-slate-500">
                                                    Ringkasan Invoice
                                                </p>
                                                <span
                                                    className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold px-3 py-1 rounded-full bg-gradient-to-r ${fCfg.grad} text-white shadow-md`}
                                                >
                                                    {fCfg.icon} {fCfg.label}
                                                </span>
                                            </div>
                                            <div className="space-y-2.5 text-white">
                                                <PreviewRow
                                                    label="Jenis"
                                                    value={jenisAktual || "-"}
                                                />
                                                <PreviewRow
                                                    label="Pemilik"
                                                    value={form.namaPemilik}
                                                />
                                                {form.frekuensi === "bulanan" &&
                                                    form.periodeBulan && (
                                                        <PreviewRow
                                                            label="Periode"
                                                            value={form.periodeBulan}
                                                        />
                                                    )}
                                                {form.frekuensi === "harian" &&
                                                    form.periodeHari && (
                                                        <PreviewRow
                                                            label="Tanggal"
                                                            value={new Date(
                                                                form.periodeHari
                                                            ).toLocaleDateString("id-ID", {
                                                                day: "numeric",
                                                                month: "long",
                                                                year: "numeric",
                                                            })}
                                                        />
                                                    )}
                                                {form.frekuensi === "mingguan" &&
                                                    form.periodeMinggu && (
                                                        <PreviewRow
                                                            label="Periode"
                                                            value={form.periodeMinggu}
                                                        />
                                                    )}
                                                {form.frekuensi === "tahunan" &&
                                                    form.periodeTahun && (
                                                        <PreviewRow
                                                            label="Tahun"
                                                            value={form.periodeTahun}
                                                        />
                                                    )}
                                                <div className="border-t border-slate-700/50 my-3" />
                                                <div className="flex justify-between items-end">
                                                    <span className="text-sm text-slate-400">
                                                        Total
                                                    </span>
                                                    <span className="text-2xl lg:text-3xl font-extrabold tracking-tight">
                                                        Rp {displayRupiah(form.jumlahTagihan)}
                                                    </span>
                                                </div>
                                                {form.tanggalJatuhTempo && (
                                                    <PreviewRow
                                                        label="Jatuh Tempo"
                                                        value={new Date(
                                                            form.tanggalJatuhTempo
                                                        ).toLocaleDateString("id-ID", {
                                                            day: "numeric",
                                                            month: "long",
                                                            year: "numeric",
                                                        })}
                                                        valueColor="text-amber-300"
                                                    />
                                                )}
                                                {form.reminderAktif &&
                                                    form.reminderHariBefore && (
                                                        <PreviewRow
                                                            label="Reminder"
                                                            value={`${METODE_DISPLAY[form.reminderMetode] ??
                                                                form.reminderMetode
                                                                } — ${fCfg.reminderOptions.find(
                                                                    (o) =>
                                                                        o.value === form.reminderHariBefore
                                                                )?.label || ""
                                                                }`}
                                                            valueColor="text-emerald-300"
                                                        />
                                                    )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                            {/* ══ TOMBOL AKSI ══ */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-3 pb-8">
                                <Link
                                    href="/dashboard/keuangan/invoice"
                                    className="px-6 py-3 rounded-xl text-sm font-bold text-slate-500 border-2 border-slate-200 bg-white hover:bg-slate-50 hover:shadow-sm transition-all text-center"
                                >
                                    Batal
                                </Link>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`flex-1 sm:flex-none px-8 py-3 rounded-xl text-sm font-extrabold text-white bg-gradient-to-r ${fCfg.grad} hover:opacity-90 shadow-lg hover:shadow-xl transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {submitting ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg
                                                className="animate-spin h-4 w-4"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                            >
                                                <circle
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="3"
                                                    className="opacity-25"
                                                />
                                                <path
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                                    className="opacity-75"
                                                />
                                            </svg>
                                            Menyimpan...
                                        </span>
                                    ) : (
                                        "Simpan Invoice"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </main>

                <Footer />
            </div>
        </div>
    );
}