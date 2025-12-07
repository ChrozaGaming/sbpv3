/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { generateSuratJalanPdf } from "@/utils/suratjalan/pdfGenerator";
import {
    FileText,
    Truck,
    Search,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Database,
    RefreshCcw,
    XCircle,
    ArrowUpDown,
    Package,
    Printer,
} from "lucide-react";

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

// --- CONFIG BACKEND ---
const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// --- TYPES ---
interface SuratJalan {
    id: number;
    nomor_surat: string;
    tujuan: string;
    tanggal: string;
    nomor_kendaraan: string | null;
    no_po: string | null;
    keterangan_proyek: string | null;
    created_at: string | null;
}

interface ApiResponse {
    data: SuratJalan[];
    pagination?: {
        totalPages?: number;
        currentPage?: number;
        totalItems?: number;
        // fallback snake_case dari backend
        total_pages?: number;
        current_page?: number;
        total_items?: number;
    };
    success?: boolean;
    message?: string;
}

interface SuratJalanDetailHeader {
    id: number;
    nomor_surat: string;
    tujuan: string;
    tanggal: string;
    nomor_kendaraan: string | null;
    no_po: string | null;
    keterangan_proyek: string | null;
    created_at: string | null;
    updated_at: string | null;
}

interface SuratJalanDetailItem {
    id: number;
    surat_jalan_id: number;
    no_urut: number;
    quantity: number;
    unit: string;
    weight: number | null;
    kode_barang: string;
    nama_barang: string;
}

interface SuratJalanDetailResponse {
    header: SuratJalanDetailHeader;
    items: SuratJalanDetailItem[];
}

const ITEMS_PER_PAGE = 10;

// Helper format tanggal ke Indonesia
const formatTanggal = (tanggal: string): string => {
    if (!tanggal) return "-";
    const date = new Date(tanggal);
    if (Number.isNaN(date.getTime())) return "-";

    const options: Intl.DateTimeFormatOptions = {
        day: "2-digit",
        month: "long",
        year: "numeric",
    };
    return date.toLocaleDateString("id-ID", options);
};

const formatWeight = (weight: number | null | undefined): string => {
    if (weight == null) return "-";
    return weight.toLocaleString("id-ID", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
    });
};

