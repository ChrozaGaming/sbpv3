/**
 * Print Slip Gaji — A5 Landscape
 *
 * Pure utility function. Tidak butuh React.
 * Buka tab baru → render HTML slip → auto window.print()
 *
 * Usage:
 *   import { printSlipGaji } from "@/lib/print/slip-gaji";
 *   printSlipGaji(row, "Ahmad Fauzi");
 */

/* ===========================
   Types (minimal, decoupled)
   =========================== */

export interface SlipGajiData {
  penggajian_id: string;
  pegawai_id: string;

  periode_mulai: string;
  periode_akhir: string;
  tipe_gaji: string;

  jumlah_hari_kerja?: number | null;
  upah_per_hari?: number | null;

  upah_pokok: number;
  uang_lembur: number;
  tunjangan_makan: number;
  tunjangan_transport: number;
  tunjangan_lain: number;
  bonus: number;
  total_pendapatan: number;

  potongan_kasbon: number;
  potongan_bpjs: number;
  potongan_pph21: number;
  potongan_lain: number;
  total_potongan: number;

  gaji_bersih: number;

  status_gaji: string;
  tanggal_bayar?: string | null;
  metode_bayar?: string | null;
  catatan?: string | null;
}

export interface SlipGajiOptions {
  /** Nama perusahaan (default: PT. SBP Epoxy Contractor) */
  companyName?: string;
  /** Alamat perusahaan */
  companyAddress?: string;
  /** Singkatan logo (default: SBP) */
  companyLogo?: string;
}

/* ===========================
   Helpers
   =========================== */

function idr(n: number): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

