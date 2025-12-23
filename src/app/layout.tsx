import "./globals.css";

export const metadata = {
    title: "SBPApp v3",
    description: "Frontend Next.js for Rust Actix Web Backend",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="id">
        <body className="min-h-screen flex items-center justify-center">
        {children}
        </body>
        </html>
    );
}