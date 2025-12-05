"use client";

import { Menu, Bell, Search, ChevronDown } from "lucide-react";

interface Props {
  onToggle: () => void;
}

export default function Header({ onToggle }: Props) {
  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 h-20 px-6 md:px-8 flex items-center justify-between transition-all">
      
      {/* LEFT: Mobile Toggle & Breadcrumb/Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggle}
          className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg md:hidden transition-colors"
        >
          <Menu size={24} />
        </button>

        <div className="hidden md:block">
          <h1 className="text-lg font-bold text-slate-800">Dashboard</h1>
          <p className="text-xs text-slate-500">Selamat datang kembali, Admin.</p>
        </div>
      </div>

      {/* RIGHT: Search, Notification, Profile */}
      <div className="flex items-center gap-4 md:gap-6">
        
        {/* Search Bar (Hidden on mobile small) */}
        <div className="hidden md:flex items-center bg-slate-100 px-3 py-2 rounded-full w-64 border border-transparent focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
          <Search size={18} className="text-slate-400" />
          <input 
            type="text" 
            placeholder="Cari proyek atau material..." 
            className="bg-transparent border-none outline-none text-sm ml-2 w-full text-slate-700 placeholder:text-slate-400"
          />
        </div>

        {/* Notification Icon */}
        <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </button>

        <div className="h-8 w-[1px] bg-slate-200 hidden md:block"></div>

        {/* User Profile */}
        <button className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all">
          <div className="text-right hidden md:block leading-tight">
            <p className="text-sm font-semibold text-slate-700">Rizky Admin</p>
            <p className="text-xs text-slate-500">Head Contractor</p>
          </div>
          <div className="relative">
            <img
              src="https://ui-avatars.com/api/?name=Rizky+Admin&background=0F172A&color=fff&bold=true"
              className="w-10 h-10 rounded-full shadow-sm border-2 border-white"
              alt="Admin Avatar"
            />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
          </div>
          <ChevronDown size={16} className="text-slate-400 hidden md:block mr-2" />
        </button>

      </div>
    </header>
  );
}