"use server";

import InventoryDashboardClient from "./InventoryDashboardClient";
export default async function Page() {
  const backendUrl = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

  // Fetch stok & movement secara paralel di server
  const [stokRes, moveRes] = await Promise.all([
    fetch(`${backendUrl}/api/stok`, { cache: "no-store" }),
    fetch(`${backendUrl}/api/stok/movements/recent`, { cache: "no-store" }),
  ]);

  const [stocks, movements] = await Promise.all([
    stokRes.json(),
    moveRes.json(),
  ]);

  return (
    <InventoryDashboardClient
      initialStocks={stocks}
      initialMovements={movements}
    />
  );
}
