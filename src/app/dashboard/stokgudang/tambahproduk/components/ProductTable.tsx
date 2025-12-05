"use client";

import {
    Database,
    ChevronDown,
    Edit2,
    Trash2,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
} from "lucide-react";
import Swal from "sweetalert2";

import {
    Product,
    Kategori,
    SortKey,
    SortDir,
    KATEGORI_OPTIONS,
    formatCurrency,
    getSatuanLabel,
    buildPageNumbers,
} from "./productTypes";

interface ProductTableProps {
    products: Product[];
    totalItems: number;
    startIndex: number;
    currentPage: number;
    pageCount: number;
    sortBy: SortKey;
    sortDir: SortDir;
    onSort: (key: SortKey) => void;
    onPageChange: (page: number) => void;
    filterKategori: Kategori | "";
    onFilterKategoriChange: (val: Kategori | "") => void;
    onEdit: (p: Product) => void;
    onDelete: (id: number, name: string) => void;
}

export const ProductTable = ({
    products,
    totalItems,
    startIndex,
    currentPage,
    pageCount,
    sortBy,
    sortDir,
    onSort,
    onPageChange,
    filterKategori,
    onFilterKategoriChange,
    onEdit,
    onDelete,
}: ProductTableProps) => {
    const canPaginate = totalItems > 0 && pageCount > 1;
    const pageNumbers = buildPageNumbers(currentPage, pageCount);

    const renderSortIcon = (key: SortKey) => {
        if (sortBy !== key) {
            return (
                <ArrowUpDown
                    size={12}
                    className="text-slate-400 group-hover:text-slate-600"
                />
            );
        }

        if (sortDir === "asc") {
            return <ArrowUp size={12} className="text-blue-600" />;
        }

        return <ArrowDown size={12} className="text-blue-600" />;
    };

    const SortableHeader = ({
        label,
        sortKey,
        align,
    }: {
        label: string;
        sortKey: SortKey;
        align?: "left" | "right" | "center";
    }) => (
        <th
            className={`px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wide ${align === "right"
                    ? "text-right"
                    : align === "center"
                        ? "text-center"
                        : "text-left"
                }`}
        >
            <button
                type="button"
                onClick={() => onSort(sortKey)}
                className={`inline-flex items-center gap-1 group ${align === "right" ? "justify-end w-full" : ""
                    }`}
            >
                <span>{label}</span>
                {renderSortIcon(sortKey)}
            </button>
        </th>
    );

    const handleDeleteClick = (p: Product) => {
        Swal.fire({
            title: "Hapus produk?",
            text: `Anda yakin ingin menghapus produk "${p.nama}" (kode: ${p.kode})? Aksi ini tidak dapat dibatalkan.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, hapus",
            cancelButtonText: "Batal",
            reverseButtons: true,
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#6b7280",
        }).then((result) => {
            if (result.isConfirmed) {
                onDelete(p.id, p.nama);
            }
        });
    };

    return (
        <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl">
            {/* Header + filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
                    <Database size={22} className="text-blue-500" />
                    Master Data Produk Terdaftar
                    <span className="text-sm font-semibold text-slate-400">
                        ({totalItems} item)
                    </span>
                </h2>

                <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm text-slate-500 font-medium">
                        Filter Kategori:
                    </span>
                    <div className="relative">
                        <select
                            value={filterKategori}
                            onChange={(e) =>
                                onFilterKategoriChange(e.target.value as Kategori | "")
                            }
                            className="appearance-none bg-white border border-slate-300 text-slate-700 py-2 pl-3 pr-9 rounded-xl text-xs sm:text-sm font-medium shadow-sm"
                        >
                            <option value="">Semua Kategori</option>
                            {KATEGORI_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <ChevronDown
                            size={14}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        />
                    </div>
                </div>
            </div>

            {/* Tabel */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <SortableHeader label="Kode" sortKey="kode" />
                            <SortableHeader label="Nama & Kategori" sortKey="nama" />
                            <SortableHeader label="Brand" sortKey="brand" />
                            <SortableHeader
                                label="Harga Satuan"
                                sortKey="harga_idr"
                                align="right"
                            />
                            <th className="px-4 py-3 text-xs font-bold text-slate-700 text-center uppercase tracking-wide">
                                Satuan
                            </th>
                            <th className="px-4 py-3 text-xs font-bold text-slate-700 text-center uppercase tracking-wide">
                                Aksi
                            </th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 bg-white">
                        {products.map((p) => (
                            <tr
                                key={p.id}
                                className="hover:bg-blue-50/40 transition-colors duration-150"
                            >
                                {/* Kode */}
                                <td className="px-4 py-3 text-sm font-bold text-slate-800">
                                    {p.kode}
                                </td>

                                {/* Nama + kategori pill */}
                                <td className="px-4 py-3 text-sm text-slate-700">
                                    <div className="font-semibold text-slate-800">{p.nama}</div>
                                    <div className="mt-1">
                                        <span
                                            className={`inline-flex items-center px-3 py-0.5 rounded-full text-[11px] font-semibold ${p.kategori === "Alat"
                                                    ? "bg-orange-100 text-orange-700"
                                                    : p.kategori === "Material"
                                                        ? "bg-teal-100 text-teal-700"
                                                        : "bg-fuchsia-100 text-fuchsia-700"
                                                }`}
                                        >
                                            {p.kategori}
                                        </span>
                                    </div>
                                </td>

                                {/* Brand */}
                                <td className="px-4 py-3 text-sm text-slate-600">
                                    {p.brand || "-"}
                                </td>

                                {/* Harga */}
                                <td className="px-4 py-3 text-sm font-bold text-emerald-700 text-right">
                                    {formatCurrency(p.harga_idr)}
                                </td>

                                {/* Satuan */}
                                <td className="px-4 py-3 text-sm text-slate-700 text-center">
                                    {getSatuanLabel(p.satuan)}
                                </td>

                                {/* Aksi */}
                                <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <button
                                            onClick={() => onEdit(p)}
                                            className="inline-flex items-center justify-center p-2 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 border border-blue-100 shadow-sm transition"
                                            title="Edit produk"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteClick(p)}
                                            className="inline-flex items-center justify-center p-2 rounded-full bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-red-100 shadow-sm transition"
                                            title="Hapus produk"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}

                        {products.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="px-4 py-6 text-center text-sm text-slate-400"
                                >
                                    Tidak ada data produk untuk filter/kata kunci saat ini.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalItems > 0 && (
                <div className="mt-4 px-2 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-xs sm:text-sm text-slate-500">
                        Menampilkan{" "}
                        <span className="font-semibold">{startIndex + 1}</span> –{" "}
                        <span className="font-semibold">
                            {startIndex + products.length}
                        </span>{" "}
                        dari <span className="font-semibold">{totalItems}</span> data
                    </p>

                    {canPaginate && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => onPageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 text-xs md:text-sm rounded-lg border border-slate-300 bg-white shadow-sm hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Prev
                            </button>

                            {pageNumbers.map((p, idx) =>
                                p === "..." ? (
                                    <span
                                        key={`ellipsis-${idx}`}
                                        className="px-2 text-slate-400 text-sm"
                                    >
                                        ...
                                    </span>
                                ) : (
                                    <button
                                        key={p}
                                        onClick={() => onPageChange(p as number)}
                                        className={`px-3 py-1.5 text-xs md:text-sm rounded-lg border ${p === currentPage
                                                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                                            } transition`}
                                    >
                                        {p}
                                    </button>
                                ),
                            )}

                            <button
                                onClick={() => onPageChange(currentPage + 1)}
                                disabled={currentPage === pageCount}
                                className="px-3 py-1.5 text-xs md:text-sm rounded-lg border border-slate-300 bg-white shadow-sm hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
