import React from "react";
import { Package, Plus, Search, Trash2 } from "lucide-react";

import type { JenisPemasukan, Product, StockLine } from "../types";
import { formatRupiah } from "../utils";
import { LineStatus } from "./LineStatus";

interface StockLinesTableProps {
    lines: StockLine[];
    jenisPemasukan: JenisPemasukan;
    grandTotal: number;
    onAddLine: () => void;
    onRemoveLine: (id: string) => void;
    onKodeChange: (id: string, value: string) => void;
    onQtyChange: (id: string, value: string) => void;
    onFetchProductExact: (line: StockLine) => void;
    onSelectSuggestion: (lineId: string, product: Product) => void;
}

export const StockLinesTable: React.FC<StockLinesTableProps> = ({
    lines,
    jenisPemasukan,
    grandTotal,
    onAddLine,
    onRemoveLine,
    onKodeChange,
    onQtyChange,
    onFetchProductExact,
    onSelectSuggestion,
}) => {
    return (
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
                    Cari produk (Kode Produk) dan tentukan jumlah (QTY) yang masuk.
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
                                Nama Produk &amp; Detail
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
                            const qtyNum = parseFloat(line.qty || "0");
                            const lineTotal =
                                line.product && !isNaN(qtyNum) && qtyNum > 0
                                    ? qtyNum * line.product.harga_idr
                                    : 0;

                            const rowClass = line.product
                                ? "bg-white hover:bg-teal-50/40 transition duration-150"
                                : "bg-white hover:bg-gray-50 transition duration-150";

                            const displayNama =
                                line.product && jenisPemasukan === "retur_barang"
                                    ? `[SISA RETUR] ${line.product.nama}`
                                    : line.product?.nama ?? "";

                            return (
                                <tr key={line.id} className={rowClass}>
                                    {/* Kode Produk + Search */}
                                    <td className="px-4 py-4 align-top">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={line.kode}
                                                onChange={(e) =>
                                                    onKodeChange(line.id, e.target.value)
                                                }
                                                onBlur={() => {
                                                    if (
                                                        !line.product &&
                                                        line.kode.trim() &&
                                                        line.suggestions.length === 0
                                                    ) {
                                                        onFetchProductExact(line);
                                                    }
                                                }}
                                                className="shadow-inner w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase transition duration-150 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="Ketik kode atau nama..."
                                            />
                                            <button
                                                type="button"
                                                onClick={() => onFetchProductExact(line)}
                                                disabled={line.isFetching || !line.kode.trim()}
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

                                        <LineStatus line={line} />

                                        {line.showSuggestions && line.suggestions.length > 0 && (
                                            <div className="mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white text-xs shadow-lg">
                                                {line.suggestions.map((p) => (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onClick={() => onSelectSuggestion(line.id, p)}
                                                        className="w-full px-3 py-2 text-left hover:bg-indigo-50"
                                                    >
                                                        <div className="font-semibold text-gray-800">
                                                            {p.kode} — {p.nama}
                                                        </div>
                                                        <div className="text-[11px] text-gray-500">
                                                            Brand: {p.brand} • Kategori: {p.kategori} •
                                                            Satuan: {p.satuan}
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
                                                <div className="flex items-center gap-1 font-semibold text-gray-900">
                                                    {jenisPemasukan === "retur_barang" && (
                                                        <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                                                            SISA RETUR
                                                        </span>
                                                    )}
                                                    <span>{displayNama}</span>
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    <span className="font-medium">Brand:</span>{" "}
                                                    {line.product.brand} |{" "}
                                                    <span className="font-medium">Kategori:</span>{" "}
                                                    {line.product.kategori}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-xs italic text-gray-400">
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
                                            onChange={(e) => onQtyChange(line.id, e.target.value)}
                                            className="shadow-inner w-full rounded-lg border border-gray-300 px-3 py-2 text-right text-sm transition duration-150 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="0.00"
                                        />
                                    </td>

                                    {/* Harga satuan */}
                                    <td className="px-4 py-4 align-top text-right">
                                        {line.product ? (
                                            <span className="whitespace-nowrap text-sm font-medium text-gray-700">
                                                Rp {formatRupiah(line.product.harga_idr)}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-400">-</span>
                                        )}
                                    </td>

                                    {/* Total per baris */}
                                    <td className="px-4 py-4 align-top text-right">
                                        {line.product && lineTotal > 0 ? (
                                            <span className="whitespace-nowrap text-sm font-extrabold text-indigo-700">
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
                                            onClick={() => onRemoveLine(line.id)}
                                            disabled={lines.length === 1}
                                            className="inline-flex items-center justify-center rounded-full bg-red-100 p-2 text-xs text-red-600 transition duration-150 hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-30"
                                            title={
                                                lines.length === 1
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
                                Rp {formatRupiah(grandTotal)}
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
                    onClick={onAddLine}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-md transition duration-150 hover:bg-indigo-600"
                >
                    <Plus className="h-4 w-4" />
                    Tambah Baris Produk
                </button>
                <span className="text-xs text-gray-500">
                    Total Baris Aktif: {lines.length}
                </span>
            </div>
        </div>
    );
};
