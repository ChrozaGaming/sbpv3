"use client";

import React, { useState } from "react";

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

import { TambahStokForm } from "./TambahStokForm";

export default function TambahStokPage() {
    const [open, setOpen] = useState(true);

    return (
        <div className="flex h-[100dvh] w-full max-w-full overflow-hidden bg-slate-100 text-slate-800">
            {/* SIDEBAR */}
            <div className="shrink-0">
                <Sidebar open={open} setOpen={setOpen} />
            </div>

            {/* MAIN AREA */}
            <div className="flex min-w-0 flex-1 flex-col">
                <Header onToggle={() => setOpen(!open)} />

                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <main className="font-inter w-full max-w-6xl mx-auto p-4 sm:p-8">
                        <TambahStokForm />
                    </main>

                    <Footer />
                </div>
            </div>
        </div>
    );
}
