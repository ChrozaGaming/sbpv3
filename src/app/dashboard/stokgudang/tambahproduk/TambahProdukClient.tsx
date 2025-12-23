"use client";

import React, {
    useEffect,
    useState,
    useCallback,
    useMemo,
} from "react";
import {
    CheckCircle2,
    Loader2,
    ChevronDown,
    X,
    RotateCcw,
    PackagePlus,
    Search,
} from "lucide-react";

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

import {
    KATEGORI_OPTIONS,
    SATUAN_OPTIONS,
    Kategori,
    Satuan,
    SortKey,
    SortDir,
    Product,
    ProductFromApi,
    FormState,
    NotificationState,
    TambahProdukClientProps,
    normalizeProductFromApi,
    formatNumberString,
} from "./components/productTypes";

import { NotificationContainer } from "./components/Notification";
import { ProductTable } from "./components/ProductTable";

/**
 * NORMALISASI NAMA PRODUK UNTUK INPUT (LIVE-TYPING)
 *
 * - Tidak trim kiri-kanan
 * - Tidak menghapus spasi ganda
 * - Tidak mengubah posisi spasi / "-" / "_"
 * - Hanya mengatur huruf besar-kecil:
 *   - Jika sebuah token huruf semua kapital -> biarkan kapital (RSG)
 *   - Selain itu: huruf alfabet pertama kapital, sisanya huruf kecil
 */
function normalizeProductNameForInput(raw: string): string {
    if (!raw) return "";

    // Pisah berdasarkan spasi / strip / underscore, tetapi simpan separatornya
    const tokens = raw.split(/([ _-]+)/); // contoh: "Cat  RSG-Test" -> ["Cat", "  ", "RSG", "-", "Test"]

    const normalizedTokens = tokens.map((tok) => {
        if (!tok) return tok;

        // Jika hanya spasi / strip / underscore -> biarkan apa adanya
        if (/^[ _-]+$/.test(tok)) {
            return tok;
        }

        // Ambil hanya huruf untuk cek apakah singkatan (all caps)
        const letters = tok.replace(/[^A-Za-z]/g, "");

        // Jika ada huruf & semuanya kapital -> singkatan, biarkan kapital
        if (letters && letters === letters.toUpperCase()) {
            return tok.toUpperCase();
        }

        // Title-case: huruf alfabet pertama kapital, sisanya lower
        let result = "";
        let firstAlphaDone = false;

        for (let i = 0; i < tok.length; i++) {
            const ch = tok[i];

            if (/[A-Za-z]/.test(ch)) {
                if (!firstAlphaDone) {
                    result += ch.toUpperCase();
                    firstAlphaDone = true;
                } else {
                    result += ch.toLowerCase();
                }
            } else {
                // angka / simbol lain tetap sama
                result += ch;
            }
        }

        return result;
    });

    return normalizedTokens.join("");
}

/**
 * NORMALISASI NAMA PRODUK UNTUK DISIMPAN DI DB
 *
 * - Panggil normalisasi untuk input
 * - Trim kiri-kanan
 * - Rapikan spasi berlebih menjadi satu spasi
 */
function normalizeProductNameForSave(raw: string): string {
    const normalized = normalizeProductNameForInput(raw);
    // Ganti banyak spasi berturut-turut menjadi satu spasi
    const collapsed = normalized.replace(/\s+/g, " ");
    return collapsed.trim();
}

// --- MAIN COMPONENT ---

