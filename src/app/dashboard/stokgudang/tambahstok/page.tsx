// /src/app/dashboard/stokgudang/tambahstok/page.tsx
"use client";

import type React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import {
    MapPin,
    Package,
    Plus,
    Trash2,
    Save,
    Search,
    AlertTriangle,
    CheckCircle,
} from "lucide-react";

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

// Gunakan env NEXT_PUBLIC_API_BASE (tanpa /api di belakang)
// NEXT_PUBLIC_API_BASE=http://localhost:8080
const API_BASE_URL =
    (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") as
        | string
        | undefined) ?? "http://localhost:8080";

type JenisPemasukan = "pembelian_po" | "retur_barang";

const JENIS_PEMASUKAN_OPTIONS: {
    value: JenisPemasukan;
    label: string;
    description: string;
}[] = [
        {
            value: "pembelian_po",
            label: "Pembelian via PO",
            description:
                "Stok masuk karena pembelian dari supplier berdasarkan PO.",
        },
        {
            value: "retur_barang",
            label: "Retur Barang",
            description:
                "Stok masuk karena retur dari proyek / customer.",
        },
    ];

// 🔹 Pilihan lokasi gudang
const LOKASI_OPTIONS: { value: string; label: string }[] = [
    { value: "", label: "Pilih Lokasi Gudang" },
    { value: "Gudang A (Utama)", label: "Gudang A (Utama)" },
    { value: "Gudang B", label: "Gudang B" },
    { value: "Gudang C", label: "Gudang C" },
    { value: "Gudang D", label: "Gudang D" },
    { value: "Gudang E", label: "Gudang E" },
];

type Product = {
    id: number;
    kode: string;
    nama: string;
    brand: string;
    kategori: string;
    satuan: string;
    harga_idr: number;
};

type StockLine = {
    id: string;
    kode: string;
    qty: string;
    product?: Product;
    isFetching: boolean;
    error?: string;
    suggestions: Product[];
    showSuggestions: boolean;
};

function createEmptyLine(): StockLine {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        kode: "",
        qty: "",
        product: undefined,
        isFetching: false,
        error: undefined,
        suggestions: [],
        showSuggestions: false,
    };
}

