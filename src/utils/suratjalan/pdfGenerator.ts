// src/utils/suratjalan/pdfGenerator.ts

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// =======================
//  TIPE DATA DARI BACKEND
// =======================
// Sesuai response Rust:
//
// pub struct SuratJalanWithDetails {
//   pub header: SuratJalanHeader,
//   pub items: Vec<SuratJalanDetailRow>,
// }

export interface SuratJalanHeaderApi {
  id: number;
  tujuan: string;
  nomor_surat: string;
  tanggal: string; // NaiveDate di backend → string ISO di JSON
  nomor_kendaraan: string | null;
  no_po: string | null;
  keterangan_proyek: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SuratJalanDetailItemApi {
  id: number;
  surat_jalan_id: number;
  no_urut: number;
  quantity: number;
  unit: string;
  weight: number | null;
  kode_barang: string;
  nama_barang: string;
}

export interface SuratJalanDetailResponseApi {
  header: SuratJalanHeaderApi;
  items: SuratJalanDetailItemApi[];
}

// =======================
//  TIPE DATA UNTUK PDF
// =======================

interface BarangDetail {
  kode: string | null;
  nama: string | null;
  jumlah: number | null;
  satuan: string | null;
}

interface SuratJalanPdfPayload {
  nomor_surat: string;
  tujuan: string;
  tanggal: string;
  nomor_kendaraan: string | null;
  no_po: string | null;
  barang: BarangDetail[];
  keterangan_proyek?: string;
}

// Konfigurasi warna untuk 4 kopian berbeda
interface ColorTheme {
  name: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  watermarkText: string;
}

const THEMES: ColorTheme[] = [
  {
    name: "Putih-ACC",
    backgroundColor: "#FFFFFF",
    borderColor: "#000000",
    textColor: "#000000",
    watermarkText: "ACC",
  },
  {
    name: "Pink-AdmGudang",
    backgroundColor: "#FFCCCB", // Pink light
    borderColor: "#000000",
    textColor: "#000000",
    watermarkText: "ADM. GUDANG",
  },
  {
    name: "Hijau-Penerima",
    backgroundColor: "#C6EFC6", // Light green
    borderColor: "#000000",
    textColor: "#000000",
    watermarkText: "PENERIMA",
  },
  {
    name: "Kuning-Arsip",
    backgroundColor: "#FFF9C4", // Light yellow
    borderColor: "#000000",
    textColor: "#000000",
    watermarkText: "ARSIP",
  },
];

// =======================
//  HELPER FORMAT TANGGAL
// =======================

const formatTanggal = (tanggal: string): string => {
  const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  const bulan = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const date = new Date(tanggal);
  if (Number.isNaN(date.getTime())) {
    // fallback kalau string tanggal aneh
    return tanggal;
  }

  const namaHari = hari[date.getDay()];
  const tgl = date.getDate().toString().padStart(2, "0");
  const namaBulan = bulan[date.getMonth()];
  const tahun = date.getFullYear();

  return `${namaHari}, ${tgl} ${namaBulan} ${tahun}`;
};

// Mapping dari bentuk API → bentuk payload PDF
const mapApiToPdfPayload = (
  apiData: SuratJalanDetailResponseApi
): SuratJalanPdfPayload => {
  const { header, items } = apiData;

  const barang: BarangDetail[] = items.map((it) => ({
    kode: it.kode_barang ?? null,
    nama: it.nama_barang ?? null,
    jumlah: it.quantity ?? null,
    satuan: it.unit ?? null,
  }));

  return {
    nomor_surat: header.nomor_surat,
    tujuan: header.tujuan,
    tanggal: header.tanggal,
    nomor_kendaraan: header.nomor_kendaraan ?? null,
    no_po: header.no_po ?? null,
    keterangan_proyek: header.keterangan_proyek ?? undefined,
    barang,
  };
};

// =======================
//  FUNGSI UTAMA CETAK PDF
// =======================

/**
 * Dipanggil dari FE dengan response GET /api/surat-jalan/{id}
 * Contoh:
 *   const res = await fetch("/api/surat-jalan/123");
 *   const data = await res.json();
 *   generateSuratJalanPdf(data);
 */
export const generateSuratJalanPdf = (apiData: SuratJalanDetailResponseApi) => {
  // Guard untuk SSR / server side
  if (typeof window === "undefined") {
    console.warn("generateSuratJalanPdf hanya boleh dipanggil di client.");
    return;
  }

  if (!apiData || !apiData.items || !Array.isArray(apiData.items)) {
    console.error("Data surat jalan dari API tidak valid:", apiData);
    alert("Data surat jalan tidak valid. Tidak dapat mencetak PDF.");
    return;
  }

  const payload = mapApiToPdfPayload(apiData);

  if (!payload.barang || payload.barang.length === 0) {
    alert(
      "Surat jalan ini tidak memiliki data barang. Tidak dapat mencetak PDF."
    );
    return;
  }

  // Buat satu dokumen PDF
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "A5",
  });

  // Buat 4 halaman dengan warna berbeda dalam 1 dokumen PDF
  THEMES.forEach((theme, index) => {
    // Tambahkan halaman baru kecuali untuk halaman pertama
    if (index > 0) {
      doc.addPage("a5", "landscape");
    }

    generatePageWithTheme(doc as any, payload, theme);
  });

  // Simpan satu file PDF dengan 4 halaman
  doc.save(`Surat_Jalan_${payload.nomor_surat}_SBP.pdf`);
};

