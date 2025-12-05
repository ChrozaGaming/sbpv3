// /src/app/dashboard/stokgudang/tambahstok/page.tsx
"use client";

import { useState, useCallback, useRef } from "react";
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

// Gunakan env NEXT_PUBLIC_API_BASE (tanpa /api di belakang)
// NEXT_PUBLIC_API_BASE=http://localhost:8080
const API_BASE_URL =
    (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") as string | undefined) ??
    "http://localhost:8080";

type JenisPemasukan = "pembelian_po" | "retur_barang";

const JENIS_PEMASUKAN_OPTIONS: {
    value: JenisPemasukan;
    label: string;
    description: string;
}[] = [
        {
            value: "pembelian_po",
            label: "Pembelian via PO",
            description: "Stok masuk karena pembelian dari supplier berdasarkan PO.",
        },
        {
            value: "retur_barang",
            label: "Retur Barang",
            description: "Stok masuk karena retur dari proyek / customer.",
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

export default function TambahStokPage() {
    const [lokasi, setLokasi] = useState<string>(""); // sekarang pakai dropdown
    const [jenisPemasukan, setJenisPemasukan] =
        useState<JenisPemasukan>("pembelian_po");
    const [tanggal, setTanggal] = useState(
        () => new Date().toISOString().slice(0, 10),
    );
    const [lines, setLines] = useState<StockLine[]>([createEmptyLine()]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [formSuccess, setFormSuccess] = useState<string | null>(null);

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

            // tetap kirim q (kalau kosong, backend boleh atur logic sendiri)
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
                    error: data.length === 0 ? "Produk tidak ditemukan." : undefined,
                }));
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : "Gagal mencari produk.";
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

        // update local state line
        updateLine(id, (prev) => ({
            ...prev,
            kode: upper,
            product: undefined,
            error: undefined,
        }));

        // bersihkan timeout lama kalau ada
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

        // set timeout baru (debounce 300ms)
        const timeoutId = window.setTimeout(() => {
            fetchSuggestionsByKode(id, trimmed);
        }, 300);

        searchDebounceRef.current[id] = timeoutId;
    };

    const handleQtyChange = (id: string, value: string) => {
        // Hanya izinkan angka & desimal
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
                    `${API_BASE_URL}/api/product/by-kode/${encodeURIComponent(kode)}`,
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
                    err instanceof Error ? err.message : "Gagal mengambil data produk.";
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
            .filter((line) => line.product && line.qty !== "" && Number(line.qty) > 0)
            .map((line) => ({
                product_id: line.product!.id,
                product_kode: line.product!.kode,
                qty: Number(line.qty), // backend: i32
                satuan: line.product!.satuan, // untuk cross-check di Rust
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
            tanggal, // "YYYY-MM-DD" → NaiveDate
            lokasi: lokasi.trim(),
            jenis_pemasukan: jenisPemasukan, // "pembelian_po" | "retur_barang"
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

            setFormSuccess("Stok masuk berhasil disimpan ke stockmovement & stok.");
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

    // Komponen untuk Status (Loading/Error/Success)
    const LineStatus = ({ line }: { line: StockLine }) => {
        if (line.isFetching) {
            return (
                <span className="text-xs text-indigo-500 flex items-center gap-1 mt-1">
                    <Search className="w-3 h-3 animate-pulse" /> Mencari...
                </span>
            );
        }
        if (line.error) {
            return (
                <p className="text-[10px] text-red-600 mt-1 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    {line.error}
                </p>
            );
        }
        if (line.product) {
            return (
                <p className="text-[10px] text-teal-600 mt-1 flex items-start gap-1">
                    <CheckCircle className="w-3 h-3 flex-shrink-0" />
                    Produk terdeteksi
                </p>
            );
        }
        return null;
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-inter">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header Section */}
                <header className="pb-4 border-b-2 border-indigo-100">
                    <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">
                        Pencatatan Stok Masuk
                    </h1>
                    <p className="text-base text-gray-500 mt-2">
                        Isi detail transaksi dan item produk untuk mencatat pergerakan stok
                        (Stock-In).
                    </p>
                </header>

                {/* Status/Feedback */}
                {formError && (
                    <div
                        className="rounded-xl border border-red-400 bg-red-50 p-4 flex items-start gap-3 shadow-md"
                        role="alert"
                    >
                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-bold text-red-800">Gagal Memproses</p>
                            <p className="text-red-700">{formError}</p>
                        </div>
                    </div>
                )}
                {formSuccess && (
                    <div
                        className="rounded-xl border border-green-400 bg-green-50 p-4 flex items-start gap-3 shadow-md"
                        role="alert"
                    >
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-bold text-green-800">Berhasil!</p>
                            <p className="text-green-700">{formSuccess}</p>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Bagian 1: Informasi Transaksi (Card) */}
                    <div className="bg-white p-6 rounded-xl shadow-2xl shadow-gray-200 border border-gray-100">
                        <h2 className="text-xl font-bold text-gray-800 mb-5 pb-3 border-b border-gray-100 flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-indigo-600" />
                            Detail Transaksi
                        </h2>
                        <div className="grid gap-8 md:grid-cols-3">
                            {/* Lokasi */}
                            <div className="flex flex-col space-y-1">
                                <label
                                    htmlFor="lokasi"
                                    className="text-sm font-medium text-gray-700 flex items-center gap-1"
                                >
                                    <MapPin className="w-4 h-4 text-indigo-500" />
                                    Lokasi Penyimpanan <span className="text-red-500">*</span>
                                </label>
                                <select
                                    id="lokasi"
                                    value={lokasi}
                                    onChange={(e) => setLokasi(e.target.value)}
                                    className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 shadow-sm"
                                    required
                                >
                                    {LOKASI_OPTIONS.map((opt) => (
                                        <option
                                            key={opt.value || "placeholder"}
                                            value={opt.value}
                                            disabled={opt.value === ""}
                                        >
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    Pilih gudang tempat stok fisik disimpan.
                                </p>
                            </div>

                            {/* Jenis Pemasukan */}
                            <div className="flex flex-col space-y-1">
                                <label
                                    htmlFor="jenisPemasukan"
                                    className="text-sm font-medium text-gray-700 flex items-center gap-1"
                                >
                                    <Package className="w-4 h-4 text-indigo-500" />
                                    Jenis Pemasukan <span className="text-red-500">*</span>
                                </label>
                                <select
                                    id="jenisPemasukan"
                                    value={jenisPemasukan}
                                    onChange={(e) =>
                                        setJenisPemasukan(e.target.value as JenisPemasukan)
                                    }
                                    className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 shadow-sm"
                                >
                                    {JENIS_PEMASUKAN_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    {
                                        JENIS_PEMASUKAN_OPTIONS.find(
                                            (opt) => opt.value === jenisPemasukan,
                                        )?.description
                                    }
                                </p>
                            </div>

                            {/* Tanggal Transaksi */}
                            <div className="flex flex-col space-y-1">
                                <label
                                    htmlFor="tanggal"
                                    className="text-sm font-medium text-gray-700 flex items-center gap-1"
                                >
                                    <Calendar className="w-4 h-4 text-indigo-500" />
                                    Tanggal Transaksi <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="tanggal"
                                    type="date"
                                    value={tanggal}
                                    onChange={(e) => setTanggal(e.target.value)}
                                    className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 shadow-sm"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Tanggal pencatatan stok. Sesuaikan jika <i>backdate</i>.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Bagian 2: Tabel Input Stok (Card) */}
                    <div
                        id="stock-table-container"
                        className="bg-white rounded-xl shadow-2xl shadow-gray-200 border border-gray-100"
                    >
                        <div className="p-6">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <Package className="w-5 h-5 text-indigo-600" />
                                Daftar Produk Masuk
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Cari produk (Kode Produk) dan tentukan jumlah (QTY) yang
                                masuk.
                            </p>
                        </div>

                        {/* overflow-x saja, vertikal dibiarkan visible supaya card memanjang */}
                        <div className="overflow-x-auto overflow-y-visible">
                            <table className="min-w-full text-sm divide-y divide-gray-200">
                                <thead className="bg-gray-100 sticky top-0 shadow-inner">
                                    <tr>
                                        <th className="px-4 py-3 text-left w-60 sm:w-72 font-bold text-gray-700 whitespace-nowrap">
                                            Kode Produk
                                        </th>
                                        <th className="px-4 py-3 text-left min-w-[200px] font-bold text-gray-700">
                                            Nama Produk &amp; Detail
                                        </th>
                                        <th className="px-4 py-3 text-left w-24 font-bold text-gray-700">
                                            Satuan
                                        </th>
                                        <th className="px-4 py-3 text-right w-28 font-bold text-gray-700">
                                            Qty Masuk
                                        </th>
                                        <th className="px-4 py-3 text-right w-36 font-bold text-gray-700 whitespace-nowrap">
                                            Harga Satuan
                                        </th>
                                        <th className="px-4 py-3 text-right w-36 font-bold text-gray-700">
                                            Total
                                        </th>
                                        <th className="px-4 py-3 text-left w-10" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {lines.map((line) => {
                                        const qtyNum = parseFloat(line.qty || "0");
                                        const lineTotal =
                                            line.product && !isNaN(qtyNum) && qtyNum > 0
                                                ? qtyNum * line.product.harga_idr
                                                : 0;

                                        const rowClass = line.product
                                            ? "bg-white hover:bg-teal-50/40 transition duration-150"
                                            : "bg-white hover:bg-gray-50 transition duration-150";

                                        return (
                                            <tr key={line.id} className={rowClass}>
                                                {/* Kode Produk & Cari + Suggestions */}
                                                <td className="px-4 py-4 align-top">
                                                    {/* TANPA relative/absolute: dropdown ikut alur layout → card memanjang ke bawah */}
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={line.kode}
                                                            onChange={(e) =>
                                                                handleKodeChange(line.id, e.target.value)
                                                            }
                                                            onBlur={() => {
                                                                // Kalau belum ada product, kode terisi,
                                                                // dan tidak ada suggestions → coba exact lookup
                                                                if (
                                                                    !line.product &&
                                                                    line.kode.trim() &&
                                                                    line.suggestions.length === 0
                                                                ) {
                                                                    fetchProductByKode(line);
                                                                }
                                                            }}
                                                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase transition duration-150 shadow-inner"
                                                            placeholder="Ketik kode atau nama..."
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => fetchProductByKode(line)}
                                                            disabled={line.isFetching || !line.kode.trim()}
                                                            className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-150 shadow-md hover:shadow-lg"
                                                            title="Cari Produk (exact kode)"
                                                        >
                                                            {line.isFetching ? (
                                                                <span className="animate-spin">
                                                                    <Search className="w-3.5 h-3.5" />
                                                                </span>
                                                            ) : (
                                                                <Search className="w-3.5 h-3.5" />
                                                            )}
                                                        </button>
                                                    </div>

                                                    <LineStatus line={line} />

                                                    {/* DROPDOWN SEKARANG BLOK BIASA (BUKAN absolute) → tinggi row + card ikut naik */}
                                                    {line.showSuggestions &&
                                                        line.suggestions.length > 0 && (
                                                            <div className="mt-1 w-full max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg text-xs">
                                                                {line.suggestions.map((p) => (
                                                                    <button
                                                                        key={p.id}
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleSelectSuggestion(line.id, p)
                                                                        }
                                                                        className="w-full px-3 py-2 text-left hover:bg-indigo-50"
                                                                    >
                                                                        <div className="font-semibold text-gray-800">
                                                                            {p.kode} — {p.nama}
                                                                        </div>
                                                                        <div className="text-[11px] text-gray-500">
                                                                            Brand: {p.brand} • Kategori:{" "}
                                                                            {p.kategori} • Satuan: {p.satuan}
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                </td>

                                                {/* Info produk */}
                                                <td className="px-4 py-4 align-top">
                                                    {line.product ? (
                                                        <div className="space-y-0.5 border-l-2 border-teal-400 pl-3">
                                                            <div className="font-semibold text-gray-900 flex items-center gap-1">
                                                                {line.product.nama}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                <span className="font-medium">Brand:</span>{" "}
                                                                {line.product.brand} |{" "}
                                                                <span className="font-medium">Kategori:</span>{" "}
                                                                {line.product.kategori}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">
                                                            Masukkan kode / nama dan pilih dari suggestion
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Satuan */}
                                                <td className="px-4 py-4 align-top">
                                                    {line.product ? (
                                                        <span className="inline-flex items-center rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-800 shadow-sm">
                                                            {line.product.satuan}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">-</span>
                                                    )}
                                                </td>

                                                {/* Qty Masuk */}
                                                <td className="px-4 py-4 align-top">
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={line.qty}
                                                        onChange={(e) =>
                                                            handleQtyChange(line.id, e.target.value)
                                                        }
                                                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 shadow-inner"
                                                        placeholder="0.00"
                                                    />
                                                </td>

                                                {/* Harga satuan */}
                                                <td className="px-4 py-4 align-top text-right">
                                                    {line.product ? (
                                                        <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                                                            Rp {formatRupiah(line.product.harga_idr)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">-</span>
                                                    )}
                                                </td>

                                                {/* Total per baris */}
                                                <td className="px-4 py-4 align-top text-right">
                                                    {line.product && lineTotal > 0 ? (
                                                        <span className="text-sm font-extrabold text-indigo-700 whitespace-nowrap">
                                                            Rp {formatRupiah(lineTotal)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">-</span>
                                                    )}
                                                </td>

                                                {/* Hapus baris */}
                                                <td className="px-4 py-4 align-top">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveLine(line.id)}
                                                        disabled={lines.length === 1}
                                                        className="inline-flex items-center justify-center rounded-full p-2 text-xs text-red-600 bg-red-100 hover:bg-red-200 disabled:opacity-30 disabled:cursor-not-allowed transition duration-150"
                                                        title={
                                                            lines.length === 1
                                                                ? "Minimal satu baris"
                                                                : "Hapus baris ini"
                                                        }
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>

                                {/* Summary total nilai stok */}
                                <tfoot className="bg-indigo-50 border-t-4 border-indigo-200/80 shadow-inner">
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-4 py-4 text-right text-lg font-extrabold text-gray-700"
                                        >
                                            TOTAL NILAI STOK MASUK
                                        </td>
                                        <td className="px-4 py-4 text-2xl font-extrabold text-indigo-700 whitespace-nowrap shadow-text">
                                            Rp {formatRupiah(grandTotal)}
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Tambah baris */}
                        <div className="p-4 border-t border-gray-200 flex justify-between items-center bg-gray-50 rounded-b-xl">
                            <button
                                type="button"
                                onClick={handleAddLine}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition duration-150 shadow-md"
                            >
                                <Plus className="w-4 h-4" />
                                Tambah Baris Produk
                            </button>
                            <span className="text-xs text-gray-500">
                                Total Baris Aktif: {lines.length}
                            </span>
                        </div>
                    </div>

                    {/* Tombol submit */}
                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-3.5 text-lg font-bold text-white shadow-2xl shadow-indigo-500/50 hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-4 focus:ring-indigo-300 disabled:from-gray-400 disabled:to-gray-500 disabled:shadow-none disabled:cursor-not-allowed transition duration-300 transform hover:scale-[1.01]"
                        >
                            <Save className="w-6 h-6" />
                            {isSubmitting ? "Memproses Data..." : "Konfirmasi & Simpan Stok"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Icon Calendar
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
