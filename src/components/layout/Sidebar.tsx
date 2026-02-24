"use client";

import { useState, useCallback } from "react";
import {
  LayoutDashboard,
  Package,
  Boxes,
  Users,
  LogOut,
  X,
  Settings,
  ChevronDown,
  ChevronRight,
  PlusCircle,
  ArrowDownCircle,
  FileText,
  Truck,
  CalendarCheck,
  Briefcase,
  Receipt,
  Banknote,
  ClipboardList,
  Wallet,
  FilePlus2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface Props {
  open: boolean;
  setOpen: (v: boolean) => void;
}

type NavLink = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** If true, use exact pathname match only (no startsWith) */
  exact?: boolean;
};

type AccordionDef = {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  activeAccent: string;
  activeBg: string;
  activeIconBg: string;
  links: NavLink[];
};

/* ═══════════════════════════════════════════════════════════════
   Smooth accordion — CSS grid trick
   ═══════════════════════════════════════════════════════════════ */

function AccordionPanel({
  isOpen,
  children,
}: {
  isOpen: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid transition-[grid-template-rows] duration-200 ease-out"
      style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sidebar
   ═══════════════════════════════════════════════════════════════ */

export default function Sidebar({ open, setOpen }: Props) {
  const pathname = usePathname();

  /* ── Top-level nav ────────────────────────────────────────── */
  const menuTop: NavLink[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  ];

  /* ── Accordion definitions ────────────────────────────────── */
  const accordions: AccordionDef[] = [
    {
      key: "stok",
      label: "Stok Gudang",
      hint: "Stok, produk & pergerakan",
      icon: Package,
      activeAccent: "border-indigo-500/70",
      activeBg: "bg-slate-900 text-indigo-100",
      activeIconBg: "bg-indigo-600/90 text-slate-50",
      links: [
        { label: "Stok Gudang", href: "/dashboard/stokgudang", icon: Boxes },
        { label: "Tambah Produk", href: "/dashboard/stokgudang/tambahproduk", icon: PlusCircle },
        { label: "Tambah Stok", href: "/dashboard/stokgudang/tambahstok", icon: ArrowDownCircle },
      ],
    },
    {
      key: "surat",
      label: "Surat Jalan",
      hint: "Daftar & pembuatan surat jalan",
      icon: FileText,
      activeAccent: "border-sky-500/70",
      activeBg: "bg-slate-900 text-sky-100",
      activeIconBg: "bg-sky-600/90 text-slate-50",
      links: [
        { label: "Surat Jalan", href: "/dashboard/suratjalan", icon: FileText },
        { label: "Buat Surat Jalan", href: "/dashboard/suratjalan/formsuratjalan", icon: Truck },
      ],
    },
    {
      key: "keuangan",
      label: "Keuangan",
      hint: "Invoice & tagihan",
      icon: Wallet,
      activeAccent: "border-amber-500/70",
      activeBg: "bg-slate-900 text-amber-100",
      activeIconBg: "bg-amber-600/90 text-slate-50",
      links: [
        { label: "Invoice", href: "/dashboard/keuangan/invoice", icon: Receipt },
      ],
    },
    {
      key: "pegawai",
      label: "Pegawai",
      hint: "Data, kontrak, kasbon & gajian",
      icon: Users,
      activeAccent: "border-emerald-500/70",
      activeBg: "bg-slate-900 text-emerald-100",
      activeIconBg: "bg-emerald-600/90 text-slate-50",
      links: [
        { label: "Data Pegawai", href: "/dashboard/pegawai", icon: ClipboardList, exact: true },
        { label: "Kontrak Kerja", href: "/dashboard/pegawai/kontrakkerja", icon: Briefcase },
        { label: "Kasbon", href: "/dashboard/pegawai/kasbon", icon: Receipt },
        { label: "Gajian", href: "/dashboard/pegawai/gajian", icon: Banknote },
      ],
    },
  ];

  /* ── Bottom / operasional ─────────────────────────────────── */
  const menuBottom: NavLink[] = [
    { label: "Absensi", href: "/dashboard/absensi", icon: CalendarCheck },
  ];

  /* ── Accordion open state ─────────────────────────────────── */
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    accordions.forEach((a) => (init[a.key] = true));
    return init;
  });

  const togglePanel = useCallback((key: string) => {
    setOpenPanels((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  /* ── Active detection helpers ─────────────────────────────── */

  function isLinkActive(link: NavLink): boolean {
    if (link.exact) return pathname === link.href;
    return pathname === link.href || pathname.startsWith(link.href + "/");
  }

  function isAccordionActive(acc: AccordionDef): boolean {
    return acc.links.some((l) => isLinkActive(l));
  }

  /* ── Renderers ────────────────────────────────────────────── */

  const renderMainItem = (item: NavLink) => {
    const isActive = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors
        ${isActive
            ? "bg-slate-800/90 text-slate-50 shadow-sm"
            : "text-slate-300 hover:bg-slate-800/60 hover:text-slate-50"
          }`}
      >
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-md bg-slate-900/80 text-slate-200 transition-colors
          ${isActive
              ? "bg-indigo-600/90 text-white shadow-[0_0_0_1px_rgba(129,140,248,0.6)]"
              : "group-hover:bg-slate-800/90"
            }`}
        >
          <item.icon size={18} />
        </span>
        <span className="flex-1 truncate">{item.label}</span>
        {isActive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
      </Link>
    );
  };

  const renderSubLink = (item: NavLink) => {
    const isActive = isLinkActive(item);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        className={`group flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors
        ${isActive
            ? "bg-slate-900 text-indigo-100 shadow-sm"
            : "text-slate-300 hover:bg-slate-900/70 hover:text-slate-50"
          }`}
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-md text-slate-200
          ${isActive
              ? "bg-indigo-600/90 text-slate-50"
              : "bg-slate-800/90 group-hover:bg-slate-700"
            }`}
        >
          <Icon size={14} />
        </span>
        <span className="flex-1 truncate">{item.label}</span>
        {isActive && <ChevronRight size={14} className="text-indigo-300" />}
      </Link>
    );
  };

  const renderAccordion = (acc: AccordionDef) => {
    const panelOpen = openPanels[acc.key] ?? false;
    const active = isAccordionActive(acc);
    const Icon = acc.icon;

    return (
      <div key={acc.key} className="space-y-1.5">
        <button
          type="button"
          onClick={() => togglePanel(acc.key)}
          aria-expanded={panelOpen}
          className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm border transition-colors
          ${active
              ? `${acc.activeAccent} ${acc.activeBg}`
              : "border-slate-800 bg-slate-950/80 text-slate-200 hover:bg-slate-900"
            }`}
        >
          <span className="flex items-center gap-3">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-md
              ${active ? acc.activeIconBg : "bg-slate-800/90 text-slate-200"}`}
            >
              <Icon size={18} />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-medium">{acc.label}</span>
              <span className="text-[11px] text-slate-400">{acc.hint}</span>
            </span>
          </span>
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform duration-200 ${panelOpen ? "rotate-180" : ""
              }`}
          />
        </button>

        <AccordionPanel isOpen={panelOpen}>
          <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/90 px-3 py-2">
            {acc.links.map(renderSubLink)}
          </div>
        </AccordionPanel>
      </div>
    );
  };

  /* ── JSX ──────────────────────────────────────────────────── */

  return (
    <>
      {/* MOBILE BACKDROP */}
      <div
        className={`fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity md:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        onClick={() => setOpen(false)}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 h-full w-72 border-r border-slate-800/70
        bg-[#020617] bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.24)_0,_#020617_55%)]
        text-slate-100 shadow-2xl shadow-black/70
        transform transition-transform duration-300 ease-in-out md:static
        ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* HEADER */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/90 ring-1 ring-slate-600 text-sm font-semibold tracking-tight">
              SB
            </div>
            <div className="flex flex-col">
              <h2 className="text-sm font-semibold tracking-tight">SBPApp v3</h2>
              <p className="text-[11px] text-slate-400">Site &amp; Inventory Panel</p>
            </div>
          </div>

          <button
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-50 md:hidden"
            onClick={() => setOpen(false)}
            aria-label="Tutup sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* SCROLLABLE NAV */}
        <nav className="flex h-[calc(100%-4rem)] flex-col gap-5 overflow-y-auto overscroll-contain px-4 py-4">
          {/* MAIN MENU */}
          <div>
            <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Main Menu
            </p>
            <div className="space-y-1.5">{menuTop.map(renderMainItem)}</div>
          </div>

          {/* ACCORDION SECTIONS */}
          {accordions.map(renderAccordion)}

          {/* OPERASIONAL */}
          <div>
            <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Operasional
            </p>
            <div className="space-y-1.5">{menuBottom.map(renderMainItem)}</div>
          </div>

          {/* FOOTER */}
          <div className="mt-auto border-t border-slate-800/80 pt-4">
            <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Pengaturan
            </p>

            <Link
              href="#"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-slate-900 hover:text-slate-50"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 border border-slate-700 text-slate-100">
                <Settings size={18} />
              </span>
              <span className="flex-1">Preferences</span>
            </Link>

            <button
              type="button"
              className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-rose-400 transition-colors hover:bg-rose-950/40 hover:text-rose-200"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-950/40 border border-rose-700/70 text-rose-200">
                <LogOut size={18} />
              </span>
              <span className="flex-1">Logout</span>
            </button>
          </div>
        </nav>
      </aside>
    </>
  );
}