export default function TambahProdukClient({
    initialProducts,
}: TambahProdukClientProps) {
    const [open, setOpen] = useState(true);

    const [form, setForm] = useState<FormState>({
        kode: "",
        nama: "",
        brand: "",
        kategori: "",
        satuan: "",
        harga_idr: "",
    });

    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(false);

    const [notifications, setNotifications] = useState<NotificationState[]>([]);

    const [savedProducts, setSavedProducts] = useState<Product[]>(() =>
        (initialProducts || []).map(normalizeProductFromApi),
    );

    const [search, setSearch] = useState("");
    const [filterKategori, setFilterKategori] = useState<Kategori | "">("");
    const [sortBy, setSortBy] = useState<SortKey>("nama");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const backendUrl =
        process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

    // --- Notification helpers ---

    const addNotification = useCallback(
        (message: string, type: "success" | "error") => {
            const id = Date.now();

            setNotifications((prev) => [...prev, { id, message, type }]);

            setTimeout(
                () =>
                    setNotifications((prev) =>
                        prev.filter((n) => n.id !== id),
                    ),
                5000,
            );
        },
        [],
    );

    const removeNotification = (id: number) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    };

    // --- Form helpers ---

    const resetForm = useCallback(() => {
        setForm({
            kode: "",
            nama: "",
            brand: "",
            kategori: "",
            satuan: "",
            harga_idr: "",
        });
        setEditingProduct(null);
    }, []);

    const upsertProduct = useCallback((p: Product) => {
        setSavedProducts((prev) => {
            const idx = prev.findIndex((x) => x.id === p.id);
            if (idx === -1) return [...prev, p];
            const clone = [...prev];
            clone[idx] = p;
            return clone;
        });
    }, []);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => {
        const { name, value } = e.target;

        // kode & brand selalu UPPERCASE
        if (name === "kode" || name === "brand") {
            setForm((prev) => ({
                ...prev,
                [name]: value.toUpperCase(),
            }));
            return;
        }

        // nama produk: normalisasi live (TitleCase + singkatan CAPS)
        if (name === "nama") {
            setForm((prev) => ({
                ...prev,
                nama: normalizeProductNameForInput(value),
            }));
            return;
        }

        if (name === "harga_idr") {
            const digitsOnly = value.replace(/\D/g, "");

            if (digitsOnly) {
                try {
                    const numberValue = Number(digitsOnly);
                    const formatted =
                        numberValue > 9007199254740991
                            ? digitsOnly
                            : new Intl.NumberFormat("id-ID").format(numberValue);

                    setForm((prev) => ({ ...prev, [name]: formatted }));
                } catch {
                    setForm((prev) => ({ ...prev, [name]: digitsOnly }));
                }
            } else {
                setForm((prev) => ({ ...prev, [name]: "" }));
            }
        } else {
            setForm((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleEdit = (product: Product) => {
        setEditingProduct(product);

        setForm({
            kode: product.kode.toUpperCase(),
            // Untuk jaga-jaga kalau data lama belum rapi, tetap normalisasi lagi
            nama: normalizeProductNameForInput(product.nama),
            brand: product.brand.toUpperCase(),
            kategori: product.kategori,
            satuan: product.satuan,
            harga_idr: formatNumberString(product.harga_idr),
        });

        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleDelete = async (id: number, name: string) => {
        // Konfirmasi hapus sudah di-handle di ProductTable (SweetAlert2),
        // jadi di sini langsung eksekusi delete ke backend.
        setLoading(true);

        try {
            const res = await fetch(`${backendUrl}/api/product/${id}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                let msg = "Gagal menghapus produk. Silakan coba lagi.";

                try {
                    const data = await res.json();
                    if (data?.message) msg = data.message;
                } catch {
                    // ignore
                }

                throw new Error(msg);
            }

            setSavedProducts((prev) => prev.filter((p) => p.id !== id));
            addNotification(`Produk "${name}" berhasil dihapus.`, "success");

            if (editingProduct?.id === id) {
                resetForm();
            }
        } catch (err) {
            addNotification(
                err instanceof Error
                    ? err.message
                    : "Terjadi error saat menghapus produk.",
                "error",
            );
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.kode || !form.nama || !form.kategori || !form.satuan) {
            addNotification("Kolom bertanda * wajib diisi.", "error");
            return;
        }

        // Normalisasi nama produk untuk disimpan
        const normalizedName = normalizeProductNameForSave(form.nama);

        if (!normalizedName) {
            addNotification(
                "Nama produk tidak boleh kosong atau hanya berisi spasi.",
                "error",
            );
            return;
        }

        const hargaNum = parseInt(form.harga_idr.replace(/\D/g, ""), 10);
        if (Number.isNaN(hargaNum) || hargaNum < 100) {
            addNotification(
                "Harga Satuan (IDR) tidak valid atau terlalu rendah.",
                "error",
            );
            return;
        }

        const isCodeDuplicate = savedProducts.some(
            (p) =>
                p.kode.toUpperCase() === form.kode.trim().toUpperCase() &&
                p.id !== editingProduct?.id,
        );

        if (!editingProduct && isCodeDuplicate) {
            addNotification(
                `Kode produk "${form.kode}" sudah terdaftar untuk produk lain.`,
                "error",
            );
            return;
        }

        setLoading(true);

        try {
            const payload = {
                kode: form.kode.trim().toUpperCase(),
                nama: normalizedName, // sudah dinormalisasi & dirapikan
                brand: (form.brand.trim() || "-").toUpperCase(),
                kategori: form.kategori as Kategori,
                satuan: form.satuan as Satuan,
                harga_idr: hargaNum,
            };

            let res: Response;

            if (editingProduct) {
                res = await fetch(`${backendUrl}/api/product/${editingProduct.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        nama: payload.nama,
                        brand: payload.brand,
                        kategori: payload.kategori,
                        satuan: payload.satuan,
                        harga_idr: payload.harga_idr,
                    }),
                });
            } else {
                res = await fetch(`${backendUrl}/api/product`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            }

            if (!res.ok) {
                let msg = editingProduct
                    ? "Gagal memperbarui produk."
                    : "Gagal menyimpan produk baru.";

                try {
                    const data = await res.json();
                    if (data?.message) msg = data.message;
                } catch {
                    // ignore
                }

                throw new Error(msg);
            }

            const data = (await res.json()) as ProductFromApi;
            const norm = normalizeProductFromApi(data);

            upsertProduct(norm);

            addNotification(
                editingProduct
                    ? `Produk "${norm.nama}" berhasil diperbarui!`
                    : `Produk "${norm.nama}" berhasil disimpan!`,
                "success",
            );

            resetForm();
        } catch (err) {
            addNotification(
                err instanceof Error
                    ? err.message
                    : "Terjadi kesalahan saat menyimpan/memperbarui produk.",
                "error",
            );
        } finally {
            setLoading(false);
        }
    };

    // --- WebSocket realtime sync ---

    useEffect(() => {
        const proto = backendUrl.startsWith("https") ? "wss" : "ws";
        const wsUrl = backendUrl.replace(/^https?/, proto) + "/ws";

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log("[WS product] connected:", wsUrl);
        };

        ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                if (!msg?.event) return;

                switch (msg.event) {
                    case "product_created":
                    case "product_updated": {
                        const apiProduct = msg.data as ProductFromApi;
                        const p = normalizeProductFromApi(apiProduct);

                        setSavedProducts((prev) => {
                            const idx = prev.findIndex((x) => x.id === p.id);
                            if (idx === -1) return [...prev, p];
                            const clone = [...prev];
                            clone[idx] = p;
                            return clone;
                        });
                        break;
                    }

                    case "product_deleted": {
                        const data = msg.data as { id: number; kode: string };
                        setSavedProducts((prev) => prev.filter((p) => p.id !== data.id));
                        break;
                    }
                }
            } catch {
                // abaikan jika bukan JSON
            }
        };

        ws.onclose = () => {
            console.log("[WS product] disconnected");
        };

        return () => ws.close();
    }, [backendUrl]);

    // Reset page kalau search / filter berubah
    useEffect(() => {
        setCurrentPage(1);
    }, [search, filterKategori]);

    // --- Filtering, Sorting, Pagination ---

    const filteredProducts = useMemo(() => {
        let result = savedProducts;

        if (search) {
            const q = search.toLowerCase();
            result = result.filter(
                (p) =>
                    p.kode.toLowerCase().includes(q) ||
                    p.nama.toLowerCase().includes(q) ||
                    p.brand.toLowerCase().includes(q) ||
                    p.kategori.toLowerCase().includes(q),
            );
        }

        if (filterKategori) {
            result = result.filter((p) => p.kategori === filterKategori);
        }

        return result;
    }, [savedProducts, search, filterKategori]);

    const sortedProducts = useMemo(() => {
        const result = [...filteredProducts];

        result.sort((a, b) => {
            let comp = 0;

            switch (sortBy) {
                case "id":
                    comp = a.id - b.id;
                    break;
                case "kode":
                    comp = a.kode.localeCompare(b.kode);
                    break;
                case "nama":
                    comp = a.nama.localeCompare(b.nama);
                    break;
                case "brand":
                    comp = a.brand.localeCompare(b.brand);
                    break;
                case "kategori":
                    comp = a.kategori.localeCompare(b.kategori);
                    break;
                case "harga_idr":
                    comp = a.harga_idr - b.harga_idr;
                    break;
            }

            return sortDir === "asc" ? comp : -comp;
        });

        return result;
    }, [filteredProducts, sortBy, sortDir]);

    const pageCount = Math.max(1, Math.ceil(sortedProducts.length / itemsPerPage));
    const safeCurrentPage = Math.min(currentPage, pageCount);
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    const pageItems = sortedProducts.slice(
        startIndex,
        startIndex + itemsPerPage,
    );

    const handleSort = (key: SortKey) => {
        setSortBy((prevKey) => {
            if (prevKey === key) {
                setSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
                return prevKey;
            }
            setSortDir("asc");
            return key;
        });
    };

    const handleGoToPage = (page: number) => {
        if (page < 1 || page > pageCount) return;
        setCurrentPage(page);
    };

    // --- UI helpers ---

    const inputClass =
        "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm transition focus:outline-none focus:ring-4 focus:ring-blue-200/60 focus:border-blue-600 placeholder:text-slate-400 disabled:bg-slate-100 disabled:cursor-not-allowed shadow-inner";

    const labelClass =
        "block text-sm font-semibold text-slate-700 mb-2";

    const submitBaseClass =
        "w-full sm:w-auto min-w-[220px] flex items-center justify-center gap-2 px-8 py-3 rounded-full text-sm font-bold text-white shadow-xl disabled:opacity-70 disabled:cursor-not-allowed transition transform hover:scale-[1.02]";

    const submitVariantClass = editingProduct
        ? "bg-orange-500 hover:bg-orange-600 shadow-orange-500/50"
        : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/50";

    return (
        <div className="flex h-dvh w-full max-w-full bg-slate-100 text-slate-800 overflow-hidden">
            {/* Sidebar */}
            <div className="shrink-0">
                <Sidebar open={open} setOpen={setOpen} />
            </div>

            {/* Main */}
            <div className="flex flex-col flex-1 min-w-0 w-full">
                <Header onToggle={() => setOpen(!open)} />

                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <main className="p-4 md:p-8 max-w-7xl mx-auto w-full font-inter">
                        <NotificationContainer
                            notifications={notifications}
                            removeNotification={removeNotification}
                        />

                        {/* Header Section */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-4 border-b border-slate-200 gap-4">
                            <div>
                                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                                    <PackagePlus size={30} className="text-blue-600" />
                                    Master Data Produk
                                </h1>
                                <p className="text-slate-500 mt-1 text-sm md:text-base max-w-xl">
                                    Modul registrasi dan pemeliharaan master produk
                                    untuk kebutuhan inventory dan operasional gudang.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                <div className="relative bg-white border border-slate-300 px-3 py-2 rounded-xl flex items-center shadow-sm">
                                    <Search size={16} className="text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Cari nama, kode, brand, kategori..."
                                        className="bg-transparent border-none outline-none text-xs md:text-sm ml-2 w-full text-slate-700"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Form Card */}
                        <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl shadow-blue-100/50 p-6 md:p-8">
                            {editingProduct && (
                                <div className="mb-6 p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs md:text-sm font-medium text-amber-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                                    <span className="flex items-center gap-2">
                                        <X size={16} />
                                        Mode EDIT produk:{" "}
                                        <span className="font-semibold">
                                            {editingProduct.nama} ({editingProduct.kode})
                                        </span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 font-semibold text-xs"
                                    >
                                        <X size={14} /> Batalkan Edit
                                    </button>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-10">
                                {/* Section 1: Detail */}
                                <div className="space-y-6 border-b pb-6 border-slate-100">
                                    <h2 className="text-lg md:text-xl font-bold text-blue-800 border-l-4 border-orange-500 pl-3">
                                        1. Detail Produk Dasar
                                    </h2>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div>
                                            <label htmlFor="kode" className={labelClass}>
                                                Kode Produk <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                id="kode"
                                                type="text"
                                                name="kode"
                                                value={form.kode}
                                                onChange={handleChange}
                                                className={inputClass}
                                                placeholder="Contoh: RES-STD-A"
                                                required
                                                disabled={loading || !!editingProduct}
                                            />
                                            {editingProduct && (
                                                <p className="mt-1 text-[10px] text-slate-400">
                                                    Kode produk tidak dapat diubah pada mode edit.
                                                </p>
                                            )}
                                        </div>

                                        <div className="md:col-span-2">
                                            <label htmlFor="nama" className={labelClass}>
                                                Nama Produk <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                id="nama"
                                                type="text"
                                                name="nama"
                                                value={form.nama}
                                                onChange={handleChange}
                                                className={inputClass}
                                                placeholder='Contoh: Cat Avian Ducatex, Cat RSG, Tess-Tess'
                                                required
                                                disabled={loading}
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="brand" className={labelClass}>
                                                Brand / Merek
                                            </label>
                                            <input
                                                id="brand"
                                                type="text"
                                                name="brand"
                                                value={form.brand}
                                                onChange={handleChange}
                                                className={inputClass}
                                                placeholder="Contoh: SBP CHEM, NIPPON, BOSCH (Opsional)"
                                                disabled={loading}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Klasifikasi & Harga */}
                                <div className="space-y-6">
                                    <h2 className="text-lg md:text-xl font-bold text-blue-800 border-l-4 border-orange-500 pl-3">
                                        2. Klasifikasi & Harga
                                    </h2>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div>
                                            <label htmlFor="kategori" className={labelClass}>
                                                Kategori Produk{" "}
                                                <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <select
                                                    id="kategori"
                                                    name="kategori"
                                                    value={form.kategori}
                                                    onChange={handleChange}
                                                    className={`${inputClass} appearance-none cursor-pointer`}
                                                    required
                                                    disabled={loading}
                                                >
                                                    <option value="" disabled className="text-slate-400">
                                                        -- Pilih kategori --
                                                    </option>
                                                    {KATEGORI_OPTIONS.map((opt) => (
                                                        <option key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronDown
                                                    size={18}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label htmlFor="satuan" className={labelClass}>
                                                Satuan Dasar{" "}
                                                <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <select
                                                    id="satuan"
                                                    name="satuan"
                                                    value={form.satuan}
                                                    onChange={handleChange}
                                                    className={`${inputClass} appearance-none cursor-pointer`}
                                                    required
                                                    disabled={loading}
                                                >
                                                    <option value="" disabled className="text-slate-400">
                                                        -- Pilih satuan --
                                                    </option>
                                                    {SATUAN_OPTIONS.map((opt) => (
                                                        <option key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronDown
                                                    size={18}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label htmlFor="harga_idr" className={labelClass}>
                                                Harga Satuan (IDR){" "}
                                                <span className="text-red-500">*</span>
                                            </label>

                                            <div
                                                className={`flex items-center rounded-xl border border-slate-300 bg-white transition px-4 py-3 shadow-inner ${!loading
                                                    ? "focus-within:ring-4 focus-within:ring-blue-200/70 focus-within:border-blue-600"
                                                    : "bg-slate-100"
                                                    }`}
                                            >
                                                <span className="text-sm font-bold text-slate-500 mr-2 shrink-0">
                                                    Rp
                                                </span>
                                                <input
                                                    id="harga_idr"
                                                    type="text"
                                                    inputMode="numeric"
                                                    name="harga_idr"
                                                    value={form.harga_idr}
                                                    onChange={handleChange}
                                                    className="flex-1 bg-transparent border-none outline-none text-sm text-slate-800 w-full p-0 disabled:text-slate-500"
                                                    placeholder="Contoh: 120.000"
                                                    required
                                                    disabled={loading}
                                                />
                                            </div>

                                            <p className="mt-1 text-[11px] text-slate-400">
                                                Masukkan angka saja (contoh: 120000).
                                                Sistem akan memformat otomatis.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4">
                                    {editingProduct ? (
                                        <button
                                            type="button"
                                            onClick={resetForm}
                                            className="w-full sm:w-auto px-7 py-3 rounded-full text-sm font-semibold border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 transition shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
                                            disabled={loading}
                                        >
                                            <RotateCcw size={18} /> Batalkan Edit
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={resetForm}
                                            className="w-full sm:w-auto px-7 py-3 rounded-full text-sm font-semibold border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 transition shadow-md hover:shadow-lg disabled:opacity-50"
                                            disabled={loading}
                                        >
                                            Reset Formulir
                                        </button>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className={`${submitBaseClass} ${submitVariantClass}`}
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 size={18} className="animate-spin" />
                                                {editingProduct
                                                    ? "Memperbarui Data..."
                                                    : "Menyimpan Data..."}
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 size={18} className="stroke-white" />
                                                {editingProduct ? "UPDATE PRODUK" : "SIMPAN PRODUK"}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Table + Pagination */}
                        <ProductTable
                            products={pageItems}
                            totalItems={sortedProducts.length}
                            startIndex={startIndex}
                            currentPage={safeCurrentPage}
                            pageCount={pageCount}
                            sortBy={sortBy}
                            sortDir={sortDir}
                            onSort={handleSort}
                            onPageChange={handleGoToPage}
                            filterKategori={filterKategori}
                            onFilterKategoriChange={setFilterKategori}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                        />
                    </main>

                    <Footer />
                </div>
            </div>
        </div>
    );
}
