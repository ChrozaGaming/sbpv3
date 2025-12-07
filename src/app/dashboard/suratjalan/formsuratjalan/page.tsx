// src/app/dashboard/suratjalan/formsuratjalan/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
    Plus,
    Trash2,
    Truck,
    Save,
    Search,
    X,
    Edit2,
    CheckCircle,
    FileText,
    ClipboardList,
    Info,
    PackageSearch,
    RefreshCw,
    AlertTriangle,
} from "lucide-react";

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

// --- CONFIG BACKEND ---
const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// --- INTERFACES ---
interface Barang {
    id: number;
    kode: string;
    nama: string;
    kategori: string;
    satuan: string;
    stok_sisa: number;
}

interface SelectedBarang extends Barang {
    jumlah: number; // kita treat sebagai INTEGER
}

interface InputGroupProps {
    label: string;
    name: string;
    value: string;
    type?: string;
    placeholder?: string;
    required?: boolean;
    isInvalid?: boolean;
    errorText?: string;
    className?: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

// --- KOMPONEN INPUT KECIL ---
const InputGroup: React.FC<InputGroupProps> = ({
    label,
    name,
    value,
    type = "text",
    placeholder,
    required = false,
    isInvalid = false,
    errorText = "",
    className = "",
    onChange,
}) => (
    <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-600">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            className={`mt-0 block w-full rounded-lg border text-sm ${isInvalid
                    ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                    : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                } shadow-sm px-3 py-2.5 transition-colors ${className}`}
            placeholder={placeholder}
            required={required}
        />
        {isInvalid && (
            <p className="mt-1 text-xs text-red-500 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {errorText}
            </p>
        )}
    </div>
);

// Inisialisasi default barang untuk reset
const initialCurrentBarang: SelectedBarang = {
    id: 0,
    kode: "",
    nama: "",
    kategori: "",
    satuan: "",
    jumlah: 1,
    stok_sisa: 0,
};

// --- HELPER: Format tanggal & waktu Indonesia ---
const formatTanggalIndonesia = (tanggalIso: string, withTime = false) => {
    if (!tanggalIso) return "-";

    const date = new Date(withTime ? tanggalIso : `${tanggalIso}T00:00:00`);

    const options: Intl.DateTimeFormatOptions = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    };

    if (withTime) {
        options.hour = "2-digit";
        options.minute = "2-digit";
        options.timeZone = "Asia/Jakarta";
        options.timeZoneName = "short";
    }

    return new Intl.DateTimeFormat("id-ID", options).format(date);
};

// Helper: pastikan integer positif
const normalizeQtyInt = (value: number | string): number => {
    if (typeof value === "string") {
        const onlyDigits = value.replace(/[^\d]/g, "");
        if (!onlyDigits) return 0;
        return parseInt(onlyDigits, 10);
    }
    if (!Number.isFinite(value)) return 0;
    const intVal = Math.floor(value);
    return intVal > 0 ? intVal : 0;
};

// --- KOMPONEN UTAMA ---
const FormSuratJalanPage = () => {
    // state layout untuk sidebar
    const [open, setOpen] = useState(true);

    const [stok, setStok] = useState<Barang[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedBarang, setSelectedBarang] = useState<SelectedBarang[]>([]);
    const [form, setForm] = useState({
        tujuan: "",
        nomorSurat: "",
        tanggal: new Date().toISOString().slice(0, 10),
        nomorKendaraan: "",
        noPo: "",
        keteranganProyek: "",
    });
    const [currentBarang, setCurrentBarang] =
        useState<SelectedBarang>(initialCurrentBarang);
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
    const [isLoadingStok, setIsLoadingStok] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditingId, setIsEditingId] = useState<number | null>(null);
    const [savedAt, setSavedAt] = useState<string>("");

    // 1. Fetch data stok dari backend Rust
    useEffect(() => {
        const fetchStok = async () => {
            try {
                setIsLoadingStok(true);

                const res = await fetch(`${API_BASE_URL}/api/stok`, {
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                if (!res.ok) {
                    throw new Error("Gagal mengambil data stok dari backend");
                }

                const data = await res.json();

                const mapped: Barang[] = (data as any[]).map((item) => ({
                    id: item.id,
                    kode: item.kode,
                    nama: item.nama,
                    kategori: item.kategori,
                    satuan: item.satuan_kode ?? item.satuan_nama ?? "",
                    stok_sisa: item.stok_sisa,
                }));

                setStok(mapped.filter((b) => b.stok_sisa > 0));
            } catch (err) {
                console.error(err);
                alert("Terjadi kesalahan saat mengambil data stok dari backend.");
            } finally {
                setIsLoadingStok(false);
            }
        };

        fetchStok();
    }, []);

    // 2. Filtering untuk Autocomplete
    const filteredStok = useMemo(() => {
        if (!searchQuery.trim() || currentBarang.id !== 0 || isEditingId !== null) {
            return [];
        }

        const lowerCaseQuery = searchQuery.toLowerCase();
        return stok
            .filter(
                (item) =>
                    item.nama.toLowerCase().includes(lowerCaseQuery) ||
                    item.kode.toLowerCase().includes(lowerCaseQuery)
            )
            .slice(0, 10);
    }, [searchQuery, stok, currentBarang.id, isEditingId]);

    // 3. Handler Form Utama
    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));

        if (formErrors[name]) {
            const newErrors = { ...formErrors };
            delete newErrors[name];
            setFormErrors(newErrors);
        }
    };

    // 4. Handler Select Barang dari Autocomplete
    const handleSelectBarang = (item: Barang) => {
        const existingItem = selectedBarang.find((i) => i.id === item.id);

        if (existingItem) {
            handleEditBarang(existingItem.id);
        } else {
            setCurrentBarang({
                ...item,
                jumlah: 1,
            });
            setSearchQuery(`${item.nama} (${item.kode})`);
        }
    };

    // 5. Handler Tambah/Update Barang
    const addBarang = () => {
        if (currentBarang.id === 0) {
            alert("Mohon pilih barang terlebih dahulu.");
            return;
        }

        const qtyInt = normalizeQtyInt(currentBarang.jumlah);

        if (qtyInt <= 0) {
            alert("Jumlah harus berupa bilangan bulat positif.");
            return;
        }

        const stokBarang = stok.find((item) => item.id === currentBarang.id);

        if (stokBarang && stokBarang.stok_sisa < qtyInt) {
            alert(
                `Stok barang tidak mencukupi. Sisa stok: ${stokBarang.stok_sisa} ${stokBarang.satuan}`
            );
            return;
        }

        if (isEditingId !== null) {
            setSelectedBarang((prev) =>
                prev.map((item) =>
                    item.id === isEditingId ? { ...item, jumlah: qtyInt } : item
                )
            );
        } else {
            const isDuplicate = selectedBarang.some(
                (item) => item.id === currentBarang.id
            );

            if (isDuplicate) {
                alert(
                    "Barang ini sudah ada di daftar. Gunakan tombol edit (pensil) pada tabel untuk mengubah jumlahnya."
                );
                return;
            }

            setSelectedBarang((prev) => [
                ...prev,
                { ...currentBarang, jumlah: qtyInt },
            ]);
        }

        setCurrentBarang(initialCurrentBarang);
        setSearchQuery("");
        setIsEditingId(null);
    };

    // 6. Handler Edit Barang dari Tabel
    const handleEditBarang = (id: number) => {
        const itemToEdit = selectedBarang.find((item) => item.id === id);
        if (itemToEdit) {
            setCurrentBarang(itemToEdit);
            setSearchQuery(`${itemToEdit.nama} (${itemToEdit.kode})`);
            setIsEditingId(id);
        }
    };

    // 7. Handler Remove Barang
    const removeBarang = (id: number) => {
        setSelectedBarang((prev) => prev.filter((item) => item.id !== id));
        if (isEditingId === id) {
            setCurrentBarang(initialCurrentBarang);
            setSearchQuery("");
            setIsEditingId(null);
        }
    };

    // 8. Reset Barang
    const resetBarang = () => {
        setSelectedBarang([]);
        setCurrentBarang(initialCurrentBarang);
        setSearchQuery("");
        setIsEditingId(null);
    };

    // 9. Validasi Form
    const validateForm = () => {
        const errors: { [key: string]: string } = {};

        if (!form.tujuan.trim()) errors.tujuan = "Tujuan wajib diisi.";
        if (!form.nomorSurat.trim())
            errors.nomorSurat = "Nomor Surat wajib diisi.";
        if (!form.tanggal) errors.tanggal = "Tanggal wajib diisi.";
        if (selectedBarang.length === 0)
            errors.barang = "Minimal satu barang harus ditambahkan.";

        // validasi jumlah integer positif
        const adaQtyInvalid = selectedBarang.some(
            (b) => normalizeQtyInt(b.jumlah) <= 0
        );
        if (adaQtyInvalid) {
            errors.barang =
                "Jumlah barang harus berupa bilangan bulat positif untuk semua item.";
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // 10. Handler Submit → kirim ke backend Rust
    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!validateForm()) {
            alert(
                "⚠️ Mohon lengkapi kolom yang wajib diisi dan pastikan ada barang di daftar."
            );
            return;
        }

        // Normalisasi qty jadi integer sebelum dikirim
        const barangNormalized = selectedBarang.map((b) => ({
            kode: b.kode,
            nama: b.nama,
            jumlah: normalizeQtyInt(b.jumlah),
            satuan: b.satuan,
            berat: null as number | null,
        }));

        // pastikan setelah normalisasi tidak ada qty <= 0
        if (barangNormalized.some((b) => b.jumlah <= 0)) {
            alert(
                "Jumlah barang harus berupa bilangan bulat positif. Mohon periksa kembali daftar barang."
            );
            return;
        }

        const payload = {
            tujuan: form.tujuan,
            nomorSurat: form.nomorSurat,
            tanggal: form.tanggal, // "YYYY-MM-DD" → cocok dengan NaiveDate
            nomorKendaraan: form.nomorKendaraan || null,
            noPo: form.noPo || null,
            keteranganProyek: form.keteranganProyek || null,
            barang: barangNormalized,
        };

        console.log("[SuratJalan] payload yang dikirim:", payload);

        setIsSubmitting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/surat-jalan`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            let errorMessage = "Terjadi kesalahan saat menyimpan Surat Jalan";