function dateLong(d?: string | null): string {
  if (!d) return "-";
  const dt = new Date(`${d}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return d;
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(dt);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildRows(items: [string, number][]): string {
  const filtered = items.filter(([, v]) => v > 0);
  if (filtered.length === 0) {
    return `<tr class="row-empty"><td colspan="2">Tidak ada komponen</td></tr>`;
  }
  return filtered
    .map(([label, val]) => `<tr><td>${label}</td><td>Rp ${idr(val)}</td></tr>`)
    .join("\n");
}

/* ===========================
   CSS
   =========================== */

function buildCSS(): string {
  return `
  @page {
    size: A5 landscape;
    margin: 0;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 210mm;
    height: 148mm;
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    font-size: 9px;
    color: #1e293b;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .slip {
    width: 210mm;
    height: 148mm;
    padding: 8mm 10mm 6mm 10mm;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  /* Decorative top bar */
  .slip::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 4mm;
    background: linear-gradient(135deg, #0f172a 0%, #334155 50%, #0f172a 100%);
  }

  /* Watermark */
  .watermark {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-25deg);
    font-size: 52px;
    font-weight: 900;
    color: rgba(15, 23, 42, 0.03);
    letter-spacing: 12px;
    text-transform: uppercase;
    pointer-events: none;
    white-space: nowrap;
  }

  /* Header */
  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-top: 2mm;
    padding-bottom: 3mm;
    border-bottom: 1.5px solid #e2e8f0;
  }
  .company-block { display: flex; align-items: center; gap: 3mm; }
  .company-logo {
    width: 11mm; height: 11mm;
    border-radius: 3mm;
    background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 900; font-size: 14px;
    letter-spacing: -0.5px;
    flex-shrink: 0;
  }
  .company-name { font-size: 13px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px; }
  .company-sub { font-size: 8px; color: #64748b; margin-top: 1px; }

  .slip-title-block { text-align: right; }
  .slip-title {
    font-size: 14px; font-weight: 900; color: #0f172a;
    letter-spacing: 1.5px; text-transform: uppercase;
  }
  .slip-ref { font-size: 8px; color: #64748b; margin-top: 1px; }

  /* Info Grid */
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 2mm;
    margin: 3mm 0;
    padding: 2.5mm 3mm;
    background: #f8fafc;
    border-radius: 2mm;
    border: 0.5px solid #e2e8f0;
  }
  .info-label {
    font-size: 7px; color: #94a3b8;
    text-transform: uppercase; letter-spacing: 0.7px; font-weight: 600;
  }
  .info-value { font-size: 9.5px; font-weight: 700; color: #0f172a; margin-top: 0.5mm; }
  .info-value-sm { font-size: 8.5px; font-weight: 600; color: #334155; margin-top: 0.5mm; }

  /* Body split */
  .body {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4mm;
    margin-top: 1mm;
    min-height: 0;
  }

  /* Section cards */
  .section-card {
    border: 0.5px solid #e2e8f0;
    border-radius: 2mm;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .section-header {
    padding: 2mm 3mm;
    font-size: 8px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 1px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .section-header.earn {
    background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
    color: #065f46;
    border-bottom: 0.5px solid #a7f3d0;
  }
  .section-header.deduct {
    background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%);
    color: #991b1b;
    border-bottom: 0.5px solid #fca5a5;
  }
  .section-total { font-size: 10px; font-weight: 900; }

  table { width: 100%; border-collapse: collapse; }
  table td {
    padding: 1.5mm 3mm;
    font-size: 8.5px;
    border-bottom: 0.5px solid #f1f5f9;
  }
  table tr:last-child td { border-bottom: none; }
  table td:last-child {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  table td:first-child { color: #475569; }
  .row-empty td {
    color: #94a3b8;
    font-style: italic;
    text-align: center !important;
  }

  /* Netto bar */
  .netto-bar {
    margin-top: 2mm;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    border-radius: 2mm;
    padding: 3mm 4mm;
    display: flex; align-items: center; justify-content: space-between;
    color: #fff;
  }
  .netto-label {
    font-size: 9px; font-weight: 700;
    letter-spacing: 0.5px; text-transform: uppercase;
  }
  .netto-label span {
    font-size: 7.5px; font-weight: 400;
    color: #94a3b8; display: block; margin-top: 0.5mm;
  }
  .netto-amount { font-size: 17px; font-weight: 900; letter-spacing: -0.3px; }

  /* Footer */
  .footer-row {
    margin-top: auto;
    padding-top: 2mm;
    display: flex; align-items: flex-end; justify-content: space-between;
  }
  .sig-block { text-align: center; width: 32mm; }
  .sig-label {
    font-size: 7px; color: #94a3b8;
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  .sig-line {
    margin-top: 10mm;
    border-top: 0.5px solid #cbd5e1;
    padding-top: 1mm;
  }
  .sig-name { font-size: 8px; font-weight: 700; color: #0f172a; }
  .sig-role { font-size: 7px; color: #64748b; }

  .footer-note {
    text-align: center;
    font-size: 6.5px; color: #94a3b8;
    flex: 1; padding: 0 4mm;
  }
  .cut-line {
    margin-top: 1mm;
    border: none;
    border-top: 1px dashed #cbd5e1;
  }

  @media print {
    body { margin: 0; padding: 0; }
    .slip { page-break-after: avoid; }
  }
`;
}

/* ===========================
   HTML builder
   =========================== */

function buildHTML(
  data: SlipGajiData,
  pegawaiName: string,
  opts: Required<SlipGajiOptions>,
): string {
  const slipId = data.penggajian_id.slice(0, 13).toUpperCase();
  const periode = `${dateLong(data.periode_mulai)} — ${dateLong(data.periode_akhir)}`;
  const tglCetak = dateLong(todayStr());
  const tglBayar = data.tanggal_bayar ? dateLong(data.tanggal_bayar) : "-";
  const metode = data.metode_bayar ? capitalize(data.metode_bayar) : "-";
  const tipe = capitalize(data.tipe_gaji);

  const hariKerjaInfo =
    data.tipe_gaji === "harian" && data.jumlah_hari_kerja
      ? `${data.jumlah_hari_kerja} hari &times; Rp ${idr(data.upah_per_hari ?? 0)}/hari`
      : "";

  const pendapatanRows = buildRows([
    ["Upah Pokok", data.upah_pokok],
    ["Uang Lembur", data.uang_lembur],
    ["Tunjangan Makan", data.tunjangan_makan],
    ["Tunjangan Transport", data.tunjangan_transport],
    ["Tunjangan Lain", data.tunjangan_lain],
    ["Bonus", data.bonus],
  ]);

  const potonganRows = buildRows([
    ["Potongan Kasbon", data.potongan_kasbon],
    ["BPJS", data.potongan_bpjs],
    ["PPh 21", data.potongan_pph21],
    ["Potongan Lain", data.potongan_lain],
  ]);

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Slip Gaji — ${pegawaiName} — ${slipId}</title>
<style>${buildCSS()}</style>
</head>
<body>
<div class="slip">
  <div class="watermark">SLIP GAJI</div>

  <!-- Header -->
  <div class="header">
    <div class="company-block">
      <div class="company-logo">${opts.companyLogo}</div>
      <div>
        <div class="company-name">${opts.companyName}</div>
        <div class="company-sub">${opts.companyAddress}</div>
      </div>
    </div>
    <div class="slip-title-block">
      <div class="slip-title">Slip Gaji</div>
      <div class="slip-ref">No: SG-${slipId} &nbsp;|&nbsp; Cetak: ${tglCetak}</div>
    </div>
  </div>

  <!-- Info Grid -->
  <div class="info-grid">
    <div>
      <div class="info-label">Nama Pegawai</div>
      <div class="info-value">${pegawaiName}</div>
    </div>
    <div>
      <div class="info-label">Periode Gaji</div>
      <div class="info-value-sm">${periode}</div>
    </div>
    <div>
      <div class="info-label">Tipe Gaji</div>
      <div class="info-value">${tipe}${hariKerjaInfo ? ` <span style="font-weight:400;font-size:8px;color:#64748b">(${hariKerjaInfo})</span>` : ""}</div>
    </div>
    <div>
      <div class="info-label">ID Pegawai</div>
      <div class="info-value-sm">${data.pegawai_id.slice(0, 8)}...</div>
    </div>
    <div>
      <div class="info-label">Tanggal Bayar</div>
      <div class="info-value-sm">${tglBayar}</div>
    </div>
    <div>
      <div class="info-label">Metode Bayar</div>
      <div class="info-value">${metode}</div>
    </div>
  </div>

  <!-- Body: Pendapatan & Potongan -->
  <div class="body">
    <div class="section-card">
      <div class="section-header earn">
        <span>&#9650; Pendapatan</span>
        <span class="section-total">Rp ${idr(data.total_pendapatan)}</span>
      </div>
      <table>${pendapatanRows}</table>
    </div>
    <div class="section-card">
      <div class="section-header deduct">
        <span>&#9660; Potongan</span>
        <span class="section-total">Rp ${idr(data.total_potongan)}</span>
      </div>
      <table>${potonganRows}</table>
    </div>
  </div>

  <!-- Netto -->
  <div class="netto-bar">
    <div class="netto-label">
      Gaji Bersih (Take Home Pay)
      <span>Pendapatan Rp ${idr(data.total_pendapatan)} &minus; Potongan Rp ${idr(data.total_potongan)}</span>
    </div>
    <div class="netto-amount">Rp ${idr(data.gaji_bersih)}</div>
  </div>

  <!-- Footer -->
  <div class="footer-row">
    <div class="sig-block">
      <div class="sig-label">Diterima oleh</div>
      <div class="sig-line">
        <div class="sig-name">${pegawaiName}</div>
        <div class="sig-role">Pegawai</div>
      </div>
    </div>
    <div class="footer-note">
      <hr class="cut-line" />
      <div style="margin-top:1mm">Dokumen ini dicetak secara otomatis oleh sistem SBPApp v3 dan sah tanpa tanda tangan basah.</div>
      ${data.catatan ? `<div style="margin-top:0.5mm;font-style:italic">Catatan: ${data.catatan}</div>` : ""}
    </div>
    <div class="sig-block">
      <div class="sig-label">Disetujui oleh</div>
      <div class="sig-line">
        <div class="sig-name">________________</div>
        <div class="sig-role">HRD / Finance</div>
      </div>
    </div>
  </div>
</div>

<script>window.onload=function(){setTimeout(function(){window.print()},400)};<\/script>
</body>
</html>`;
}

/* ===========================
   Public API
   =========================== */

/**
 * Buka tab baru berisi slip gaji A5 landscape, langsung trigger print dialog.
 *
 * @param data      Row penggajian dari API / state
 * @param pegName   Nama pegawai (resolved dari cache)
 * @param options   Opsional: company branding overrides
 */
export function printSlipGaji(
  data: SlipGajiData,
  pegName: string,
  options?: SlipGajiOptions,
): void {
  const opts: Required<SlipGajiOptions> = {
    companyName: options?.companyName ?? "PT. SBP Epoxy Contractor",
    companyAddress:
      options?.companyAddress ??
      "Jl. Raya Industri No. 88 — Surabaya, Jawa Timur",
    companyLogo: options?.companyLogo ?? "SBP",
  };

  const w = window.open("", "_blank", "width=900,height=650");
  if (!w) {
    alert("Pop-up diblokir browser. Izinkan pop-up untuk mencetak slip gaji.");
    return;
  }

  const html = buildHTML(data, pegName, opts);
  w.document.write(html);
  w.document.close();
}
