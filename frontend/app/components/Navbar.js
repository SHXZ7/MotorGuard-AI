"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Settings, Shield } from "lucide-react";

const NAV_TABS = [
  { href: "/", label: "Dashboard" },
  { href: "/fault", label: "Fault Analysis" },
  { href: "/rul", label: "Remaining Life" },
  { href: "/power", label: "Power & Efficiency" },
  { href: "/ai", label: "AI Assistant" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Shield size={16} strokeWidth={2.25} />
          </span>
          <span>MotorGuard</span>
        </div>

        <div className="nav-tabs">
          {NAV_TABS.map(tab => {
            const active = pathname === tab.href;
            return (
              <Link key={tab.href} href={tab.href} className={`nav-tab${active ? " active" : ""}`}>
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
