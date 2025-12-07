import React, { useEffect, useMemo, useState } from "react";
import { Search, Package, ArrowUpDown, Trash2, Loader2 } from "lucide-react";

import type { StockItem } from "../types";
import { formatIDR } from "../utils";

type SortKey =
    | "kode"
    | "nama"
    | "brand"
    | "lokasi"
    | "stok_sisa"
    | "satuan_nama"
    | "harga_idr"
    | "harga_total"
    | "tanggal_masuk"
    | "created_at";

type SortDirection = "asc" | "desc";

interface InventoryTableProps {
    stocks: StockItem[];
    onDelete: (item: StockItem) => void;
    deletingId: number | null;
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
    stocks,
    onDelete,
    deletingId,
}) => {
    const [search, setSearch] = useState("");
    const [showReturOnly, setShowReturOnly] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [sortConfig, setSortConfig] = useState<{
        key: SortKey;
        direction: SortDirection;
    }>({
        key: "created_at",
        direction: "desc",
    });

    const isReturStockFn = (item: StockItem) =>
        item.nama?.startsWith("[SISA RETUR]") ?? false;

    useEffect(() => {
        setCurrentPage(1);
    }, [search, showReturOnly]);

    const handleSort = (key: SortKey) => {
        setSortConfig((prev) => {
            if (prev.key === key) {
                return {
                    key,
                    direction: prev.direction === "asc" ? "desc" : "asc",
                };
            }

            let defaultDirection: SortDirection = "asc";
            if (
                key === "stok_sisa" ||
                key === "harga_idr" ||
                key === "harga_total" ||
                key === "created_at" ||
                key === "tanggal_masuk"
            ) {
                defaultDirection = "desc";
            }

            return { key, direction: defaultDirection };
        });
    };

    const renderSortIcon = (key: SortKey) => {
        if (sortConfig.key !== key) {
            return (
                <ArrowUpDown
                    size={14}
                    className="ml-1 text-slate-400 inline-block"
                />
            );
        }

        return (
            <span className="ml-1 text-[10px] text-blue-600 inline-block">
                {sortConfig.direction === "asc" ? "▲" : "▼"}
            </span>
        );
    };

    const processed = useMemo(() => {
        let base = [...stocks];

        if (search.trim()) {
            const q = search.toLowerCase();
            base = base.filter(
                (s) =>
                    s.kode.toLowerCase().includes(q) ||
                    s.nama.toLowerCase().includes(q) ||
                    s.brand.toLowerCase().includes(q) ||
                    (s.lokasi || "").toLowerCase().includes(q),
            );
        }

        if (showReturOnly) {
            base = base.filter((s) => isReturStockFn(s));
        }

        const { key, direction } = sortConfig;
        const factor = direction === "asc" ? 1 : -1;

        base.sort((a, b) => {
            const numCompare = (av: number, bv: number) => (av - bv) * factor;
            const strCompare = (av: string, bv: string) =>
                av.localeCompare(bv) * factor;

            switch (key) {
                case "kode":
                    return strCompare(a.kode || "", b.kode || "");
                case "nama":
                    return strCompare(a.nama || "", b.nama || "");
                case "brand":
                    return strCompare(a.brand || "", b.brand || "");
                case "lokasi":
                    return strCompare(a.lokasi || "", b.lokasi || "");
                case "stok_sisa":
                    return numCompare(a.stok_sisa ?? 0, b.stok_sisa ?? 0);
                case "satuan_nama":
                    return strCompare(a.satuan_nama || "", b.satuan_nama || "");
                case "harga_idr":
                    return numCompare(a.harga_idr ?? 0, b.harga_idr ?? 0);
                case "harga_total": {
                    const at = (a.stok_sisa ?? 0) * (a.harga_idr ?? 0);
                    const bt = (b.stok_sisa ?? 0) * (b.harga_idr ?? 0);
                    return numCompare(at, bt);
                }
                case "tanggal_masuk": {
                    const ad = a.tanggal_masuk
                        ? new Date(a.tanggal_masuk).getTime()
                        : 0;
                    const bd = b.tanggal_masuk
                        ? new Date(b.tanggal_masuk).getTime()
                        : 0;
                    return numCompare(ad, bd);
                }
                case "created_at":
                default: {
                    const ad = a.created_at
                        ? new Date(a.created_at).getTime()
                        : 0;
                    const bd = b.created_at
                        ? new Date(b.created_at).getTime()
                        : 0;

                    if (ad === 0 && bd === 0) {
                        return numCompare(a.id ?? 0, b.id ?? 0);
                    }
                    return numCompare(ad, bd);
                }
            }
        });

        return base;
    }, [stocks, search, showReturOnly, sortConfig]);

    const pageCount = Math.max(1, Math.ceil(processed.length / itemsPerPage));
    const safeCurrentPage = Math.min(currentPage, pageCount);
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    const pageItems = processed.slice(startIndex, startIndex + itemsPerPage);

    function buildPageNumbers(
        current: number,
        total: number,
    ): (number | string)[] {
        const pages: (number | string)[] = [];
        if (total <= 5) {
            for (let i = 1; i <= total; i++) pages.push(i);
            return pages;
        }

        pages.push(1);

        if (current > 3) {
            pages.push("...");
        }

        const start = Math.max(2, current - 1);
        const end = Math.min(total - 1, current + 1);

        for (let i = start; i <= end; i++) {
            if (!pages.includes(i)) pages.push(i);
        }

        if (current < total - 2) {
            pages.push("...");
        }

        if (!pages.includes(total)) {
            pages.push(total);
        }

        return pages;
    }

    const pageNumbers = buildPageNumbers(safeCurrentPage, pageCount);

    const handleGoToPage = (page: number) => {
        if (page < 1 || page > pageCount) return;
        setCurrentPage(page);
    };

    return (
        <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-8 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-2 border-b border-blue-500/20 gap-4">
                <h2 className="text-2xl font-extrabold text-slate-700 flex items-center gap-3">
                    <Package size={24} className="text-blue-500" /> Total Stok Gudang
                </h2>

                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex items-center bg-slate-50 border border-slate-300 px-4 py-2 rounded-xl">
                        <Search size={18} className="text-slate-400" />
                        <input
                            type="text"
                            placeholder="Cari SKU / Nama / Brand..."
                            className="bg-transparent border-none outline-none text-sm ml-3 w-full text-slate-700"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-600 select-none">
                        <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-400"
                            checked={showReturOnly}
                            onChange={(e) => setShowReturOnly(e.target.checked)}
                        />
                        <span>
                            Tampilkan{" "}
                            <span className="font-semibold">Sisa Retur Barang</span> Saja
                        </span>
                    </label>
                </div>
            </div>

            <div className="overflow-x-auto mt-6 rounded-xl border border-slate-200 shadow-lg">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-blue-50">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-blue-800 uppercase tracking-wider text-left">
                                No.
                            </th>

                            <th className="px-6 py-4 text-xs font-bold text-blue-800 uppercase tracking-wider text-left">
                                <button
                                    type="button"
                                    onClick={() => handleSort("kode")}
                                    className="inline-flex items-center"
                                >
                                    <span>Kode</span>
                                    {renderSortIcon("kode")}
                                </button>
                            </th>

                            <th className="px-6 py-4 text-xs font-bold text-blue-800 uppercase tracking-wider text-left">
                                <button
                                    type="button"
                                    onClick={() => handleSort("nama")}
                                    className="inline-flex items-center"
                                >
                                    <span>Nama Produk</span>
                                    {renderSortIcon("nama")}
                                </button>
                            </th>

                            <th className="px-6 py-4 text-xs font-bold text-blue-800 uppercase tracking-wider text-left">
                                <button
                                    type="button"
                                    onClick={() => handleSort("brand")}
                                    className="inline-flex items-center"
                                >
                                    <span>Brand</span>
                                    {renderSortIcon("brand")}
                                </button>
                            </th>

                            <th className="px-6 py-4 text-xs font-bold text-blue-800 uppercase tracking-wider text-left">
                                <button
                                    type="button"
                                    onClick={() => handleSort("lokasi")}
                                    className="inline-flex items-center"
                                >
                                    <span>Lokasi</span>
                                    {renderSortIcon("lokasi")}
                                </button>
                            </th>

                            <th className="px-6 py-4 text-xs font-bold text-blue-800 uppercase tracking-wider text-left">
                                <button
                                    type="button"
                                    onClick={() => handleSort("stok_sisa")}
                                    className="inline-flex items-center"
                                >
                                    <span>Stok Sisa</span>
                                    {renderSortIcon("stok_sisa")}
                                </button>
                            </th>

                            <th className="px-6 py-4 text-xs font-bold text-blue-800 uppercase tracking-wider text-left">
                                <button
                                    type="button"
                                    onClick={() => handleSort("satuan_nama")}
                                    className="inline-flex items-center"
                                >
                                    <span>Satuan</span>
                                    {renderSortIcon("satuan_nama")}
                                </button>
                            </th>

                            <th className="px-6 py-4 text-xs font-bold text-blue-800 uppercase tracking-wider text-left">
                                <button
                                    type="button"
                                    onClick={() => handleSort("harga_idr")}
                                    className="inline-flex items-center"
                                >
                                    <span>Harga Satuan</span>
                                    {renderSortIcon("harga_idr")}
                                </button>
                            </th>

                            <th className="px-6 py-4 text-xs font-bold text-blue-800 uppercase tracking-wider text-left">
                                <button
                                    type="button"
                                    onClick={() => handleSort("harga_total")}
                                    className="inline-flex items-center"
                                >
                                    <span>Harga Total</span>
                                    {renderSortIcon("harga_total")}
                                </button>
                            </th>

                            <th className="px-6 py-4 text-xs font-bold text-blue-800 uppercase tracking-wider text-right">
                                Aksi
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {pageItems.map((item, i) => {
                            const hargaTotal = item.stok_sisa * item.harga_idr;
                            const isReturStock = isReturStockFn(item);

                            const rowClass = isReturStock
                                ? "bg-orange-50/60 hover:bg-orange-50 border-l-4 border-orange-400"
                                : "hover:bg-slate-50";

                            return (
                                <tr key={item.id} className={rowClass}>
                                    <td className="px-6 py-4 text-sm text-slate-500 font-semibold">
                                        {startIndex + i + 1}.
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                                        {item.kode}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-700 font-semibold">
                                        <div className="flex items-center gap-2">
                                            {isReturStock && (
                                                <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">
                                                    SISA RETUR
                                                </span>
                                            )}
                                            <span>{item.nama}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {item.brand}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        {item.lokasi}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-emerald-700">
                                        {item.stok_sisa}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-700">
                                        {item.satuan_nama}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                                        {formatIDR(item.harga_idr)}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-extrabold text-slate-900">
                                        {formatIDR(hargaTotal)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right">
                                        <button
                                            type="button"
                                            onClick={() => onDelete(item)}
                                            disabled={deletingId === item.id}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50/80 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {deletingId === item.id ? (
                                                <>
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    <span>Menghapus...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    <span>Hapus</span>
                                                </>
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {pageItems.length === 0 && (
                            <tr>
                                <td
                                    colSpan={10}
                                    className="px-6 py-6 text-center text-sm text-slate-400"
                                >
                                    Tidak ada data stok.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {processed.length > 0 && (
                <div className="mt-4 px-2 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-slate-500">
                        Menampilkan{" "}
                        <span className="font-semibold">{startIndex + 1}</span> –{" "}
                        <span className="font-semibold">
                            {startIndex + pageItems.length}
                        </span>{" "}
                        dari{" "}
                        <span className="font-semibold">{processed.length}</span> data
                    </p>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => handleGoToPage(safeCurrentPage - 1)}
                            disabled={safeCurrentPage === 1}
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
                                    onClick={() => handleGoToPage(p as number)}
                                    className={`px-3 py-1.5 text-xs md:text-sm rounded-lg border ${p === safeCurrentPage
                                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                                        } transition`}
                                >
                                    {p}
                                </button>
                            ),
                        )}

                        <button
                            onClick={() => handleGoToPage(safeCurrentPage + 1)}
                            disabled={safeCurrentPage === pageCount}
                            className="px-3 py-1.5 text-xs md:text-sm rounded-lg border border-slate-300 bg-white shadow-sm hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
