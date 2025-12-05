"use client";

import { 
  LayoutDashboard, 
  FolderKanban, 
  Package, 
  Users, 
  LogOut, 
  X,
  Settings
} from "lucide-react";

interface Props {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export default function Sidebar({ open, setOpen }: Props) {
  const menu = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, active: true },
    { label: "Proyek", href: "/dashboard/projects", icon: FolderKanban },
    { label: "Material & Stok", href: "/dashboard/materials", icon: Package },
    { label: "Tim Lapangan", href: "/dashboard/team", icon: Users },
  ];

  return (
    <>
      {/* MOBILE BACKDROP */}
      <div
        className={`fixed inset-0 bg-black/40 z-30 md:hidden transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
      />

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 bg-slate-900 text-slate-200
        transform transition-transform duration-300 ease-in-out shadow-xl h-full
        ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* HEADER */}
        <div className="h-20 px-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center font-bold">
              S
            </div>
            <h2 className="font-bold text-lg">SBPApp v3</h2>
          </div>

          <button className="md:hidden" onClick={() => setOpen(false)}>
            <X size={22} />
          </button>
        </div>

        {/* MENU */}
        <nav className="p-6 space-y-2 overflow-y-auto h-[calc(100%-6rem)]">
          <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">
            Main Menu
          </p>

          {menu.map((m, i) => (
            <a
              key={i}
              href={m.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                m.active ? "bg-blue-600 text-white" : "hover:bg-slate-800 text-slate-400"
              }`}
            >
              <m.icon size={20} />
              {m.label}
            </a>
          ))}

          <p className="text-xs uppercase tracking-wider text-slate-500 mt-6 mb-3">
            Pengaturan
          </p>

          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-800"
          >
            <Settings size={20} />
            Preferences
          </a>

          <div className="pt-8 border-t border-slate-800 mt-6">
            <button className="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-900/20 rounded-lg w-full">
              <LogOut size={20} />
              Logout
            </button>
          </div>
        </nav>
      </aside>
    </>
  );
}
