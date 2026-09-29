"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus, Settings, LogOut, Users, FileText, QrCode } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types/database";
import { BrandLogo } from "@/components/BrandLogo";

interface NavbarProps {
  userEmail: string;
  profile: Profile | null;
  onOpenProfile: () => void;
  onOpenNewClient?: () => void;
}

export function Navbar({ userEmail, profile, onOpenProfile }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = profile?.business_name
    ? profile.business_name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : "PF";

  const isProfileIncomplete = !profile?.upi_id || !profile?.business_name;

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-200/80 transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-15 py-3">
          {/* Brand Logo & Navigation */}
          <div className="flex items-center gap-7">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <BrandLogo size={32} />
              <div className="flex flex-col">
                <span className="font-bold text-zinc-950 tracking-tight text-base leading-none">
                  ProposalFlow
                </span>
                <span className="text-[10px] font-medium text-zinc-400 tracking-wider uppercase mt-1">
                  Invoicing for India
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-xs font-semibold">
              <Link
                href="/dashboard"
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  pathname === "/dashboard"
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>
              <Link
                href="/clients"
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  pathname === "/clients"
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Clients</span>
              </Link>
            </nav>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/proposals/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 active:scale-[0.98] shadow-sm transition duration-150"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New Proposal</span>
            </Link>

            {/* Profile Settings Trigger */}
            <button
              onClick={onOpenProfile}
              title={isProfileIncomplete ? "Configure UPI ID" : "Freelancer & Payment Settings"}
              className={`p-1.5 rounded-lg border transition relative flex items-center gap-1.5 text-xs font-medium ${
                isProfileIncomplete
                  ? "bg-amber-50/80 border-amber-200 text-amber-900 hover:bg-amber-100"
                  : "bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-600"
              }`}
            >
              <Settings className="w-4 h-4 text-zinc-600" />
              {isProfileIncomplete && (
                <span className="hidden sm:inline text-[11px] text-amber-800 font-semibold px-1">
                  Add UPI
                </span>
              )}
            </button>

            {/* User Profile Pill & Sign Out */}
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-zinc-200">
              <div className="w-7 h-7 rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-800 flex items-center justify-center text-[10px] font-bold">
                {initials}
              </div>
              <div className="text-left leading-none max-w-[120px]">
                <p className="text-xs font-semibold text-zinc-900 truncate">
                  {profile?.business_name || "Account"}
                </p>
              </div>

              <button
                onClick={handleSignOut}
                title="Sign Out"
                className="p-1 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition ml-0.5"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
