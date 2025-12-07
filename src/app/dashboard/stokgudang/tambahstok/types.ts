export type JenisPemasukan = "pembelian_po" | "retur_barang";

export interface Product {
  id: number;
  kode: string;
  nama: string;
  brand: string;
  kategori: string;
  satuan: string;
  harga_idr: number;
}

export interface StockLine {
  id: string;
  kode: string;
  qty: string;
  product?: Product;
  isFetching: boolean;
  error?: string;
  suggestions: Product[];
  showSuggestions: boolean;
}
