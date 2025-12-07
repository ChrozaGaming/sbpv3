import type { JenisPemasukan } from "./types";

export const JENIS_PEMASUKAN_OPTIONS: {
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

export const LOKASI_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Pilih Lokasi Gudang" },
  { value: "Gudang A (Utama)", label: "Gudang A (Utama)" },
  { value: "Gudang B", label: "Gudang B" },
  { value: "Gudang C", label: "Gudang C" },
  { value: "Gudang D", label: "Gudang D" },
  { value: "Gudang E", label: "Gudang E" },
];
