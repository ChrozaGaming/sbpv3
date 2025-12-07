export interface StockItem {
  id: number;
  kode: string;
  nama: string;
  brand: string;
  kategori: string;
  harga_idr: number;
  stok_sisa: number;
  satuan_nama: string;
  lokasi: string;
  tanggal_masuk?: string | null;
  created_at?: string | null;
}

export interface Movement {
  id: number;
  stok_id: number;
  jenis: string; // "MASUK" | "KELUAR"
  qty: number;
  satuan_id: number;
  sumber_tujuan?: string;
  keterangan?: string;
  created_at: string;
  jenis_pemasukan?: string | null; // "PEMBELIAN_PO" | "RETUR_BARANG" | null
}

export interface InventoryDashboardProps {
  initialStocks: StockItem[];
  initialMovements: Movement[];
}
