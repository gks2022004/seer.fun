"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import WalletButton from "./wallet-button";

const NAV_ITEMS = [
  { href: "/dashboard", label: "MARKETS", icon: "📊" },
  { href: "/dashboard/create", label: "CREATE", icon: "➕" },
  { href: "/dashboard/positions", label: "MY BETS", icon: "🎯" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col bg-void">
      {/* Header */}
      <header className="border-b border-matrix/30 bg-void/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl">🔮</span>
            <span className="font-vt323 text-xl text-matrix text-glow-green group-hover:text-white transition-colors">
              SEER.FUN
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`font-mono text-sm px-4 py-2 transition-all ${
                  pathname === item.href
                    ? "text-matrix bg-matrix/10 border border-matrix"
                    : "text-gray-400 hover:text-matrix hover:bg-matrix/5 border border-transparent"
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          <WalletButton />
        </div>
      </header>

      {/* Mobile Nav */}
      <nav className="md:hidden flex border-b border-matrix/30 overflow-x-auto">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 font-mono text-xs px-3 py-2 text-center transition-all whitespace-nowrap ${
              pathname === item.href
                ? "text-matrix bg-matrix/10 border-b-2 border-matrix"
                : "text-gray-400"
            }`}
          >
            <span className="mr-1">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-matrix/30 py-4">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between text-xs text-gray-500 font-mono">
          <span>SEER.FUN v0.1.0 // DEVNET</span>
          <span>POWERED BY ◎ SOLANA</span>
        </div>
      </footer>
    </div>
  );
}
