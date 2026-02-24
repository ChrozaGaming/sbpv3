#!/usr/bin/env python3
"""
Patcher: Fix semua AbortError di ketiga file page.tsx
Masalah: ac.abort() di useEffect cleanup meng-throw AbortError yang tidak di-handle.
"""
import sys, os

FIXES = [
    # =============================
    # FILE: kontrakkerja/page.tsx
    # =============================
    {
        "path": "kontrakkerja/page.tsx",
        "patches": [
            # Fix 1: PegawaiAsyncSelect - useEffect pegawai by ID → wrap try/catch
            (
                """(async () => {
            if (!value) return;
            if (cacheById.has(value)) return;
            const row = await apiGetPegawaiById(value, ac.signal);
            if (!active) return;
            if (row?.pegawai_id) upsertRef.current(row);
        })();""",
                """(async () => {
            try {
                if (!value) return;
                if (cacheById.has(value)) return;
                const row = await apiGetPegawaiById(value, ac.signal);
                if (!active) return;
                if (row?.pegawai_id) upsertRef.current(row);
            } catch (e: any) {
                if (e?.name === "AbortError" || !active) return;
            }
        })();"""
            ),
            # Fix 2: Main load data → add AbortError guard
            (
                """} catch (e: any) {
                if (!alive) return;
                setRowsError(e?.message ?? "Gagal memuat kontrak kerja");""",
                """} catch (e: any) {
                if (!alive || e?.name === "AbortError") return;
                setRowsError(e?.message ?? "Gagal memuat kontrak kerja");"""
            ),
        ]
    },
    # =============================
    # FILE: kasbon/page.tsx
    # =============================
    {
        "path": "kasbon/page.tsx",
        "patches": [
            # Fix 3: PegawaiAsyncSelect useEffect value (compressed)
            (
                "(async () => { if (!value || cacheById.has(value)) return; const r = await apiGetPegawaiById(value, ac.signal); if (!a) return; if (r?.pegawai_id) upsertRef.current(r); })()",
                "(async () => { try { if (!value || cacheById.has(value)) return; const r = await apiGetPegawaiById(value, ac.signal); if (!a) return; if (r?.pegawai_id) upsertRef.current(r); } catch (e: any) { if (e?.name === \"AbortError\" || !a) return; } })()"
            ),
            # Fix 4: Main load catch
            (
                'catch (e: any) { if (!alive) return; setRowsError(e?.message ?? "Gagal memuat kasbon"); }',
                'catch (e: any) { if (!alive || e?.name === "AbortError") return; setRowsError(e?.message ?? "Gagal memuat kasbon"); }'
            ),
        ]
    },
    # =============================
    # FILE: gajian/page.tsx
    # =============================
    {
        "path": "gajian/page.tsx",
        "patches": [
            # Fix 5: PegawaiKontrakSelect useEffect value (compressed)
            (
                "(async () => { if (!value || cacheById.has(value)) return; const r = await apiGetPegawaiById(value, ac.signal); if (!a) return; if (r?.pegawai_id) upsertRef.current(r); })()",
                "(async () => { try { if (!value || cacheById.has(value)) return; const r = await apiGetPegawaiById(value, ac.signal); if (!a) return; if (r?.pegawai_id) upsertRef.current(r); } catch (e: any) { if (e?.name === \"AbortError\" || !a) return; } })()"
            ),
            # Fix 6: Main load catch
            (
                'catch (e: any) { if (!alive) return; setRowsError(e?.message ?? "Gagal memuat"); }',
                'catch (e: any) { if (!alive || e?.name === "AbortError") return; setRowsError(e?.message ?? "Gagal memuat"); }'
            ),
        ]
    },
]

def apply_patches(base_dir):
    results = []
    for fix in FIXES:
        filepath = os.path.join(base_dir, fix["path"])
        if not os.path.isfile(filepath):
            results.append(f"⚠ SKIP {fix['path']} (file not found at {filepath})")
            continue

        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        applied = 0
        for old, new in fix["patches"]:
            if old in content:
                content = content.replace(old, new, 1)
                applied += 1
            else:
                results.append(f"  ⚠ Pattern not found in {fix['path']}:\n    {repr(old[:80])}...")

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)

        results.append(f"✅ {fix['path']}: {applied}/{len(fix['patches'])} patches applied")

    return results

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python apply_fixes.py <base_dir>")
        print("  base_dir = folder yang berisi kontrakkerja/ kasbon/ gajian/")
        print("  Contoh:  python apply_fixes.py src/app/dashboard/pegawai/")
        sys.exit(1)

    base = sys.argv[1]
    print(f"Applying AbortError fixes to: {base}\n")
    for line in apply_patches(base):
        print(line)
    print("\nDone!")
