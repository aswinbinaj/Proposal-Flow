"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types/database";
import {
  X,
  Building2,
  QrCode,
  Phone,
  Check,
  AlertCircle,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  initialProfile?: Profile | null;
  onProfileUpdated?: (updated: Profile) => void;
}

const COMMON_UPI_HANDLES = ["@okaxis", "@okhdfcbank", "@oksbi", "@paytm", "@ybl", "@ibl"];

export function ProfileModal({
  isOpen,
  onClose,
  userId,
  initialProfile,
  onProfileUpdated,
}: ProfileModalProps) {
  const [businessName, setBusinessName] = useState(initialProfile?.business_name || "");
  const [upiId, setUpiId] = useState(initialProfile?.upi_id || "");
  const [phone, setPhone] = useState(initialProfile?.phone || "");
  const [logoUrl, setLogoUrl] = useState(initialProfile?.logo_url || "");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (initialProfile) {
      setBusinessName(initialProfile.business_name || "");
      setUpiId(initialProfile.upi_id || "");
      setPhone(initialProfile.phone || "");
      setLogoUrl(initialProfile.logo_url || "");
    }
  }, [initialProfile]);

  if (!isOpen) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim() || !upiId.trim()) {
      setMessage({ type: "error", text: "Business Name and UPI ID are required." });
      return;
    }

    if (!upiId.includes("@")) {
      setMessage({
        type: "error",
        text: "Please enter a valid UPI VPA handle containing '@' (e.g. 9876543210@paytm or studio@okaxis).",
      });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const payload: Partial<Profile> = {
        id: userId,
        business_name: businessName.trim(),
        upi_id: upiId.trim(),
        phone: phone.trim(),
        logo_url: logoUrl.trim() || undefined,
        updated_at: new Date().toISOString(),
      };

      // 1. Try upserting to profiles table
      let savedData: Profile | null = null;
      try {
        const { data, error } = await supabase
          .from("profiles")
          .upsert(payload)
          .select()
          .single();

        if (error) {
          // If logo_url column doesn't exist yet, retry without logo_url on table
          if (error.message.includes("logo_url")) {
            const { logo_url, ...safePayload } = payload;
            const { data: fallbackData } = await supabase
              .from("profiles")
              .upsert(safePayload)
              .select()
              .single();
            savedData = { ...(fallbackData as Profile), logo_url: logoUrl.trim() };
          } else {
            throw error;
          }
        } else {
          savedData = data as Profile;
        }
      } catch (err: any) {
        throw err;
      }

      // 2. Also save to user_metadata for backup synchronization
      await supabase.auth.updateUser({
        data: {
          business_name: businessName.trim(),
          upi_id: upiId.trim(),
          logo_url: logoUrl.trim(),
        },
      });

      setMessage({ type: "success", text: "Profile & branding updated successfully!" });
      if (onProfileUpdated && savedData) {
        onProfileUpdated(savedData);
      }
      setTimeout(() => {
        onClose();
        setMessage(null);
      }, 900);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to save profile." });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-zinc-200/80 overflow-hidden transform transition-all">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h3 className="text-base font-bold text-zinc-950">Freelancer Branding & UPI Settings</h3>
            <p className="text-xs text-zinc-500">
              Customize your logo, studio name, and UPI payment details for invoices
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {message && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                message.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border border-rose-200 text-rose-800"
              }`}
            >
              {message.type === "success" ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-medium">{message.text}</span>
            </div>
          )}

          {/* Logo / Brand Icon Field */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
              Freelancer / Studio Logo URL (Displays on Invoices & Mobile)
            </label>
            <div className="flex items-center gap-3">
              {/* Live Preview Avatar */}
              <div className="w-12 h-12 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo Preview"
                    className="w-full h-full object-cover"
                    onError={() => {}}
                  />
                ) : (
                  <span className="text-xs font-bold text-zinc-500">
                    {businessName ? businessName.slice(0, 2).toUpperCase() : "PF"}
                  </span>
                )}
              </div>

              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://yourdomain.com/logo.png"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50/50 border border-zinc-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition"
                />
              </div>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">
              Paste a public image link to your logo. If left blank, a clean typographic monogram badge is used automatically.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Freelancer / Business Name *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                <Building2 className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Studio Pixel Craft or Priya Sharma"
                className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50/50 border border-zinc-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              UPI VPA ID for Receiving Direct Payments *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                <QrCode className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. 9876543210@paytm or yourhandle@okaxis"
                className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-zinc-50/50 border border-zinc-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition"
              />
            </div>
            {/* Quick Suffix Suggestions */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className="text-[10px] text-zinc-400">Common handles:</span>
              {COMMON_UPI_HANDLES.map((suffix) => (
                <button
                  key={suffix}
                  type="button"
                  onClick={() => {
                    const prefix = upiId.includes("@") ? upiId.split("@")[0] : upiId;
                    if (prefix) setUpiId(`${prefix}${suffix}`);
                  }}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition"
                >
                  {suffix}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Phone / WhatsApp (Optional)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50/50 border border-zinc-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition font-mono"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 active:scale-[0.98] rounded-lg shadow-xs transition disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