// =======================
//  RENDER SATU HALAMAN
// =======================

const generatePageWithTheme = (
  doc: any,
  item: SuratJalanPdfPayload,
  theme: ColorTheme
) => {
  const { nomor_surat, tujuan, tanggal, barang, no_po, nomor_kendaraan } = item;
  const keteranganProyek = item.keterangan_proyek || "-";
  const rowsPerPage = 10; // Max rows per page
  const scale = 0.7; // Skala untuk memperkecil ukuran footer

  // Aplikasikan Watermark
  doc.setFontSize(40);
  doc.setTextColor(230, 230, 230); // Light gray watermark
  doc.setFont("helvetica", "bold");
  doc.text(theme.watermarkText, 155, 11, {
    align: "center",
    angle: 0,
  });

  // Header (Logo + Title)
  const logoUrl = "https://i.imgur.com/AY0XZbq.jpeg";
  // Catatan: idealnya ini pakai dataURL base64 agar lebih stabil
  try {
    doc.addImage(logoUrl, "JPEG", 10, 1.5, 90, 20);
  } catch (e) {
    console.warn(
      "Gagal memuat logo dari URL. Pertimbangkan ganti ke base64 dataURL.",
      e
    );
  }

  const titleX = 145;
  const titleY = 15;
  const titleAlign: "left" | "center" | "right" = "center";

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("SURAT JALAN / DELIVERY ORDER", titleX, titleY, {
    align: titleAlign,
  });

  // Detail Header
  const detailStartY = titleY + 10;

  // Tujuan dibungkus (wrap) supaya tidak kepanjangan
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");

  const marginLeft = 10;
  const marginRight = 70;
  const maxWidth = marginRight - marginLeft;

  doc.text(`Kepada Yth: ${tujuan}`, marginLeft, detailStartY, {
    maxWidth,
  });

  doc.setFontSize(8);

  // No surat, tanggal, proyek, PO, kendaraan
  doc.text(`No: ${nomor_surat}`, 147, detailStartY - 5);
  doc.text(`Tgl / Date: ${formatTanggal(tanggal)}`, 147, detailStartY + 4);

  // Keterangan Proyek (2 baris)
  doc.text("Keterangan Proyek:", 105, detailStartY, { align: "center" });

  const truncatedKeterangan = keteranganProyek.slice(0, 120);
  doc.text(truncatedKeterangan, 105, detailStartY + 5, {
    align: "center",
    maxWidth: 70,
  });

  doc.text(`No. PO: ${no_po || "-"}`, 171, detailStartY + 0, {
    align: "right",
  });
  doc.text(`No. Kendaraan: ${nomor_kendaraan || "-"}`, 180, detailStartY + 8, {
    align: "right",
  });

  // ===================
  //  TABEL BARANG
  // ===================

  const tableStartY = detailStartY + 15;

  const tableData = (barang || [])
    .slice(0, rowsPerPage)
    .map((b, index) => [
      index + 1,
      b.jumlah ?? "",
      b.satuan ?? "",
      b.kode ?? "",
      b.nama ?? "",
      "",
    ]);

  // Tambah baris kosong jika kurang dari rowsPerPage
  while (tableData.length < rowsPerPage) {
    tableData.push(["", "", "", "", "", ""]);
  }

  // 🔧 PAKAI FUNGSI autoTable, BUKAN doc.autoTable
  autoTable(doc, {
    startY: tableStartY,
    head: [["No", "Jumlah", "Satuan", "No. Kode", "Nama Barang", "Keterangan"]],
    body: tableData,
    styles: {
      fontSize: 8,
      halign: "center",
      valign: "middle",
      lineWidth: 0.2,
      cellPadding: 2,
      fillColor: theme.backgroundColor,
    },
    headStyles: {
      fillColor: theme.backgroundColor,
      textColor: 0,
      lineWidth: 0.5,
      lineColor: theme.borderColor,
    },
    bodyStyles: {
      lineColor: theme.borderColor,
    },
    theme: "grid",
    tableLineColor: theme.borderColor,
    tableLineWidth: 0.5,
  } as any);

  // ===================
  //  FOOTER TTD + LEGEND
  // ===================

  const lastTable = (doc as any).lastAutoTable;
  const footerStartY = (lastTable?.finalY ?? tableStartY) + 3;

  const boxWidth = 26.4;
  const footerBoxHeight = 15;
  const boxSpacing = 10;

  const drawFooterGroup = (startX: number, startY: number) => {
    doc.setFontSize(6);

    // Barang Diterima Oleh
    doc.rect(startX, startY, boxWidth + 10, footerBoxHeight + 5);
    doc.text("Barang Diterima Oleh:", startX + 2, startY + 2.3);
    doc.text("Tgl:", startX + 2, startY + 5);
    doc.text("Nama Jelas / Stempel", startX + 2, startY + 19);

    // Supir
    const supirX = startX + boxWidth + boxSpacing;
    doc.rect(supirX, startY, boxWidth + 10, footerBoxHeight + 5);
    doc.text("Supir", supirX + 15, startY + 19);

    // Satpam
    const satpamX = startX + (boxWidth + boxSpacing) * 2;
    doc.rect(satpamX, startY, boxWidth + 10, footerBoxHeight + 5);
    doc.text("Satpam", satpamX + 14, startY + 19);

    // Pengawas
    const pengawasX = startX + (boxWidth + boxSpacing) * 3;
    doc.rect(pengawasX, startY, boxWidth + 10, footerBoxHeight + 5);
    doc.text("Pengawas", pengawasX + 13.5, startY + 19);

    // Kepala Gudang
    const kepalaGudangX = startX + (boxWidth + boxSpacing) * 4;
    doc.rect(kepalaGudangX, startY, boxWidth + 10, footerBoxHeight + 5);
    doc.text("Hormat Kami", kepalaGudangX + 11.3, startY + 2.4);
    doc.text("Kepala Gudang", kepalaGudangX + 10.5, startY + 19);
  };

  drawFooterGroup(14, footerStartY);

  const drawFooterNote = (xOffset: number, yOffset: number, s: number) => {
    const baseFontSize = 8 * s;
    doc.setFontSize(baseFontSize);

    const y = footerStartY + yOffset;
    doc.text("Keterangan:", 10 + xOffset, y);
    doc.text("Putih: ACC", 50 + xOffset, y);
    doc.text("Pink: Adm. Gudang", 90 + xOffset, y);
    doc.text("Hijau: Penerima", 150 + xOffset, y);
    doc.text("Kuning: Arsip", 190 + xOffset, y);
  };

  const xOffset = 0;
  const yOffset = 24.5;
  drawFooterNote(xOffset, yOffset, scale);
};
