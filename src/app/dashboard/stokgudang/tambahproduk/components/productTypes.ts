"use client";

export type Kategori = "Alat" | "Material" | "Consumable";

export type Satuan =
  | "kg"
  | "kgset"
  | "liter"
  | "literset"
  | "pail"
  | "galon5liter"
  | "galon10liter"
  | "pcs"
  | "lonjor"
  | "sak"
  | "unit"
  | "drum";

export type SortKey =
  | "id"
  | "kode"
  | "nama"
  | "brand"
  | "kategori"
  | "harga_idr";
export type SortDir = "asc" | "desc";

// Bentuk data dari backend (ProductPublic)
export type ProductFromApi = {
  id: number;
  kode: string;
  nama: string;
  brand: string;
  kategori: string;
  satuan: string;
  harga_idr: number;
  created_at: string;
  updated_at: string;
};

// Bentuk data internal di client
export interface Product {
  id: number;
  kode: string;
  nama: string;
  brand: string;
  kategori: Kategori;
  satuan: Satuan;
  harga_idr: number;
  created_at: string;
  updated_at: string;
}

export interface FormState {
  kode: string;
  nama: string;
  brand: string;
  kategori: Kategori | "";
  satuan: Satuan | "";
  harga_idr: string;
}

export interface NotificationState {
  id: number;
  message: string;
  type: "success" | "error";
}

export interface TambahProdukClientProps {
  initialProducts: ProductFromApi[];
}

export const KATEGORI_OPTIONS: { value: Kategori; label: string }[] = [
  { value: "Alat", label: "Alat (Tools)" },
  { value: "Material", label: "Material (Bahan Baku)" },
  { value: "Consumable", label: "Consumable (Habis Pakai)" },
];

export const SATUAN_OPTIONS: { value: Satuan; label: string }[] = [
  { value: "kg", label: "Kilogram (Kg)" },
  { value: "kgset", label: "Kilogram Set (Kg Set)" },
  { value: "liter", label: "Liter (L)" },
  { value: "literset", label: "Liter Set (L Set)" },
  { value: "pail", label: "Pail" },
  { value: "galon5liter", label: "Galon 5 Liter" },
  { value: "galon10liter", label: "Galon 10 Liter" },
  { value: "pcs", label: "Pieces (Pcs)" },
  { value: "lonjor", label: "Lonjor" },
  { value: "sak", label: "Sak" },
  { value: "unit", label: "Unit" },
  { value: "drum", label: "Drum" },
];

// --- Utilities ---

export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

export const formatNumberString = (amount: number): string =>
  new Intl.NumberFormat("id-ID").format(amount);

export const getSatuanLabel = (value: Satuan) => {
  return (
    SATUAN_OPTIONS.find((opt) => opt.value === value)
      ?.label.split("(")[0]
      .trim() || value
  );
};

export function normalizeProductFromApi(p: ProductFromApi): Product {
  return {
    ...p,
    kategori: p.kategori as Kategori,
    satuan: p.satuan as Satuan,
  };
}

// Helper pagination
export function buildPageNumbers(
  current: number,
  total: number
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