// Helper untuk format Rupiah
const formatRupiah = (amount: number) => {
    return amount.toLocaleString("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
};

// Icon Calendar lokal
const Calendar = ({ className }: { className: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
);

// Komponen Status per-line
const LineStatus = ({ line }: { line: StockLine }) => {
    if (line.isFetching) {
        return (
            <span className="mt-1 flex items-center gap-1 text-xs text-indigo-500">
                <Search className="h-3 w-3 animate-pulse" /> Mencari...
            </span>
        );
    }
    if (line.error) {
        return (
            <p className="mt-1 flex items-start gap-1 text-[10px] text-red-600">
                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                {line.error}
            </p>
        );
    }
    if (line.product) {
        return (
            <p className="mt-1 flex items-start gap-1 text-[10px] text-teal-600">
                <CheckCircle className="h-3 w-3 flex-shrink-0" />
                Produk terdeteksi
            </p>
        );
    }
    return null;
};

export default function TambahStokPage() {
    const [lokasi, setLokasi] = useState<string>("");
    const [jenisPemasukan, setJenisPemasukan] =
        useState<JenisPemasukan>("pembelian_po");
    const [tanggal, setTanggal] = useState(
        () => new Date().toISOString().slice(0, 10),
    );
    const [lines, setLines] = useState<StockLine[]>([createEmptyLine()]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [formSuccess, setFormSuccess] = useState<string | null>(null);

    // layout sidebar
    const [open, setOpen] = useState(true);

    // timeout per-line untuk debounce search
    const searchDebounceRef = useRef<Record<string, number>>({});

    const updateLine = useCallback(
        (id: string, updater: (prev: StockLine) => StockLine) => {
            setLines((prev) =>
                prev.map((line) => (line.id === id ? updater(line) : line)),
            );
        },
        [],
    );

    const handleAddLine = () => {
        setLines((prev) => [...prev, createEmptyLine()]);
        setFormError(null);
    };

    const handleRemoveLine = (id: string) => {
        setLines((prev) =>
            prev.length === 1 ? prev : prev.filter((line) => line.id !== id),
        );
    };

    // 🔎 Autocomplete: fetch suggestions by kode/nama
    const fetchSuggestionsByKode = useCallback(
        async (lineId: string, value: string) => {
            const term = value.trim();

            updateLine(lineId, (prev) => ({
                ...prev,
                isFetching: true,
                showSuggestions: true,
                error: undefined,
            }));

            try {
                const url = `${API_BASE_URL}/api/product/search?q=${encodeURIComponent(
                    term,
                )}&limit=50`;

                const res = await fetch(url);

                if (!res.ok) {
                    throw new Error("Gagal mencari produk.");
                }

                const data: Product[] = await res.json();

                updateLine(lineId, (prev) => ({
                    ...prev,
                    isFetching: false,
                    suggestions: data,
                    showSuggestions: data.length > 0,
                    error:
                        data.length === 0
                            ? "Produk tidak ditemukan."
                            : undefined,
                }));
            } catch (err) {
                const message =
                    err instanceof Error
                        ? err.message
                        : "Gagal mencari produk.";
                updateLine(lineId, (prev) => ({
                    ...prev,
                    isFetching: false,
                    suggestions: [],
                    showSuggestions: true,
                    error: message,
                }));
            }
        },
        [updateLine],
    );

    // Kode produk with debounce → panggil search suggestion
    const handleKodeChange = (id: string, value: string) => {
        const upper = value.toUpperCase();

        updateLine(id, (prev) => ({
            ...prev,
            kode: upper,
            product: undefined,
            error: undefined,
        }));

        const existingTimeoutId = searchDebounceRef.current[id];
        if (existingTimeoutId) {
            window.clearTimeout(existingTimeoutId);
        }

        const trimmed = upper.trim();

        if (trimmed.length < 1) {
            updateLine(id, (prev) => ({
                ...prev,
                suggestions: [],
                showSuggestions: false,
                isFetching: false,
            }));
            return;
        }

        const timeoutId = window.setTimeout(() => {
            fetchSuggestionsByKode(id, trimmed);
        }, 300);

        searchDebounceRef.current[id] = timeoutId;
    };

    const handleQtyChange = (id: string, value: string) => {
        if (value === "" || /^[0-9]+(\.[0-9]*)?$/.test(value)) {
            updateLine(id, (prev) => ({
                ...prev,
                qty: value,
            }));
        }
    };

    // ✅ ketika user klik salah satu suggestion
    const handleSelectSuggestion = (lineId: string, product: Product) => {
        updateLine(lineId, (prev) => ({
            ...prev,
            kode: product.kode.toUpperCase(),
            product,
            suggestions: [],
            showSuggestions: false,
            isFetching: false,
            error: undefined,
        }));
    };

    // Fallback: tombol “Cari” / onBlur, pakai exact kode
    const fetchProductByKode = useCallback(
        async (line: StockLine) => {
            const kode = line.kode.trim();
            if (!kode) {
                updateLine(line.id, (prev) => ({
                    ...prev,
                    product: undefined,
                    error: "Kode produk wajib diisi.",
                }));
                return;
            }

            updateLine(line.id, (prev) => ({
                ...prev,
                isFetching: true,
                error: undefined,
                showSuggestions: false,
            }));

            try {
                const res = await fetch(
                    `${API_BASE_URL}/api/product/by-kode/${encodeURIComponent(
                        kode,
                    )}`,
                );

                if (!res.ok) {
                    throw new Error("Produk tidak ditemukan.");
                }

                const data: Product = await res.json();

                updateLine(line.id, (prev) => ({
                    ...prev,
                    product: data,
                    isFetching: false,
                    error: undefined,
                    suggestions: [],
                    showSuggestions: false,
                }));
            } catch (err) {
                const message =
                    err instanceof Error
                        ? err.message
                        : "Gagal mengambil data produk.";
                updateLine(line.id, (prev) => ({
                    ...prev,
                    product: undefined,
                    isFetching: false,
                    error: message,
                    suggestions: [],
                    showSuggestions: false,
                }));
            }
        },
        [updateLine],
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        setFormSuccess(null);

        const validItems = lines
            .filter(
                (line) =>
                    line.product && line.qty !== "" && Number(line.qty) > 0,
            )
            .map((line) => ({
                product_id: line.product!.id,
                product_kode: line.product!.kode,
                qty: Number(line.qty),
                satuan: line.product!.satuan,
            }));

        if (!lokasi.trim()) {
            setFormError("Lokasi penyimpanan wajib dipilih.");
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        if (validItems.length === 0) {
            setFormError(
                "Minimal satu baris stok harus diisi dengan produk terdeteksi dan jumlah > 0.",
            );
            document
                .getElementById("stock-table-container")
                ?.scrollIntoView({ behavior: "smooth" });
            return;
        }

        const payload = {
            tanggal,
            lokasi: lokasi.trim(),
            jenis_pemasukan: jenisPemasukan,
            items: validItems,
        };

        try {
            setIsSubmitting(true);
            const res = await fetch(
                `${API_BASE_URL}/api/stock-movements/batch-in`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                },
            );

            if (!res.ok) {
                let message = "Gagal menyimpan stok.";
                try {
                    const body = await res.json();
                    if (body?.message) message = body.message;
                } catch {
                    // ignore
                }
                throw new Error(message);
            }

            setFormSuccess(
                "Stok masuk berhasil disimpan ke stockmovement & stok.",
            );
            setLines([createEmptyLine()]);
            setLokasi("");
            setJenisPemasukan("pembelian_po");
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Terjadi kesalahan saat menyimpan.";
            setFormError(message);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Hitung grand total nilai stok masuk (Rp)
    const grandTotal = lines.reduce((sum, line) => {
        if (!line.product) return sum;
        const qtyNum = parseFloat(line.qty || "0");
        if (isNaN(qtyNum) || qtyNum <= 0) return sum;
        return sum + qtyNum * line.product.harga_idr;
    }, 0);

    // Bersihkan timeout debounce saat unmount
    useEffect(() => {
        return () => {
            Object.values(searchDebounceRef.current).forEach((id) =>
                window.clearTimeout(id),
            );
        };
    }, []);

    return (
        <div className="flex h-[100dvh] w-full max-w-full overflow-hidden bg-slate-100 text-slate-800">
            {/* SIDEBAR */}
            <div className="shrink-0">
                <Sidebar open={open} setOpen={setOpen} />
            </div>

            {/* MAIN AREA */}
            <div className="flex min-w-0 flex-1 flex-col">
                <Header onToggle={() => setOpen(!open)} />

                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <main className="font-inter w-full max-w-6xl mx-auto p-4 sm:p-8">
                        <div className="space-y-8">
                            {/* Header Section */}
                            <header className="border-b-2 border-indigo-100 pb-4">
                                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
                                    Pencatatan Stok Masuk
                                </h1>
                                <p className="mt-2 text-sm sm:text-base text-gray-500">
                                    Isi detail transaksi dan item produk untuk
                                    mencatat pergerakan stok (Stock-In).
                                </p>
                            </header>

                            {/* Status/Feedback */}
                            {formError && (
                                <div
                                    className="flex items-start gap-3 rounded-xl border border-red-400 bg-red-50 p-4 shadow-md"
                                    role="alert"
                                >
                                    <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                                    <div className="text-sm">
                                        <p className="font-bold text-red-800">
                                            Gagal Memproses
                                        </p>
                                        <p className="text-red-700">
                                            {formError}
                                        </p>
                                    </div>
                                </div>
                            )}
                            {formSuccess && (
                                <div
                                    className="flex items-start gap-3 rounded-xl border border-green-400 bg-green-50 p-4 shadow-md"
                                    role="alert"
                                >
                                    <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                                    <div className="text-sm">
                                        <p className="font-bold text-green-800">
                                            Berhasil!
                                        </p>
                                        <p className="text-green-700">
                                            {formSuccess}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <form
                                onSubmit={handleSubmit}
                                className="space-y-8"
                            >
                                {/* Bagian 1: Informasi Transaksi */}
                                <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-2xl shadow-gray-200">
                                    <h2 className="mb-5 flex items-center gap-2 border-b border-gray-100 pb-3 text-xl font-bold text-gray-800">
                                        <MapPin className="h-5 w-5 text-indigo-600" />
                                        Detail Transaksi
                                    </h2>
                                    <div className="grid gap-8 md:grid-cols-3">
                                        {/* Lokasi */}
                                        <div className="flex flex-col space-y-1">
                                            <label
                                                htmlFor="lokasi"
                                                className="flex items-center gap-1 text-sm font-medium text-gray-700"
                                            >
                                                <MapPin className="h-4 w-4 text-indigo-500" />
                                                Lokasi Penyimpanan{" "}
                                                <span className="text-red-500">
                                                    *
                                                </span>
                                            </label>
                                            <select
                                                id="lokasi"
                                                value={lokasi}
                                                onChange={(e) =>
                                                    setLokasi(
                                                        e.target.value,
                                                    )
                                                }
                                                className="shadow-inner rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition duration-150 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                required
                                            >
                                                {LOKASI_OPTIONS.map((opt) => (
                                                    <option
                                                        key={
                                                            opt.value ||
                                                            "placeholder"
                                                        }
                                                        value={opt.value}
                                                        disabled={
                                                            opt.value === ""
                                                        }
                                                    >
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="mt-1 text-xs text-gray-500">
                                                Pilih gudang tempat stok fisik
                                                disimpan.
                                            </p>
                                        </div>

                                        {/* Jenis Pemasukan */}
                                        <div className="flex flex-col space-y-1">
                                            <label
                                                htmlFor="jenisPemasukan"
                                                className="flex items-center gap-1 text-sm font-medium text-gray-700"
                                            >
                                                <Package className="h-4 w-4 text-indigo-500" />
                                                Jenis Pemasukan{" "}
                                                <span className="text-red-500">
                                                    *
                                                </span>
                                            </label>
                                            <select
                                                id="jenisPemasukan"
                                                value={jenisPemasukan}
                                                onChange={(e) =>
                                                    setJenisPemasukan(
                                                        e.target
                                                            .value as JenisPemasukan,
                                                    )
                                                }
                                                className="shadow-inner rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition duration-150 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                {JENIS_PEMASUKAN_OPTIONS.map(
                                                    (opt) => (
                                                        <option
                                                            key={opt.value}
                                                            value={opt.value}
                                                        >
                                                            {opt.label}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                            <p className="mt-1 text-xs text-gray-500">
                                                {
                                                    JENIS_PEMASUKAN_OPTIONS.find(
                                                        (opt) =>
                                                            opt.value ===
                                                            jenisPemasukan,
                                                    )?.description
                                                }
                                            </p>
                                        </div>

                                        {/* Tanggal Transaksi */}
                                        <div className="flex flex-col space-y-1">
                                            <label
                                                htmlFor="tanggal"
                                                className="flex items-center gap-1 text-sm font-medium text-gray-700"
                                            >
                                                <Calendar className="h-4 w-4 text-indigo-500" />
                                                Tanggal Transaksi{" "}
                                                <span className="text-red-500">
                                                    *
                                                </span>
                                            </label>
                                            <input
                                                id="tanggal"
                                                type="date"
                                                value={tanggal}
                                                onChange={(e) =>
                                                    setTanggal(
                                                        e.target.value,
                                                    )
                                                }
                                                className="shadow-inner rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition duration-150 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                required
                                            />
                                            <p className="mt-1 text-xs text-gray-500">
                                                Tanggal pencatatan stok.
                                                Sesuaikan jika{" "}
                                                <i>backdate</i>.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Bagian 2: Tabel Input Stok */}
                                <div
                                    id="stock-table-container"
                                    className="rounded-xl border border-gray-100 bg-white shadow-2xl shadow-gray-200"
                                >
                                    <div className="p-6">
                                        <h2 className="flex items-center gap-2 text-xl font-bold text-gray-800">
                                            <Package className="h-5 w-5 text-indigo-600" />
                                            Daftar Produk Masuk
                                        </h2>
                                        <p className="mt-1 text-sm text-gray-500">
                                            Cari produk (Kode Produk) dan
                                            tentukan jumlah (QTY) yang masuk.
                                        </p>
                                    </div>

                                    <div className="overflow-x-auto overflow-y-visible">
                                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                                            <thead className="sticky top-0 bg-gray-100 shadow-inner">
                                                <tr>
                                                    <th className="w-60 px-4 py-3 text-left font-bold text-gray-700 sm:w-72 whitespace-nowrap">
                                                        Kode Produk
                                                    </th>
                                                    <th className="min-w-[200px] px-4 py-3 text-left font-bold text-gray-700">
                                                        Nama Produk &amp;
                                                        Detail
                                                    </th>
                                                    <th className="w-24 px-4 py-3 text-left font-bold text-gray-700">
                                                        Satuan
                                                    </th>
                                                    <th className="w-28 px-4 py-3 text-right font-bold text-gray-700">
                                                        Qty Masuk
                                                    </th>
                                                    <th className="w-36 px-4 py-3 text-right font-bold text-gray-700 whitespace-nowrap">
                                                        Harga Satuan
                                                    </th>
                                                    <th className="w-36 px-4 py-3 text-right font-bold text-gray-700">
                                                        Total
                                                    </th>
                                                    <th className="w-10 px-4 py-3 text-left" />
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {lines.map((line) => {
                                                    const qtyNum = parseFloat(
                                                        line.qty || "0",
                                                    );
                                                    const lineTotal =
                                                        line.product &&
                                                            !isNaN(qtyNum) &&
                                                            qtyNum > 0
                                                            ? qtyNum *
                                                            line.product
                                                                .harga_idr
                                                            : 0;

                                                    const rowClass = line.product
                                                        ? "bg-white hover:bg-teal-50/40 transition duration-150"
                                                        : "bg-white hover:bg-gray-50 transition duration-150";

                                                    const displayNama =
                                                        line.product &&
                                                            jenisPemasukan ===
                                                            "retur_barang"
                                                            ? `[SISA RETUR] ${line.product.nama}`
                                                            : line.product
                                                                ?.nama ?? "";

                                                    return (
                                                        <tr
                                                            key={line.id}
                                                            className={
                                                                rowClass
                                                            }
                                                        >
                                                            {/* Kode Produk + Search */}
                                                            <td className="px-4 py-4 align-top">
                                                                <div className="flex gap-2">
                                                                    <input
                                                                        type="text"
                                                                        value={
                                                                            line.kode
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            handleKodeChange(
                                                                                line.id,
                                                                                e
                                                                                    .target
                                                                                    .value,
                                                                            )
                                                                        }
                                                                        onBlur={() => {
                                                                            if (
                                                                                !line.product &&
                                                                                line.kode.trim() &&
                                                                                line
                                                                                    .suggestions
                                                                                    .length ===
                                                                                0
                                                                            ) {
                                                                                void fetchProductByKode(
                                                                                    line,
                                                                                );
                                                                            }
                                                                        }}
                                                                        className="shadow-inner w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase transition duration-150 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                                        placeholder="Ketik kode atau nama..."
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            fetchProductByKode(
                                                                                line,
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            line.isFetching ||
                                                                            !line.kode.trim()
                                                                        }
                                                                        className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white shadow-md transition duration-150 hover:bg-indigo-700 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-gray-400"
                                                                        title="Cari Produk (exact kode)"
                                                                    >
                                                                        {line.isFetching ? (
                                                                            <span className="animate-spin">
                                                                                <Search className="h-3.5 w-3.5" />
                                                                            </span>
                                                                        ) : (
                                                                            <Search className="h-3.5 w-3.5" />
                                                                        )}
                                                                    </button>
                                                                </div>

                                                                <LineStatus
                                                                    line={line}
                                                                />

                                                                {line.showSuggestions &&
                                                                    line
                                                                        .suggestions
                                                                        .length >
                                                                    0 && (
                                                                        <div className="mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white text-xs shadow-lg">
                                                                            {line.suggestions.map(
                                                                                (
                                                                                    p,
                                                                                ) => (
                                                                                    <button
                                                                                        key={
                                                                                            p.id
                                                                                        }
                                                                                        type="button"
                                                                                        onClick={() =>
                                                                                            handleSelectSuggestion(
                                                                                                line.id,
                                                                                                p,
                                                                                            )
                                                                                        }
                                                                                        className="w-full px-3 py-2 text-left hover:bg-indigo-50"
                                                                                    >
                                                                                        <div className="font-semibold text-gray-800">
                                                                                            {
                                                                                                p.kode
                                                                                            }{" "}
                                                                                            —{" "}
                                                                                            {
                                                                                                p.nama
                                                                                            }
                                                                                        </div>
                                                                                        <div className="text-[11px] text-gray-500">
                                                                                            Brand:{" "}
                                                                                            {
                                                                                                p.brand
                                                                                            }{" "}
                                                                                            •
                                                                                            Kategori:{" "}
                                                                                            {
                                                                                                p.kategori
                                                                                            }{" "}
                                                                                            •
                                                                                            Satuan:{" "}
                                                                                            {
                                                                                                p.satuan
                                                                                            }
                                                                                        </div>
                                                                                    </button>
                                                                                ),
                                                                            )}
                                                                        </div>
                                                                    )}
                                                            </td>

                                                            {/* Info produk */}
                                                            <td className="px-4 py-4 align-top">
                                                                {line.product ? (
                                                                    <div className="space-y-0.5 border-l-2 border-teal-400 pl-3">
                                                                        <div className="flex items-center gap-1 font-semibold text-gray-900">
                                                                            {jenisPemasukan ===
                                                                                "retur_barang" && (
                                                                                    <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                                                                                        SISA
                                                                                        RETUR
                                                                                    </span>
                                                                                )}
                                                                            <span>
                                                                                {
                                                                                    displayNama
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-xs text-gray-500">
                                                                            <span className="font-medium">
                                                                                Brand:
                                                                            </span>{" "}
                                                                            {
                                                                                line
                                                                                    .product
                                                                                    .brand
                                                                            }{" "}
                                                                            |{" "}
                                                                            <span className="font-medium">
                                                                                Kategori:
                                                                            </span>{" "}
                                                                            {
                                                                                line
                                                                                    .product
                                                                                    .kategori
                                                                            }
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs italic text-gray-400">
                                                                        Masukkan
                                                                        kode /
                                                                        nama dan
                                                                        pilih dari
                                                                        suggestion
                                                                    </span>
                                                                )}
                                                            </td>

                                                            {/* Satuan */}
                                                            <td className="px-4 py-4 align-top">
                                                                {line.product ? (
                                                                    <span className="inline-flex items-center rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-800 shadow-sm">
                                                                        {
                                                                            line
                                                                                .product
                                                                                .satuan
                                                                        }
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-xs text-gray-400">
                                                                        -
                                                                    </span>
                                                                )}
                                                            </td>

                                                            {/* Qty Masuk */}
                                                            <td className="px-4 py-4 align-top">
                                                                <input
                                                                    type="text"
                                                                    inputMode="decimal"
                                                                    value={
                                                                        line.qty
                                                                    }
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        handleQtyChange(
                                                                            line.id,
                                                                            e
                                                                                .target
                                                                                .value,
                                                                        )
                                                                    }
                                                                    className="shadow-inner w-full rounded-lg border border-gray-300 px-3 py-2 text-right text-sm transition duration-150 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                                    placeholder="0.00"
                                                                />
                                                            </td>

                                                            {/* Harga satuan */}
                                                            <td className="px-4 py-4 align-top text-right">
                                                                {line.product ? (
                                                                    <span className="whitespace-nowrap text-sm font-medium text-gray-700">
                                                                        Rp{" "}
                                                                        {formatRupiah(
                                                                            line
                                                                                .product
                                                                                .harga_idr,
                                                                        )}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-xs text-gray-400">
                                                                        -
                                                                    </span>
                                                                )}
                                                            </td>

                                                            {/* Total per baris */}
                                                            <td className="px-4 py-4 align-top text-right">
                                                                {line.product &&
                                                                    lineTotal > 0 ? (
                                                                    <span className="whitespace-nowrap text-sm font-extrabold text-indigo-700">
                                                                        Rp{" "}
                                                                        {formatRupiah(
                                                                            lineTotal,
                                                                        )}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-xs text-gray-400">
                                                                        -
                                                                    </span>
                                                                )}
                                                            </td>

                                                            {/* Hapus baris */}
                                                            <td className="px-4 py-4 align-top">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleRemoveLine(
                                                                            line.id,
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        lines.length ===
                                                                        1
                                                                    }
                                                                    className="inline-flex items-center justify-center rounded-full bg-red-100 p-2 text-xs text-red-600 transition duration-150 hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-30"
                                                                    title={
                                                                        lines.length ===
                                                                            1
                                                                            ? "Minimal satu baris"
                                                                            : "Hapus baris ini"
                                                                    }
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>

                                            {/* Summary total nilai stok */}
                                            <tfoot className="border-t-4 border-indigo-200/80 bg-indigo-50 shadow-inner">
                                                <tr>
                                                    <td
                                                        colSpan={5}
                                                        className="px-4 py-4 text-right text-lg font-extrabold text-gray-700"
                                                    >
                                                        TOTAL NILAI STOK MASUK
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-4 text-2xl font-extrabold text-indigo-700">
                                                        Rp{" "}
                                                        {formatRupiah(
                                                            grandTotal,
                                                        )}
                                                    </td>
                                                    <td />
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>

                                    {/* Tambah baris */}
                                    <div className="flex items-center justify-between rounded-b-xl border-t border-gray-200 bg-gray-50 p-4">
                                        <button
                                            type="button"
                                            onClick={handleAddLine}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-md transition duration-150 hover:bg-indigo-600"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Tambah Baris Produk
                                        </button>
                                        <span className="text-xs text-gray-500">
                                            Total Baris Aktif:{" "}
                                            {lines.length}
                                        </span>
                                    </div>
                                </div>

                                {/* Tombol submit */}
                                <div className="flex justify-end pt-4">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="inline-flex transform items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-3.5 text-lg font-bold text-white shadow-2xl shadow-indigo-500/50 transition duration-300 hover:scale-[1.01] hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-4 focus:ring-indigo-300 disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500 disabled:shadow-none"
                                    >
                                        <Save className="h-6 w-6" />
                                        {isSubmitting
                                            ? "Memproses Data..."
                                            : "Konfirmasi & Simpan Stok"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </main>

                    <Footer />
                </div>
            </div>
        </div>
    );
}