// --- TABLE COMPONENT ---
const SuratJalanTable = ({
    data,
    sortField,
    sortOrder,
    handleSort,
    currentPage,
    expandedId,
    onToggleDetail,
    onPrint,
    detailCache,
    detailLoadingId,
    detailErrorMap,
}: {
    data: SuratJalan[];
    sortField: keyof SuratJalan;
    sortOrder: "asc" | "desc";
    handleSort: (field: keyof SuratJalan) => void;
    currentPage: number;
    expandedId: number | null;
    onToggleDetail: (id: number) => void;
    onPrint: (id: number) => void;
    detailCache: Record<number, SuratJalanDetailResponse>;
    detailLoadingId: number | null;
    detailErrorMap: Record<number, string>;
}) => {
    const getBadgeColor = (text: string) => {
        const lower = text.toLowerCase();
        if (!lower) return "bg-slate-100 text-slate-700";

        if (lower.includes("proyek") || lower.includes("project")) {
            return "bg-blue-50 text-blue-700 ring-1 ring-blue-100";
        }
        if (lower.includes("gudang")) {
            return "bg-amber-50 text-amber-800 ring-1 ring-amber-100";
        }
        if (lower.includes("kantor")) {
            return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
        }
        if (lower.includes("cabang")) {
            return "bg-violet-50 text-violet-700 ring-1 ring-violet-100";
        }
        return "bg-slate-50 text-slate-700 ring-1 ring-slate-100";
    };

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50/80">
                        <tr>
                            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                No
                            </th>
                            <th
                                className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 cursor-pointer hover:bg-slate-100/80"
                                onClick={() => handleSort("nomor_surat")}
                            >
                                <div className="flex items-center gap-1.5">
                                    <span>Nomor Surat</span>
                                    <ArrowUpDown
                                        className={`h-3 w-3 ${
                                            sortField === "nomor_surat"
                                                ? "text-blue-600"
                                                : "text-slate-400"
                                        }`}
                                    />
                                </div>
                            </th>
                            <th
                                className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 cursor-pointer hover:bg-slate-100/80"
                                onClick={() => handleSort("tujuan")}
                            >
                                <div className="flex items-center gap-1.5">
                                    <span>Tujuan</span>
                                    <ArrowUpDown
                                        className={`h-3 w-3 ${
                                            sortField === "tujuan"
                                                ? "text-blue-600"
                                                : "text-slate-400"
                                        }`}
                                    />
                                </div>
                            </th>
                            <th
                                className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 cursor-pointer hover:bg-slate-100/80 whitespace-nowrap"
                                onClick={() => handleSort("tanggal")}
                            >
                                <div className="flex items-center gap-1.5">
                                    <span>Tanggal</span>
                                    <ArrowUpDown
                                        className={`h-3 w-3 ${
                                            sortField === "tanggal"
                                                ? "text-blue-600"
                                                : "text-slate-400"
                                        }`}
                                    />
                                </div>
                            </th>
                            <th
                                className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 cursor-pointer hover:bg-slate-100/80"
                                onClick={() => handleSort("keterangan_proyek")}
                            >
                                <div className="flex items-center gap-1.5">
                                    <span>Keterangan Proyek</span>
                                    <ArrowUpDown
                                        className={`h-3 w-3 ${
                                            sortField === "keterangan_proyek"
                                                ? "text-blue-600"
                                                : "text-slate-400"
                                        }`}
                                    />
                                </div>
                            </th>
                            <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Aksi
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {data.map((item, index) => {
                            const isExpanded = expandedId === item.id;
                            const detail = detailCache[item.id];
                            const detailItems = detail?.items ?? [];
                            const detailHeader = detail?.header;
                            const badgeClass = getBadgeColor(
                                item.keterangan_proyek ?? "",
                            );

                            const isDetailLoading =
                                detailLoadingId === item.id;

                            return (
                                <tr
                                    key={item.id}
                                    className="align-top hover:bg-slate-50/60 transition-colors"
                                >
                                    <td className="px-4 py-3 text-center text-xs text-slate-500">
                                        {(currentPage - 1) *
                                            ITEMS_PER_PAGE +
                                            index +
                                            1}
                                    </td>
                                    <td className="px-4 py-3 text-xs sm:text-sm font-mono font-semibold text-slate-900">
                                        {item.nomor_surat}
                                    </td>
                                    <td className="px-4 py-3 text-xs sm:text-sm text-slate-800 max-w-xs truncate">
                                        {item.tujuan}
                                    </td>
                                    <td className="px-4 py-3 text-xs sm:text-sm text-slate-700 whitespace-nowrap">
                                        {formatTanggal(item.tanggal)}
                                    </td>
                                    <td className="px-4 py-3 text-xs sm:text-sm">
                                        <span
                                            className={`inline-flex max-w-xs items-center gap-1 truncate rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badgeClass}`}
                                            title={item.keterangan_proyek ?? "-"}
                                        >
                                            {item.keterangan_proyek ?? "-"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex flex-wrap items-center justify-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onToggleDetail(item.id)
                                                }
                                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium shadow-sm border transition-colors ${
                                                    isExpanded
                                                        ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                                                }`}
                                            >
                                                {isExpanded ? (
                                                    <>
                                                        <ChevronUp className="h-3.5 w-3.5" />
                                                        <span className="hidden sm:inline">
                                                            Sembunyikan Detail
                                                        </span>
                                                        <span className="sm:hidden">
                                                            Tutup
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <ChevronDown className="h-3.5 w-3.5" />
                                                        <span className="hidden sm:inline">
                                                            Lihat Detail
                                                        </span>
                                                        <span className="sm:hidden">
                                                            Detail
                                                        </span>
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onPrint(item.id)
                                                }
                                                disabled={isDetailLoading}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                title={
                                                    isDetailLoading
                                                        ? "Memuat detail Surat Jalan..."
                                                        : "Cetak Surat Jalan"
                                                }
                                            >
                                                {isDetailLoading ? (
                                                    <div className="h-4 w-4 animate-spin rounded-full border border-slate-300 border-t-slate-600" />
                                                ) : (
                                                    <Printer className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>

                                        {/* DETAIL DROPDOWN */}
                                        {isExpanded && (
                                            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700">
                                                {detailLoadingId ===
                                                    item.id && (
                                                    <div className="flex items-center justify-center py-4">
                                                        <div className="flex flex-col items-center gap-2">
                                                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                                                            <p className="text-[12px] text-slate-500">
                                                                Memuat detail
                                                                Surat Jalan...
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {detailErrorMap[item.id] && (
                                                    <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                                                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                                                        <div>
                                                            <p className="text-xs font-semibold">
                                                                Gagal memuat
                                                                detail
                                                            </p>
                                                            <p className="mt-0.5 text-[12px]">
                                                                {
                                                                    detailErrorMap[
                                                                        item.id
                                                                    ]
                                                                }
                                                            </p>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    onToggleDetail(
                                                                        item.id,
                                                                    )
                                                                }
                                                                className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 hover:text-rose-900"
                                                            >
                                                                <RefreshCcw className="h-3 w-3" />
                                                                Coba lagi
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {!detailLoadingId &&
                                                    !detailErrorMap[
                                                        item.id
                                                    ] &&
                                                    detail && (
                                                        <div className="space-y-3">
                                                            {/* HEADER DETAIL */}
                                                            {detailHeader && (
                                                                <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 text-[11px] sm:grid-cols-2 lg:grid-cols-4">
                                                                    <div>
                                                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                            Nomor
                                                                            Surat
                                                                        </p>
                                                                        <p className="mt-0.5 font-mono text-xs font-semibold text-slate-900">
                                                                            {
                                                                                detailHeader.nomor_surat
                                                                            }
                                                                        </p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                            Tanggal
                                                                        </p>
                                                                        <p className="mt-0.5 text-xs font-medium text-slate-800">
                                                                            {formatTanggal(
                                                                                detailHeader.tanggal,
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                            No.
                                                                            Kendaraan
                                                                        </p>
                                                                        <p className="mt-0.5 text-xs text-slate-800">
                                                                            {detailHeader.nomor_kendaraan ??
                                                                                "-"}
                                                                        </p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                            No.
                                                                            PO
                                                                        </p>
                                                                        <p className="mt-0.5 text-xs text-slate-800">
                                                                            {detailHeader.no_po ??
                                                                                "-"}
                                                                        </p>
                                                                    </div>
                                                                    <div className="sm:col-span-2 lg:col-span-4">
                                                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                            Keterangan
                                                                            Proyek
                                                                        </p>
                                                                        <p className="mt-0.5 text-xs text-slate-800">
                                                                            {detailHeader.keterangan_proyek ??
                                                                                "-"}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* TABEL BARANG */}
                                                            {detailItems.length >
                                                            0 ? (
                                                                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                                                    <table className="min-w-full divide-y divide-slate-200">
                                                                        <thead className="bg-slate-50">
                                                                            <tr>
                                                                                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                                    No
                                                                                </th>
                                                                                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                                    Kode
                                                                                    Barang
                                                                                </th>
                                                                                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                                    Nama
                                                                                    Barang
                                                                                </th>
                                                                                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                                    Qty
                                                                                </th>
                                                                                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                                    Satuan
                                                                                </th>
                                                                                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                                    Berat
                                                                                    (kg)
                                                                                </th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-100 bg-white">
                                                                            {detailItems.map(
                                                                                (
                                                                                    d,
                                                                                    idx,
                                                                                ) => (
                                                                                    <tr
                                                                                        key={
                                                                                            d.id
                                                                                        }
                                                                                        className="hover:bg-slate-50/80"
                                                                                    >
                                                                                        <td className="px-3 py-2 text-center text-[11px] text-slate-500">
                                                                                            {idx +
                                                                                                1}
                                                                                        </td>
                                                                                        <td className="px-3 py-2 font-mono text-[11px] text-slate-800">
                                                                                            {
                                                                                                d.kode_barang
                                                                                            }
                                                                                        </td>
                                                                                        <td className="px-3 py-2 text-[11px] text-slate-800">
                                                                                            {
                                                                                                d.nama_barang
                                                                                            }
                                                                                        </td>
                                                                                        <td className="px-3 py-2 text-right text-[11px] text-slate-800">
                                                                                            {
                                                                                                d.quantity
                                                                                            }
                                                                                        </td>
                                                                                        <td className="px-3 py-2 text-[11px] text-slate-700">
                                                                                            {
                                                                                                d.unit
                                                                                            }
                                                                                        </td>
                                                                                        <td className="px-3 py-2 text-right text-[11px] text-slate-700">
                                                                                            {formatWeight(
                                                                                                d.weight,
                                                                                            )}
                                                                                        </td>
                                                                                    </tr>
                                                                                ),
                                                                            )}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-white px-4 py-6">
                                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                                                                        <Package className="h-5 w-5 text-slate-400" />
                                                                    </div>
                                                                    <p className="text-[12px] font-medium text-slate-700">
                                                                        Tidak
                                                                        ada detail
                                                                        barang
                                                                    </p>
                                                                    <p className="text-[11px] text-slate-500">
                                                                        Surat
                                                                        Jalan ini
                                                                        belum
                                                                        memiliki
                                                                        item
                                                                        barang
                                                                        tercatat.
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- MAIN PAGE ---
const DataSuratJalanPage = () => {
    const [suratJalan, setSuratJalan] = useState<SuratJalan[]>([]);
    const [searchInput, setSearchInput] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchField, setSearchField] = useState<
        "nomor_surat" | "no_po" | "tujuan" | "keterangan_proyek"
    >("nomor_surat");
    const [sortField, setSortField] = useState<keyof SuratJalan>("id");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    // layout sidebar
    const [open, setOpen] = useState(true);

    // DETAIL STATE
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [detailCache, setDetailCache] = useState<
        Record<number, SuratJalanDetailResponse>
    >({});
    const [detailLoadingId, setDetailLoadingId] = useState<number | null>(
        null,
    );
    const [detailErrorMap, setDetailErrorMap] = useState<
        Record<number, string>
    >({});

    const calculateTotalPages = (data: ApiResponse): number => {
        const p = data.pagination as any | undefined;
        if (p) {
            if (typeof p.totalPages === "number") return p.totalPages || 1;
            if (typeof p.total_pages === "number") return p.total_pages || 1;
        }
        const total = data.data?.length ?? 0;
        return Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
    };

    // FETCH LIST
    const fetchSuratJalan = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams({
                search: searchQuery,
                field: searchField,
                sort: sortField as string,
                order: sortOrder,
                page: String(currentPage),
                limit: String(ITEMS_PER_PAGE),
            });

            const url = `${API_BASE_URL}/api/surat-jalan?${params.toString()}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error("Gagal mengambil data surat jalan");
            }

            const data: ApiResponse = await response.json();

            const success = data.success ?? true;
            if (!success) {
                throw new Error(data.message ?? "Error pada server");
            }

            setSuratJalan(data.data ?? []);
            setTotalPages(calculateTotalPages(data));

            const p = data.pagination as any | undefined;
            if (p) {
                const total =
                    typeof p.totalItems === "number"
                        ? p.totalItems
                        : typeof p.total_items === "number"
                        ? p.total_items
                        : null;
                if (total !== null) setTotalItems(total);
            } else {
                setTotalItems(null);
            }

            setLastUpdated(new Date().toISOString());
        } catch (err: any) {
            console.error("Error fetchSuratJalan:", err);
            setError(err.message || "Terjadi kesalahan tak terduga");
            setSuratJalan([]);
            setTotalPages(1);
            setTotalItems(null);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, searchField, sortField, sortOrder, currentPage]);

    // FETCH DETAIL (now returns data)
    const loadDetail = async (
        id: number,
    ): Promise<SuratJalanDetailResponse | null> => {
        try {
            setDetailLoadingId(id);
            setDetailErrorMap((prev) => {
                const clone = { ...prev };
                delete clone[id];
                return clone;
            });

            const url = `${API_BASE_URL}/api/surat-jalan/${id}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error("Gagal mengambil detail Surat Jalan");
            }

            const data: SuratJalanDetailResponse = await response.json();
            setDetailCache((prev) => ({
                ...prev,
                [id]: data,
            }));
            return data;
        } catch (err: any) {
            console.error("Error fetch detail surat jalan:", err);
            setDetailErrorMap((prev) => ({
                ...prev,
                [id]: err.message || "Terjadi kesalahan saat memuat detail",
            }));
            return null;
        } finally {
            setDetailLoadingId((current) =>
                current === id ? null : current,
            );
        }
    };

    // PRINT HANDLER
    const handlePrint = async (id: number) => {
        try {
            let detail = detailCache[id];

            // kalau belum ada di cache → fetch dulu
            if (!detail) {
                const fetched = await loadDetail(id);
                if (!fetched) {
                    alert(
                        "Gagal mengambil detail Surat Jalan. Tidak dapat mencetak dokumen.",
                    );
                    return;
                }
                detail = fetched;
            }

            // Panggil util jsPDF
            generateSuratJalanPdf(detail as any);
        } catch (err) {
            console.error("Error generate PDF surat jalan:", err);
            alert(
                "Terjadi kesalahan saat mencetak Surat Jalan.",
            );
        }
    };

    // Toggle detail dropdown
    const handleToggleDetail = (id: number) => {
        if (expandedId === id) {
            setExpandedId(null);
            return;
        }
        if (!detailCache[id]) {
            void loadDetail(id);
        }
        setExpandedId(id);
    };

    // Debounce search input
    useEffect(() => {
        const handler = setTimeout(() => {
            setSearchQuery(searchInput.trim());
            setCurrentPage(1);
        }, 400);
        return () => clearTimeout(handler);
    }, [searchInput, searchField]);

    // Reset expanded row on pagination / filter change
    useEffect(() => {
        setExpandedId(null);
    }, [currentPage, searchQuery, searchField]);

    // Fetch data on deps change
    useEffect(() => {
        fetchSuratJalan();
    }, [fetchSuratJalan]);

    const handleSort = (field: keyof SuratJalan) => {
        const newOrder =
            sortField === field && sortOrder === "asc"
                ? "desc"
                : "asc";
        setSortField(field);
        setSortOrder(newOrder);
        setCurrentPage(1);
    };

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const sortedSuratJalan = useMemo(() => {
        const arr = [...suratJalan];
        return arr.sort((a, b) => {
            const fieldA = a[sortField];
            const fieldB = b[sortField];

            if (fieldA == null || fieldB == null) return 0;

            if (
                typeof fieldA === "string" &&
                typeof fieldB === "string"
            ) {
                return sortOrder === "asc"
                    ? fieldA.localeCompare(fieldB)
                    : fieldB.localeCompare(fieldA);
            }

            if (
                typeof fieldA === "number" &&
                typeof fieldB === "number"
            ) {
                return sortOrder === "asc"
                    ? fieldA - fieldB
                    : fieldB - fieldA;
            }

            return 0;
        });
    }, [suratJalan, sortField, sortOrder]);

    const estimatedTotal =
        totalItems ??
        (currentPage - 1) * ITEMS_PER_PAGE + suratJalan.length;

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endIndex =
        (currentPage - 1) * ITEMS_PER_PAGE +
        sortedSuratJalan.length;

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
                        {/* Card utama halaman Surat Jalan */}
                        <div className="bg-slate-50 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                            {/* HEADER GRADIENT DALAM CARD */}
                            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 shadow-lg">
                                <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="space-y-3">
                                        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-medium text-blue-50 backdrop-blur">
                                            <FileText className="h-3.5 w-3.5" />
                                            Modul Surat Jalan
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
                                                <Truck className="h-6 w-6 text-blue-100" />
                                            </div>
                                            <div>
                                                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                                                    Daftar Surat Jalan
                                                </h1>
                                                <p className="mt-1 max-w-xl text-xs text-blue-100/90 sm:text-sm">
                                                    Pantau Surat Jalan, cari berdasarkan
                                                    nomor, tujuan, atau proyek, dan lihat
                                                    detail barang yang dikirim dalam satu
                                                    tampilan.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex flex-col rounded-2xl border border-white/25 bg-white/10 px-4 py-3 text-blue-50 backdrop-blur">
                                            <span className="text-[11px] uppercase tracking-wide text-blue-100/80">
                                                Total Halaman
                                            </span>
                                            <span className="mt-1 text-xl font-semibold">
                                                {totalPages}
                                            </span>
                                        </div>
                                        <div className="flex flex-col rounded-2xl border border-white/25 bg-white/10 px-4 py-3 text-blue-50 backdrop-blur">
                                            <span className="text-[11px] uppercase tracking-wide text-blue-100/80">
                                                Data / Halaman
                                            </span>
                                            <span className="mt-1 text-xl font-semibold">
                                                {ITEMS_PER_PAGE}
                                            </span>
                                        </div>
                                        {lastUpdated && (
                                            <div className="col-span-2 mt-1 flex items-center justify-end text-[11px] text-blue-100/80">
                                                <span className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-300" />
                                                Terakhir diperbarui:{" "}
                                                {new Date(
                                                    lastUpdated,
                                                ).toLocaleString("id-ID")}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* MAIN CONTENT DALAM CARD */}
                            <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
                                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                    {/* FILTER & SEARCH */}
                                    <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-6 sm:py-5">
                                        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                                            <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-end">
                                                <div className="w-full md:w-52">
                                                    <label className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
                                                        <Search className="h-3.5 w-3.5 text-slate-500" />
                                                        Field Pencarian
                                                    </label>
                                                    <select
                                                        value={searchField}
                                                        onChange={(e) => {
                                                            setSearchField(
                                                                e
                                                                    .target
                                                                    .value as
                                                                    | "nomor_surat"
                                                                    | "no_po"
                                                                    | "tujuan"
                                                                    | "keterangan_proyek",
                                                            );
                                                            setSearchInput(
                                                                "",
                                                            );
                                                        }}
                                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                                    >
                                                        <option value="nomor_surat">
                                                            Nomor Surat
                                                        </option>
                                                        <option value="no_po">
                                                            No PO
                                                        </option>
                                                        <option value="tujuan">
                                                            Tujuan
                                                        </option>
                                                        <option value="keterangan_proyek">
                                                            Keterangan
                                                            Proyek
                                                        </option>
                                                    </select>
                                                </div>

                                                <div className="flex-1">
                                                    <label className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
                                                        <Search className="h-3.5 w-3.5 text-slate-500" />
                                                        Kata Kunci
                                                    </label>
                                                    <div className="relative">
                                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                                            <Search className="h-4 w-4 text-slate-400" />
                                                        </div>
                                                        <input
                                                            type="text"
                                                            placeholder={`Cari berdasarkan ${searchField
                                                                .replace(
                                                                    "_",
                                                                    " ",
                                                                )
                                                                .toLowerCase()}`}
                                                            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                                            value={
                                                                searchInput
                                                            }
                                                            onChange={(e) =>
                                                                setSearchInput(
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                        />
                                                        {searchInput && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setSearchInput(
                                                                        "",
                                                                    )
                                                                }
                                                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                                                            >
                                                                <XCircle className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        fetchSuratJalan()
                                                    }
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                                                >
                                                    <RefreshCcw
                                                        className={`h-4 w-4 ${
                                                            loading
                                                                ? "animate-spin"
                                                                : ""
                                                        }`}
                                                    />
                                                    Refresh
                                                </button>
                                            </div>
                                        </div>

                                        {searchQuery && (
                                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-[11px] text-slate-500">
                                                        Filter aktif:
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-medium text-blue-700 ring-1 ring-blue-100">
                                                        {searchField
                                                            .replace(
                                                                "_",
                                                                " ",
                                                            )
                                                            .toLowerCase()}
                                                        :{" "}
                                                        <span className="font-mono">
                                                            "
                                                            {searchQuery}"
                                                        </span>
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSearchInput("");
                                                        setSearchQuery("");
                                                    }}
                                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700"
                                                >
                                                    <XCircle className="h-3.5 w-3.5" />
                                                    Hapus filter
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* SUMMARY BAR */}
                                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 sm:px-6">
                                        <div className="flex items-center gap-2">
                                            <Database className="h-4 w-4 text-slate-500" />
                                            <span>
                                                <span className="font-semibold text-blue-700">
                                                    {estimatedTotal.toLocaleString(
                                                        "id-ID",
                                                    )}
                                                </span>{" "}
                                                Surat Jalan (estimasi)
                                            </span>
                                        </div>
                                        <div className="hidden items-center gap-2 sm:flex">
                                            <span>
                                                Halaman{" "}
                                                <span className="font-semibold text-slate-800">
                                                    {currentPage}
                                                </span>{" "}
                                                dari{" "}
                                                <span className="font-semibold text-slate-800">
                                                    {totalPages}
                                                </span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* TABLE + STATES */}
                                    <div className="px-4 py-4 sm:px-6 sm:py-6">
                                        {loading ? (
                                            <div className="flex justify-center py-12">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="relative">
                                                        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                                                        <Truck className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-blue-700" />
                                                    </div>
                                                    <p className="text-sm font-medium text-slate-700">
                                                        Memuat data surat jalan...
                                                    </p>
                                                </div>
                                            </div>
                                        ) : error ? (
                                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">
                                                <div className="flex items-start gap-2">
                                                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                                    <div>
                                                        <p className="font-semibold">
                                                            Terjadi kesalahan
                                                        </p>
                                                        <p className="mt-1 text-sm">
                                                            {error}
                                                        </p>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                fetchSuratJalan()
                                                            }
                                                            className="mt-3 inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-rose-50 shadow-sm hover:bg-rose-700"
                                                        >
                                                            <RefreshCcw className="h-3.5 w-3.5" />
                                                            Coba muat ulang
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : sortedSuratJalan.length > 0 ? (
                                            <SuratJalanTable
                                                data={sortedSuratJalan}
                                                sortField={sortField}
                                                sortOrder={sortOrder}
                                                handleSort={handleSort}
                                                currentPage={currentPage}
                                                expandedId={expandedId}
                                                onToggleDetail={
                                                    handleToggleDetail
                                                }
                                                onPrint={handlePrint}
                                                detailCache={detailCache}
                                                detailLoadingId={
                                                    detailLoadingId
                                                }
                                                detailErrorMap={
                                                    detailErrorMap
                                                }
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
                                                    <FileText className="h-7 w-7 text-blue-600" />
                                                </div>
                                                <h3 className="text-sm font-semibold text-slate-800">
                                                    Tidak ada data Surat Jalan
                                                </h3>
                                                <p className="max-w-md text-xs text-slate-500">
                                                    Coba ubah kata kunci atau
                                                    field pencarian untuk
                                                    menampilkan data lainnya.
                                                    Pastikan juga koneksi ke
                                                    server berjalan dengan
                                                    baik.
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSearchInput("");
                                                        setSearchQuery("");
                                                        fetchSuratJalan();
                                                    }}
                                                    className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700"
                                                >
                                                    <RefreshCcw className="h-3.5 w-3.5" />
                                                    Reset & Muat Ulang
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* PAGINATION */}
                                    {!loading &&
                                        !error &&
                                        sortedSuratJalan.length > 0 && (
                                            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600 sm:flex-row sm:px-6">
                                                <div>
                                                    Menampilkan{" "}
                                                    <span className="font-semibold text-slate-800">
                                                        {startIndex}
                                                    </span>{" "}
                                                    sampai{" "}
                                                    <span className="font-semibold text-slate-800">
                                                        {endIndex}
                                                    </span>
                                                    {totalItems != null && (
                                                        <>
                                                            {" "}
                                                            dari{" "}
                                                            <span className="font-semibold text-slate-800">
                                                                {totalItems.toLocaleString(
                                                                    "id-ID",
                                                                )}
                                                            </span>{" "}
                                                            data
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handlePageChange(
                                                                currentPage -
                                                                    1,
                                                            )
                                                        }
                                                        disabled={
                                                            currentPage === 1
                                                        }
                                                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium ${
                                                            currentPage === 1
                                                                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                                                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                                        }`}
                                                    >
                                                        <ChevronLeft className="h-3.5 w-3.5" />
                                                        Sebelumnya
                                                    </button>

                                                    <span className="text-[11px]">
                                                        Halaman{" "}
                                                        <span className="font-semibold text-slate-800">
                                                            {currentPage}
                                                        </span>{" "}
                                                        dari{" "}
                                                        <span className="font-semibold text-slate-800">
                                                            {totalPages}
                                                        </span>
                                                    </span>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handlePageChange(
                                                                currentPage +
                                                                    1,
                                                            )
                                                        }
                                                        disabled={
                                                            currentPage ===
                                                            totalPages
                                                        }
                                                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium ${
                                                            currentPage ===
                                                            totalPages
                                                                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                                                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                                        }`}
                                                    >
                                                        Berikutnya
                                                        <ChevronRight className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                </div>

                                {/* FOOTER LINK KE DASHBOARD */}
                                <div className="mt-6 flex justify-center">
                                    <a
                                        href="/dashboard"
                                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                                    >
                                        <ChevronLeft className="h-3.5 w-3.5" />
                                        Kembali ke Dashboard
                                    </a>
                                </div>
                            </div>
                        </div>
                    </main>

                    <Footer />
                </div>
            </div>
        </div>
    );
};

export default DataSuratJalanPage;