            if (!res.ok) {
                const text = await res.text();
                console.error(
                    "[SuratJalan] Response error:",
                    res.status,
                    res.statusText,
                    text
                );

                try {
                    const json = text ? JSON.parse(text) : null;
                    const msgFromJson =
                        json?.message || json?.error || json?.detail || null;
                    if (msgFromJson) {
                        errorMessage = msgFromJson;
                    }
                } catch {
                    if (text) {
                        errorMessage = text;
                    }
                }

                throw new Error(errorMessage);
            }

            const data = await res.json().catch(() => null);
            console.log("[SuratJalan] Response success:", data);

            setSavedAt(new Date().toISOString());

            alert("✅ Surat Jalan berhasil dibuat!");

            setForm({
                tujuan: "",
                nomorSurat: "",
                tanggal: new Date().toISOString().slice(0, 10),
                nomorKendaraan: "",
                noPo: "",
                keteranganProyek: "",
            });
            setSelectedBarang([]);
            setCurrentBarang(initialCurrentBarang);
            setSearchQuery("");
            setIsEditingId(null);
            setFormErrors({});
        } catch (err: any) {
            console.error("[SuratJalan] Error submit:", err);
            alert(err?.message ?? "Terjadi kesalahan saat menyimpan Surat Jalan.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- DERIVED STATE UNTUK SUMMARY ---
    const totalItem = selectedBarang.length;
    const totalQty = selectedBarang.reduce(
        (acc, item) => acc + normalizeQtyInt(item.jumlah),
        0
    );

    return (
        <div className="flex h-[100dvh] w-full max-w-full bg-slate-100 text-slate-800 overflow-hidden">
            {/* SIDEBAR */}
            <div className="shrink-0">
                <Sidebar open={open} setOpen={setOpen} />
            </div>

            {/* MAIN AREA */}
            <div className="flex flex-col flex-1 min-w-0 w-full">
                <Header onToggle={() => setOpen(!open)} />

                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <main className="p-4 md:p-8 max-w-7xl mx-auto w-full font-inter">
                        {/* TOP GRADIENT HEADER (KHUSUS MODUL SURAT JALAN) */}
                        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 shadow-lg rounded-2xl">
                            <div className="px-5 sm:px-8 py-5 sm:py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="space-y-2">
                                    <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/10 text-xs text-blue-100 border border-white/20">
                                        <FileText className="w-3.5 h-3.5 mr-1.5" />
                                        Modul Surat Jalan
                                    </div>
                                    <h1 className="flex items-center text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                                        <Truck className="w-8 h-8 mr-3 text-blue-100" />
                                        Pembuatan Surat Jalan
                                    </h1>
                                    <p className="text-xs sm:text-sm text-blue-100/90 max-w-xl">
                                        Lengkapi detail pengiriman dan pilih barang keluar dari stok
                                        gudang untuk menghasilkan dokumen Surat Jalan yang rapi dan
                                        terstruktur.
                                    </p>
                                </div>

                                {/* SUMMARY KECIL DI HEADER */}
                                <div className="flex flex-col sm:items-end gap-2">
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-blue-900/40 border border-blue-300/40">
                                            <span className="text-[10px] uppercase tracking-wide text-blue-100">
                                                Total Item
                                            </span>
                                            <span className="text-lg font-bold text-white">
                                                {totalItem}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-blue-900/40 border border-blue-300/40">
                                            <span className="text-[10px] uppercase tracking-wide text-blue-100">
                                                Total Qty
                                            </span>
                                            <span className="text-lg font-bold text-white">
                                                {totalQty.toLocaleString("id-ID", {
                                                    minimumFractionDigits: 0,
                                                    maximumFractionDigits: 0,
                                                })}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleSubmit()}
                                        className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-900/20 border border-emerald-300/60 disabled:bg-gray-400 disabled:border-gray-300 disabled:shadow-none disabled:cursor-not-allowed transition"
                                        disabled={
                                            isSubmitting ||
                                            selectedBarang.length === 0 ||
                                            Object.keys(formErrors).length > 0 ||
                                            isEditingId !== null
                                        }
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                                Menyimpan...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4 mr-2" />
                                                Simpan Surat Jalan
                                            </>
                                        )}
                                    </button>

                                    <p className="text-[10px] text-blue-100/80 flex items-center gap-1">
                                        <Info className="w-3 h-3" />
                                        Pastikan semua data valid sebelum menyimpan.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* BODY CONTENT */}
                        <div className="mt-6">
                            <form
                                onSubmit={handleSubmit}
                                className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.1fr)_minmax(260px,0.9fr)] gap-6"
                            >
                                {/* KOLOM KIRI: FORM & ITEM */}
                                <div className="space-y-6">
                                    {/* Bagian 1: Data Header Surat Jalan */}
                                    <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-slate-200/80">
                                        <div className="flex items-center justify-between gap-3 mb-5">
                                            <div>
                                                <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
                                                    <ClipboardList className="w-5 h-5 text-blue-600" />
                                                    Detail Pengiriman
                                                </h2>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    Isi informasi dasar Surat Jalan sebelum memilih
                                                    barang.
                                                </p>
                                            </div>
                                            <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-[11px] font-medium text-sky-700">
                                                Step 1 dari 2
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                            <div className="md:col-span-2">
                                                <InputGroup
                                                    label="Tujuan Pengiriman (Klien/Proyek)"
                                                    name="tujuan"
                                                    value={form.tujuan}
                                                    placeholder="Nama PT, Toko, atau Alamat Proyek"
                                                    required
                                                    isInvalid={!!formErrors.tujuan}
                                                    errorText={formErrors.tujuan}
                                                    onChange={(
                                                        e: React.ChangeEvent<HTMLInputElement>
                                                    ) => handleInputChange(e)}
                                                />
                                            </div>
                                            <InputGroup
                                                label="Tanggal Surat"
                                                name="tanggal"
                                                value={form.tanggal}
                                                type="date"
                                                required
                                                isInvalid={!!formErrors.tanggal}
                                                errorText={formErrors.tanggal}
                                                onChange={(
                                                    e: React.ChangeEvent<HTMLInputElement>
                                                ) => handleInputChange(e)}
                                            />
                                            <InputGroup
                                                label="Nomor Surat Jalan"
                                                name="nomorSurat"
                                                value={form.nomorSurat}
                                                placeholder="Contoh: SJ/2025/12/001"
                                                required
                                                isInvalid={!!formErrors.nomorSurat}
                                                errorText={formErrors.nomorSurat}
                                                className="font-mono uppercase tracking-wide"
                                                onChange={(
                                                    e: React.ChangeEvent<HTMLInputElement>
                                                ) => handleInputChange(e)}
                                            />
                                            <InputGroup
                                                label="Nomor Kendaraan"
                                                name="nomorKendaraan"
                                                value={form.nomorKendaraan}
                                                placeholder="Plat Mobil/Truk (Opsional)"
                                                onChange={(
                                                    e: React.ChangeEvent<HTMLInputElement>
                                                ) => handleInputChange(e)}
                                            />
                                            <InputGroup
                                                label="Nomor PO (Purchase Order)"
                                                name="noPo"
                                                value={form.noPo}
                                                placeholder="Nomor PO dari klien (Opsional)"
                                                onChange={(
                                                    e: React.ChangeEvent<HTMLInputElement>
                                                ) => handleInputChange(e)}
                                            />
                                        </div>

                                        <div className="mt-5 space-y-1">
                                            <label className="block text-xs font-medium text-gray-600">
                                                Keterangan Proyek/Tambahan
                                            </label>
                                            <textarea
                                                name="keteranganProyek"
                                                value={form.keteranganProyek}
                                                onChange={handleInputChange}
                                                rows={3}
                                                className="mt-0 block w-full rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-blue-500 shadow-sm px-3 py-2.5 text-sm transition-colors"
                                                placeholder="Detail tambahan, misal: 'Pengiriman Tahap I Proyek ABC'"
                                            />
                                        </div>
                                    </div>

                                    {/* Bagian 2: Daftar Barang (Item List) */}
                                    <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-slate-200/80">
                                        <div className="flex items-center justify-between gap-3 mb-5">
                                            <div>
                                                <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
                                                    <PackageSearch className="w-5 h-5 text-blue-600" />
                                                    Daftar Barang Keluar
                                                </h2>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    Cari barang dari stok, tentukan jumlah keluar, dan
                                                    tambahkan ke tabel.
                                                </p>
                                            </div>
                                            <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-medium text-emerald-700">
                                                Step 2 dari 2
                                            </span>
                                        </div>

                                        {/* Form Pencarian Barang (Autocomplete) */}
                                        <div
                                            className={`border p-4 sm:p-5 rounded-2xl mb-6 transition-all ${isEditingId !== null
                                                    ? "bg-amber-50 border-amber-300"
                                                    : "bg-sky-50 border-sky-300"
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                                                    {isEditingId !== null ? (
                                                        <>
                                                            <Edit2 className="w-4 h-4 text-amber-600" />
                                                            Edit Barang
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-[11px] font-medium text-amber-800 border border-amber-200">
                                                                Mode Edit
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Plus className="w-4 h-4 text-blue-600" />
                                                            Tambah Item Barang
                                                            <span className="text-red-500 ml-0.5">*</span>
                                                        </>
                                                    )}
                                                </h3>

                                                {isEditingId !== null && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setCurrentBarang(initialCurrentBarang);
                                                            setSearchQuery("");
                                                            setIsEditingId(null);
                                                        }}
                                                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition"
                                                    >
                                                        <X className="w-3 h-3" />
                                                        Batalkan Edit
                                                    </button>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap items-end gap-4">
                                                {/* Input Pencarian/Nama Barang */}
                                                <div className="relative flex-grow min-w-[260px]">
                                                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                                                        Nama Barang (Kode/Nama)
                                                    </label>
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                        <input
                                                            type="text"
                                                            placeholder={
                                                                isLoadingStok
                                                                    ? "Memuat data stok..."
                                                                    : "Ketik kode atau nama barang..."
                                                            }
                                                            value={searchQuery}
                                                            onChange={(e) => {
                                                                setSearchQuery(e.target.value);
                                                                if (isEditingId === null) {
                                                                    setCurrentBarang((prev) => ({
                                                                        ...prev,
                                                                        id: 0,
                                                                    }));
                                                                }
                                                            }}
                                                            className="border border-gray-300 rounded-lg px-3 py-2.5 w-full text-sm focus:border-blue-500 focus:ring-blue-500 transition disabled:bg-gray-200"
                                                            disabled={isLoadingStok || isEditingId !== null}
                                                        />
                                                        {currentBarang.id !== 0 && (
                                                            <X
                                                                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500 cursor-pointer hover:text-red-700"
                                                                onClick={() => {
                                                                    setCurrentBarang(initialCurrentBarang);
                                                                    setSearchQuery("");
                                                                    setIsEditingId(null);
                                                                }}
                                                            />
                                                        )}
                                                    </div>

                                                    {/* Suggestion Dropdown */}
                                                    {searchQuery &&
                                                        currentBarang.id === 0 &&
                                                        filteredStok.length > 0 &&
                                                        isEditingId === null && (
                                                            <ul className="absolute z-20 bg-white border border-gray-200 rounded-lg shadow-xl w-full max-h-56 overflow-y-auto mt-1 text-sm">
                                                                {filteredStok.map((item) => (
                                                                    <li
                                                                        key={item.id}
                                                                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer flex justify-between items-center"
                                                                        onClick={() => handleSelectBarang(item)}
                                                                    >
                                                                        <div className="flex flex-col">
                                                                            <span className="font-medium">
                                                                                {item.nama}
                                                                            </span>
                                                                            <span className="text-[11px] text-gray-500">
                                                                                {item.kode} • {item.kategori}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-[11px] text-gray-500 ml-2 whitespace-nowrap">
                                                                            Stok: {item.stok_sisa} {item.satuan}
                                                                        </span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                </div>

                                                {/* Detail Barang Terpilih */}
                                                {currentBarang.id !== 0 && (
                                                    <div className="flex flex-col min-w-[170px] px-3 py-2 rounded-lg bg-white/70 border border-gray-200 text-xs sm:text-sm flex-1">
                                                        <span className="font-semibold text-gray-800">
                                                            Satuan:{" "}
                                                            <span className="font-bold">
                                                                {currentBarang.satuan}
                                                            </span>
                                                        </span>
                                                        <span className="text-xs text-rose-600 mt-0.5">
                                                            Sisa stok:{" "}
                                                            <strong>
                                                                {currentBarang.stok_sisa}{" "}
                                                                {currentBarang.satuan}
                                                            </strong>
                                                        </span>
                                                        <span className="text-[11px] text-gray-500 mt-1">
                                                            Pastikan jumlah keluar tidak melebihi stok sisa.
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Input Jumlah */}
                                                <div className="w-full sm:w-40 min-w-[130px]">
                                                    <label className="block text-[11px] font-medium text-gray-600 mb-1 text-center sm:text-left">
                                                        Jumlah Keluar
                                                    </label>
                                                    <input
                                                        type="number"
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                        min={1}
                                                        step={1}
                                                        value={
                                                            currentBarang.jumlah > 0
                                                                ? currentBarang.jumlah
                                                                : ""
                                                        }
                                                        onChange={(e) => {
                                                            const raw = e.target.value;
                                                            const qtyInt = normalizeQtyInt(raw);
                                                            setCurrentBarang((prev) => ({
                                                                ...prev,
                                                                jumlah: qtyInt,
                                                            }));
                                                        }}
                                                        className="border border-gray-300 rounded-lg px-3 py-2.5 w-full text-center font-bold text-lg focus:border-blue-500 focus:ring-blue-500"
                                                        placeholder="1"
                                                        disabled={currentBarang.id === 0}
                                                    />
                                                </div>

                                                {/* Tombol Tambah / Update */}
                                                <button
                                                    type="button"
                                                    onClick={addBarang}
                                                    className={`flex items-center justify-center px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold text-white rounded-lg shadow-md transition duration-150 h-[42px] mt-1 sm:mt-0 disabled:bg-gray-400 disabled:cursor-not-allowed ${isEditingId !== null
                                                            ? "bg-amber-500 hover:bg-amber-600"
                                                            : "bg-blue-600 hover:bg-blue-700"
                                                        }`}
                                                    disabled={
                                                        currentBarang.id === 0 ||
                                                        normalizeQtyInt(currentBarang.jumlah) <= 0
                                                    }
                                                >
                                                    {isEditingId !== null ? (
                                                        <>
                                                            <CheckCircle className="w-4 h-4 mr-1" />
                                                            Update Jumlah
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Plus className="w-4 h-4 mr-1" />
                                                            Tambah Item
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            {formErrors.barang && (
                                                <p className="mt-3 text-sm text-red-500 font-medium border-l-4 border-red-500 pl-2 bg-red-50 flex items-center gap-2">
                                                    <AlertTriangle className="w-4 h-4" />
                                                    {formErrors.barang}
                                                </p>
                                            )}
                                        </div>

                                        {/* Tabel Daftar Barang Terpilih */}
                                        <div className="overflow-x-auto border rounded-2xl shadow-inner bg-slate-50/70">
                                            {selectedBarang.length > 0 ? (
                                                <table className="w-full min-w-max text-sm">
                                                    <thead className="bg-slate-200 uppercase text-[11px] text-slate-700">
                                                        <tr>
                                                            <th className="px-3 py-2 text-center border-r">
                                                                No
                                                            </th>
                                                            <th className="px-3 py-2 text-left border-r">
                                                                Kode
                                                            </th>
                                                            <th className="px-3 py-2 text-left border-r">
                                                                Nama Barang
                                                            </th>
                                                            <th className="px-3 py-2 text-center border-r">
                                                                Jumlah
                                                            </th>
                                                            <th className="px-3 py-2 text-center border-r">
                                                                Satuan
                                                            </th>
                                                            <th className="px-3 py-2 text-center">Aksi</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-200 bg-white/70">
                                                        {selectedBarang.map((item, index) => (
                                                            <tr
                                                                key={item.id}
                                                                className={`transition-colors ${item.id === isEditingId
                                                                        ? "bg-amber-50 font-semibold"
                                                                        : "hover:bg-slate-50"
                                                                    }`}
                                                            >
                                                                <td className="px-3 py-2 text-center text-xs">
                                                                    {index + 1}
                                                                </td>
                                                                <td className="px-3 py-2 font-mono text-xs text-gray-700">
                                                                    {item.kode}
                                                                </td>
                                                                <td className="px-3 py-2 text-xs sm:text-sm font-medium text-slate-800">
                                                                    {item.nama}
                                                                </td>
                                                                <td className="px-3 py-2 text-center font-bold text-blue-700">
                                                                    {normalizeQtyInt(
                                                                        item.jumlah
                                                                    ).toLocaleString("id-ID", {
                                                                        minimumFractionDigits: 0,
                                                                        maximumFractionDigits: 0,
                                                                    })}
                                                                </td>
                                                                <td className="px-3 py-2 text-center text-xs sm:text-sm">
                                                                    {item.satuan}
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    <div className="flex justify-center items-center gap-1.5">
                                                                        <button
                                                                            onClick={() =>
                                                                                handleEditBarang(item.id)
                                                                            }
                                                                            className={`p-1.5 rounded-full transition-colors ${item.id === isEditingId
                                                                                    ? "text-white bg-amber-500"
                                                                                    : "text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                                                                }`}
                                                                            type="button"
                                                                            title="Edit Jumlah"
                                                                            disabled={
                                                                                isEditingId !== null &&
                                                                                item.id !== isEditingId
                                                                            }
                                                                        >
                                                                            <Edit2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => removeBarang(item.id)}
                                                                            className="p-1.5 rounded-full text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                                                                            type="button"
                                                                            title="Hapus Barang"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot className="bg-slate-100 text-xs text-slate-700">
                                                        <tr>
                                                            <td
                                                                className="px-3 py-2 text-right font-semibold"
                                                                colSpan={3}
                                                            >
                                                                Total
                                                            </td>
                                                            <td className="px-3 py-2 text-center font-bold text-blue-800">
                                                                {totalQty.toLocaleString("id-ID", {
                                                                    minimumFractionDigits: 0,
                                                                    maximumFractionDigits: 0,
                                                                })}
                                                            </td>
                                                            <td colSpan={2}></td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            ) : (
                                                <div className="text-center p-7 text-gray-500 text-sm flex flex-col items-center gap-2">
                                                    <ClipboardList className="w-6 h-6 text-gray-400" />
                                                    <p className="font-medium">
                                                        Daftar barang masih kosong.
                                                    </p>
                                                    <p className="text-xs text-gray-400">
                                                        Gunakan form di atas untuk memilih barang dan
                                                        menambahkannya ke daftar.
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {selectedBarang.length > 0 && (
                                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                                <button
                                                    type="button"
                                                    onClick={resetBarang}
                                                    className="inline-flex items-center px-4 py-2 bg-red-500 text-white text-xs sm:text-sm rounded-lg hover:bg-red-600 transition shadow-sm"
                                                >
                                                    <X className="w-4 h-4 mr-1" />
                                                    Bersihkan Semua Barang
                                                </button>
                                                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                                                    <Info className="w-3 h-3" />
                                                    Klik ikon pensil untuk mengubah jumlah, atau ikon
                                                    tempat sampah untuk menghapus barang.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* KOLOM KANAN: SUMMARY / PANEL INFO */}
                                <div className="space-y-4 lg:sticky lg:top-4 h-max">
                                    {/* Kartu Ringkasan */}
                                    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-5 h-5 text-blue-600" />
                                                <h3 className="text-sm font-semibold text-slate-800">
                                                    Ringkasan Surat Jalan
                                                </h3>
                                            </div>
                                            {selectedBarang.length > 0 && (
                                                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-[11px] font-medium text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" />
                                                    Draft Siap
                                                </span>
                                            )}
                                        </div>

                                        <div className="space-y-3 text-xs text-slate-600">
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-500">Tanggal</span>
                                                <span className="font-medium text-right">
                                                    {form.tanggal
                                                        ? formatTanggalIndonesia(form.tanggal)
                                                        : "-"}
                                                </span>
                                            </div>

                                            {savedAt && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-500">Waktu Simpan</span>
                                                    <span className="font-medium text-right">
                                                        {formatTanggalIndonesia(savedAt, true)}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-500">Nomor Surat</span>
                                                <span className="font-semibold text-slate-800 text-right">
                                                    {form.nomorSurat || "-"}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 block mb-0.5">
                                                    Tujuan
                                                </span>
                                                <span className="text-[11px] font-medium text-slate-800 line-clamp-2">
                                                    {form.tujuan || "Belum diisi"}
                                                </span>
                                            </div>
                                            {form.nomorKendaraan && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-500">
                                                        Nomor Kendaraan
                                                    </span>
                                                    <span className="font-medium">
                                                        {form.nomorKendaraan}
                                                    </span>
                                                </div>
                                            )}
                                            {form.noPo && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-500">Nomor PO</span>
                                                    <span className="font-medium">{form.noPo}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="border-t border-slate-200 pt-3 mt-2 space-y-2">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-500">Jumlah Item</span>
                                                <span className="font-semibold text-slate-800">
                                                    {totalItem} item
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-500">Total Kuantitas</span>
                                                <span className="font-semibold text-blue-700">
                                                    {totalQty.toLocaleString("id-ID", {
                                                        minimumFractionDigits: 0,
                                                        maximumFractionDigits: 0,
                                                    })}
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            className="w-full inline-flex items-center justify-center gap-2 mt-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md border border-blue-500/70 disabled:bg-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed transition"
                                            disabled={
                                                isSubmitting ||
                                                selectedBarang.length === 0 ||
                                                Object.keys(formErrors).length > 0 ||
                                                isEditingId !== null
                                            }
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                                    Menyimpan...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="w-4 h-4" />
                                                    Simpan Surat Jalan
                                                </>
                                            )}
                                        </button>

                                        {Object.keys(formErrors).length > 0 && (
                                            <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 flex items-start gap-2">
                                                <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />
                                                <div>
                                                    <span className="font-semibold">
                                                        Ada data yang belum lengkap.
                                                    </span>
                                                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                                                        {Object.values(formErrors).map((err, idx) => (
                                                            <li key={idx}>{err}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Kartu Info Bantuan */}
                                    <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 text-xs space-y-2 shadow-md">
                                        <div className="flex items-center gap-2">
                                            <Info className="w-4 h-4 text-sky-300" />
                                            <h4 className="font-semibold text-sm">
                                                Tips Pengisian Cepat
                                            </h4>
                                        </div>
                                        <ul className="space-y-1.5">
                                            <li className="flex gap-2">
                                                <span className="mt-0.5">•</span>
                                                <span>
                                                    Isi <strong>Tujuan</strong>,{" "}
                                                    <strong>Nomor Surat</strong>, dan{" "}
                                                    <strong>Tanggal</strong> terlebih dahulu untuk
                                                    menghindari lupa.
                                                </span>
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="mt-0.5">•</span>
                                                <span>
                                                    Saat memilih barang, perhatikan{" "}
                                                    <strong>stok sisa</strong> agar tidak melebihi
                                                    kapasitas gudang.
                                                </span>
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="mt-0.5">•</span>
                                                <span>
                                                    Gunakan <strong>mode edit</strong> (ikon pensil)
                                                    untuk mengubah jumlah tanpa harus menghapus item.
                                                </span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </main>

                    <Footer />
                </div>
            </div>
        </div>
    );
};

export default FormSuratJalanPage;
