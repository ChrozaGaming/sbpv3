import React, {
    useState,
    useCallback,
    useRef,
    useEffect,
    FormEvent,
} from "react";
import {
    MapPin,
    Package,
    Save,
    AlertTriangle,
    CheckCircle,
} from "lucide-react";

import { JENIS_PEMASUKAN_OPTIONS, LOKASI_OPTIONS } from "./constant";
import type { JenisPemasukan, Product, StockLine } from "./types";
import { StockLinesTable } from "./components/StockLineTables";

// Gunakan env NEXT_PUBLIC_API_BASE (tanpa /api di belakang)
const API_BASE_URL =
    (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") as string | undefined) ??
    "http://localhost:8080";

// Icon Calendar lokal (sesuai versi awal)
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

export const TambahStokForm: React.FC = () => {
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

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setFormError(null);
        setFormSuccess(null);

        const validItems = lines
            .filter((line) => line.product && line.qty !== "" && Number(line.qty) > 0)
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

    // Bersihkan timeout debounce saat unmount
    useEffect(() => {
        return () => {
            Object.values(searchDebounceRef.current).forEach((id) =>
                window.clearTimeout(id),
            );
        };
    }, []);

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <header className="border-b-2 border-indigo-100 pb-4">
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
                    Pencatatan Stok Masuk
                </h1>
                <p className="mt-2 text-sm sm:text-base text-gray-500">
                    Isi detail transaksi dan item produk untuk mencatat pergerakan stok
                    (Stock-In).
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
                        <p className="font-bold text-red-800">Gagal Memproses</p>
                        <p className="text-red-700">{formError}</p>
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
                        <p className="font-bold text-green-800">Berhasil!</p>
                        <p className="text-green-700">{formSuccess}</p>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
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
                                <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="lokasi"
                                value={lokasi}
                                onChange={(e) => setLokasi(e.target.value)}
                                className="shadow-inner rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition duration-150 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                            <p className="mt-1 text-xs text-gray-500">
                                Pilih gudang tempat stok fisik disimpan.
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
                                <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="jenisPemasukan"
                                value={jenisPemasukan}
                                onChange={(e) =>
                                    setJenisPemasukan(e.target.value as JenisPemasukan)
                                }
                                className="shadow-inner rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition duration-150 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {JENIS_PEMASUKAN_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-gray-500">
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
                                className="flex items-center gap-1 text-sm font-medium text-gray-700"
                            >
                                <Calendar className="h-4 w-4 text-indigo-500" />
                                Tanggal Transaksi{" "}
                                <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="tanggal"
                                type="date"
                                value={tanggal}
                                onChange={(e) => setTanggal(e.target.value)}
                                className="shadow-inner rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition duration-150 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                required
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Tanggal pencatatan stok. Sesuaikan jika <i>backdate</i>.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Bagian 2: Tabel Input Stok */}
                <StockLinesTable
                    lines={lines}
                    jenisPemasukan={jenisPemasukan}
                    grandTotal={grandTotal}
                    onAddLine={handleAddLine}
                    onRemoveLine={handleRemoveLine}
                    onKodeChange={handleKodeChange}
                    onQtyChange={handleQtyChange}
                    onFetchProductExact={fetchProductByKode}
                    onSelectSuggestion={handleSelectSuggestion}
                />

                {/* Tombol submit */}
                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex transform items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-3.5 text-lg font-bold text-white shadow-2xl shadow-indigo-500/50 transition duration-300 hover:scale-[1.01] hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-4 focus:ring-indigo-300 disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500 disabled:shadow-none"
                    >
                        <Save className="h-6 w-6" />
                        {isSubmitting ? "Memproses Data..." : "Konfirmasi & Simpan Stok"}
                    </button>
                </div>
            </form>
        </div>
    );
};
