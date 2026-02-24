/**
 * Print Slip Kasbon — A5 Landscape
 *
 * Pure utility function. Tidak butuh React.
 * Buka tab baru → render HTML slip → auto window.print()
 *
 * Usage:
 *   import { printSlipKasbon } from "@/lib/print/slip-kasbon";
 *   printSlipKasbon(kasbon, mutasiList, "Ahmad Fauzi");
 */

/* ===========================
   Types (minimal, decoupled)
   =========================== */

export interface SlipKasbonData {
    kasbon_id: string;
    pegawai_id: string;
    tanggal_pengajuan: string;
    nominal_pengajuan: number;
    nominal_disetujui?: number | null;
    alasan?: string | null;
    status_kasbon: string;
    disetujui_oleh?: string | null;
    tanggal_persetujuan?: string | null;
    tanggal_cair?: string | null;
    metode_pencairan?: string | null;
    metode_potong: string;
    saldo_kasbon: number;
    catatan?: string | null;
}

export interface SlipKasbonMutasi {
    mutasi_id: string;
    tipe_mutasi: string;
    nominal_mutasi: number;
    saldo_sebelum: number;
    saldo_sesudah: number;
    tanggal_mutasi: string;
    catatan?: string | null;
    penggajian_id?: string | null;
}

export interface SlipKasbonOptions {
    companyName?: string;
    companyAddress?: string;
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

function dateShort(d?: string | null): string {
    if (!d) return "-";
    const dt = new Date(`${d}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return d;
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(dt);
}

function todayLong(): string {
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date());
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function tipeMutasiLabel(t: string): string {
    switch (t) {
        case "potong_gaji":
            return "Potong Gaji";
        case "cicilan_manual":
            return "Cicilan Manual";
        case "penyesuaian":
            return "Penyesuaian";
        default:
            return t;
    }
}

function metodePotongLabel(m: string): string {
    switch (m) {
        case "potong_gaji":
            return "Potong Gaji";
        case "cicilan":
            return "Cicilan Manual";
        default:
            return m;
    }
}

/* ===========================
   CSS — Separated styling
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

  /* ── Decorative top bar (amber) ── */
  .slip::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 4mm;
    background: linear-gradient(135deg, #78350f 0%, #b45309 50%, #78350f 100%);
  }

  /* ── Watermark ── */
  .watermark {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-25deg);
    font-size: 48px;
    font-weight: 900;
    color: rgba(120, 53, 15, 0.03);
    letter-spacing: 12px;
    text-transform: uppercase;
    pointer-events: none;
    white-space: nowrap;
  }

  /* ── Header ── */
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
    background: linear-gradient(135deg, #78350f 0%, #b45309 100%);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 900; font-size: 14px;
    letter-spacing: -0.5px;
    flex-shrink: 0;
  }
  .company-name { font-size: 13px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px; }
  .company-sub { font-size: 8px; color: #64748b; margin-top: 1px; }

  .slip-title-block { text-align: right; }
  .slip-title {
    font-size: 14px; font-weight: 900; color: #78350f;
    letter-spacing: 1.5px; text-transform: uppercase;
  }
  .slip-ref { font-size: 8px; color: #64748b; margin-top: 1px; }

  /* ── Info Grid ── */
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 2mm;
    margin: 3mm 0;
    padding: 2.5mm 3mm;
    background: #fffbeb;
    border-radius: 2mm;
    border: 0.5px solid #fde68a;
  }
  .info-label {
    font-size: 7px; color: #92400e;
    text-transform: uppercase; letter-spacing: 0.7px; font-weight: 600;
  }
  .info-value { font-size: 9.5px; font-weight: 700; color: #0f172a; margin-top: 0.5mm; }
  .info-value-sm { font-size: 8.5px; font-weight: 600; color: #334155; margin-top: 0.5mm; }

  /* ── Summary cards ── */
  .summary-bar {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 3mm;
    margin: 2mm 0;
  }
  .summary-card {
    padding: 2.5mm 3mm;
    border-radius: 2mm;
    border: 0.5px solid #e2e8f0;
  }
  .summary-card.pinjaman { background: #fef3c7; border-color: #fde68a; }
  .summary-card.terbayar { background: #ecfdf5; border-color: #a7f3d0; }
  .summary-card.sisa { background: #0f172a; border-color: #0f172a; }
  .sc-label {
    font-size: 7px; text-transform: uppercase;
    letter-spacing: 0.6px; font-weight: 600;
  }
  .pinjaman .sc-label { color: #92400e; }
  .terbayar .sc-label { color: #065f46; }
  .sisa .sc-label { color: #94a3b8; }
  .sc-value { font-size: 13px; font-weight: 900; margin-top: 0.5mm; }
  .pinjaman .sc-value { color: #78350f; }
  .terbayar .sc-value { color: #047857; }
  .sisa .sc-value { color: #fff; }

  /* ── Status badge ── */
  .status-badge {
    display: inline-block;
    padding: 1mm 2.5mm;
    border-radius: 1.5mm;
    font-size: 8px; font-weight: 800;
    letter-spacing: 0.5px;
  }
  .status-badge.aktif { background: #fef3c7; color: #92400e; border: 0.5px solid #fde68a; }
  .status-badge.lunas { background: #ecfdf5; color: #065f46; border: 0.5px solid #a7f3d0; }

  /* ── Mutasi table ── */
  .mutasi-section { flex: 1; min-height: 0; overflow: hidden; }
  .mutasi-header {
    font-size: 8.5px; font-weight: 800; color: #334155;
    text-transform: uppercase; letter-spacing: 0.8px;
    margin-bottom: 1.5mm;
    display: flex; align-items: center; gap: 2mm;
  }
  .mutasi-count {
    font-weight: 600; color: #64748b;
    font-size: 7.5px; text-transform: none; letter-spacing: 0;
  }
  .mutasi-table { width: 100%; border-collapse: collapse; }
  .mutasi-table th {
    padding: 1.5mm 2.5mm;
    font-size: 7px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.5px;
    color: #64748b; background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    text-align: left;
  }
  .mutasi-table th.r { text-align: right; }
  .mutasi-table td {
    padding: 1.5mm 2.5mm;
    font-size: 8px;
    border-bottom: 0.5px solid #f1f5f9;
    vertical-align: top;
  }
  .mutasi-table td.r {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .mutasi-table tr:last-child td { border-bottom: none; }

  .td-paid { color: #b91c1c; font-weight: 700; }
  .td-after { font-weight: 700; color: #0f172a; }
  .td-lunas { color: #047857; font-weight: 800; font-size: 7px; }
  .td-tipe {
    display: inline-block;
    padding: 0.5mm 1.5mm;
    border-radius: 1mm;
    font-size: 7px; font-weight: 700;
  }
  .td-tipe.potong_gaji { background: #ecfdf5; color: #065f46; }
  .td-tipe.cicilan_manual { background: #fef3c7; color: #92400e; }
  .td-tipe.penyesuaian { background: #eff6ff; color: #1e40af; }
  .td-slip { font-size: 6.5px; color: #64748b; margin-top: 0.3mm; }
  .td-note { color: #64748b; max-width: 40mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty-mutasi { padding: 4mm; text-align: center; color: #94a3b8; font-style: italic; font-size: 8px; }

  /* ── Footer ── */
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
    data: SlipKasbonData,
    mutasiList: SlipKasbonMutasi[],
    pegawaiName: string,
    opts: Required<SlipKasbonOptions>,
): string {
    const kasbonRef = data.kasbon_id.slice(0, 13).toUpperCase();
    const totalPinjaman = data.nominal_disetujui ?? data.nominal_pengajuan;
    const totalTerbayar = totalPinjaman - data.saldo_kasbon;
    const sisaPinjaman = data.saldo_kasbon;
    const isLunas = data.status_kasbon === "lunas" || sisaPinjaman <= 0;

    const statusBadge = isLunas
        ? `<span class="status-badge lunas">LUNAS</span>`
        : `<span class="status-badge aktif">BERJALAN</span>`;

    // Build mutasi rows — chronological for print (oldest first)
    let mutasiRows = "";
    if (mutasiList.length === 0) {
        mutasiRows = `<tr><td colspan="7" class="empty-mutasi">Belum ada riwayat pembayaran.</td></tr>`;
    } else {
        // mutasiList comes newest-first from API, reverse for chronological print
        const sorted = mutasiList.slice().reverse();
        mutasiRows = sorted
            .map((m, idx) => {
                const tipeClass = m.tipe_mutasi.replace(/[^a-z_]/g, "");
                return `<tr>
          <td style="color:#94a3b8;font-size:7px">${idx + 1}</td>
          <td>${dateShort(m.tanggal_mutasi)}</td>
          <td>
            <span class="td-tipe ${tipeClass}">${tipeMutasiLabel(m.tipe_mutasi)}</span>
            ${m.penggajian_id ? `<div class="td-slip">Slip: ${m.penggajian_id.slice(0, 8)}…</div>` : ""}
          </td>
          <td class="r td-paid">&minus;Rp ${idr(m.nominal_mutasi)}</td>
          <td class="r" style="color:#64748b">Rp ${idr(m.saldo_sebelum)}</td>
          <td class="r td-after">Rp ${idr(m.saldo_sesudah)}${m.saldo_sesudah <= 0 ? ` <span class="td-lunas">LUNAS</span>` : ""}</td>
          <td class="td-note">${m.catatan || "-"}</td>
        </tr>`;
            })
            .join("\n");
    }

    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Kasbon — ${pegawaiName} — ${kasbonRef}</title>
<style>${buildCSS()}</style>
</head>
<body>
<div class="slip">
  <div class="watermark">KASBON</div>

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
      <div class="slip-title">Slip Kasbon</div>
      <div class="slip-ref">No: KB-${kasbonRef} &nbsp;|&nbsp; Cetak: ${todayLong()}</div>
    </div>
  </div>

  <!-- Info Grid -->
  <div class="info-grid">
    <div>
      <div class="info-label">Nama Pegawai</div>
      <div class="info-value">${pegawaiName}</div>
    </div>
    <div>
      <div class="info-label">Tanggal Pengajuan</div>
      <div class="info-value-sm">${dateLong(data.tanggal_pengajuan)}</div>
    </div>
    <div>
      <div class="info-label">Status</div>
      <div class="info-value">${statusBadge}</div>
    </div>
    <div>
      <div class="info-label">Tanggal Cair</div>
      <div class="info-value-sm">${dateLong(data.tanggal_cair)}</div>
    </div>
    <div>
      <div class="info-label">Metode Potong</div>
      <div class="info-value">${metodePotongLabel(data.metode_potong)}</div>
    </div>
    <div>
      <div class="info-label">Metode Pencairan</div>
      <div class="info-value-sm">${data.metode_pencairan ? capitalize(data.metode_pencairan) : "-"}</div>
    </div>
  </div>

  <!-- Summary Bar -->
  <div class="summary-bar">
    <div class="summary-card pinjaman">
      <div class="sc-label">Total Pinjaman</div>
      <div class="sc-value">Rp ${idr(totalPinjaman)}</div>
    </div>
    <div class="summary-card terbayar">
      <div class="sc-label">Total Terbayar (${mutasiList.length}&times;)</div>
      <div class="sc-value">Rp ${idr(totalTerbayar)}</div>
    </div>
    <div class="summary-card sisa">
      <div class="sc-label">Sisa Pinjaman</div>
      <div class="sc-value">${isLunas ? "Rp 0 — LUNAS" : `Rp ${idr(sisaPinjaman)}`}</div>
    </div>
  </div>

  <!-- Mutasi Table -->
  <div class="mutasi-section">
    <div class="mutasi-header">
      Riwayat Pembayaran
      <span class="mutasi-count">(${mutasiList.length} transaksi)</span>
    </div>
    <table class="mutasi-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Tanggal</th>
          <th>Sumber</th>
          <th class="r">Dibayar</th>
          <th class="r">Sebelum</th>
          <th class="r">Sesudah</th>
          <th>Catatan</th>
        </tr>
      </thead>
      <tbody>
        ${mutasiRows}
      </tbody>
    </table>
  </div>

  <!-- Footer -->
  <div class="footer-row">
    <div class="sig-block">
      <div class="sig-label">Peminjam</div>
      <div class="sig-line">
        <div class="sig-name">${pegawaiName}</div>
        <div class="sig-role">Pegawai</div>
      </div>
    </div>
    <div class="footer-note">
      <hr class="cut-line" />
      <div style="margin-top:1mm">Dokumen ini dicetak otomatis oleh sistem SBPApp v3 dan sah tanpa tanda tangan basah.</div>
      ${data.alasan ? `<div style="margin-top:0.5mm;font-style:italic">Alasan: ${data.alasan}</div>` : ""}
      ${data.catatan ? `<div style="margin-top:0.5mm;font-style:italic">Catatan: ${data.catatan}</div>` : ""}
    </div>
    <div class="sig-block">
      <div class="sig-label">Disetujui oleh</div>
      <div class="sig-line">
        <div class="sig-name">${data.disetujui_oleh || "________________"}</div>
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
 * Buka tab baru berisi slip kasbon A5 landscape, langsung trigger print dialog.
 *
 * @param data       Row kasbon dari API / state
 * @param mutasiList Riwayat mutasi pembayaran (bisa kosong)
 * @param pegName    Nama pegawai (resolved dari cache)
 * @param options    Opsional: company branding overrides
 */
export function printSlipKasbon(
    data: SlipKasbonData,
    mutasiList: SlipKasbonMutasi[],
    pegName: string,
    options?: SlipKasbonOptions,
): void {
    const opts: Required<SlipKasbonOptions> = {
        companyName: options?.companyName ?? "PT. SBP Epoxy Contractor",
        companyAddress:
            options?.companyAddress ?? "Jl. Raya Industri No. 88 — Surabaya, Jawa Timur",
        companyLogo: options?.companyLogo ?? "SBP",
    };

    const w = window.open("", "_blank", "width=900,height=650");
    if (!w) {
        alert("Pop-up diblokir browser. Izinkan pop-up untuk mencetak slip kasbon.");
        return;
    }

    const html = buildHTML(data, mutasiList, pegName, opts);
    w.document.write(html);
    w.document.close();
}