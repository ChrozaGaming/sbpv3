"use server";

import TambahProdukClient from "./TambahProdukClient";

type ProductFromApi = {
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

export default async function Page() {
    const backendUrl =
        process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

    let products: ProductFromApi[] = [];

    try {
        const res = await fetch(`${backendUrl}/api/product`, {
            cache: "no-store",
        });

        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                products = data;
            }
        } else {
            console.error(
                "[TambahProduk] Failed to fetch products:",
                res.status,
                res.statusText,
            );
        }
    } catch (err) {
        console.error("[TambahProduk] Error fetching products:", err);
    }

    return <TambahProdukClient initialProducts={products} />;
}
