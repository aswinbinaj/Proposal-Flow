"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Proposal, Profile, Client, LineItem, Milestone } from "@/types/database";
import { formatINR, formatDate } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Share2,
  Check,
  Receipt,
  AlertCircle,
  ExternalLink,
  FileCheck2,
} from "lucide-react";

export default function PublicProposalPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const proposalId = params.id as string;
  const isNewlyCreated = searchParams.get("created") === "true";

  const [isLoading, setIsLoading] = useState(true);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptanceResult, setAcceptanceResult] = useState<{
    success: boolean;
    invoice_ids?: string[];
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function loadProposal() {
      setIsLoading(true);
      try {
        const { data: prop, error: propErr } = await supabase
          .from("proposals")
          .select("*, client:clients(*)")
          .eq("id", proposalId)
          .single();

        if (propErr || !prop) {
          setErrorMsg("This proposal link is invalid or no longer available.");
          return;
        }

        setProposal(prop as unknown as Proposal);

        if (prop.user_id) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", prop.user_id)
            .single();

          if (prof) setProfile(prof as Profile);
        }

        if (prop.status === "approved") {
          const { data: invs } = await supabase
            .from("invoices")
            .select("id")
            .eq("proposal_id", proposalId);

          if (invs && invs.length > 0) {
            setAcceptanceResult({
              success: true,
              invoice_ids: invs.map((i) => i.id),
            });
          }
        }
      } catch (err) {
        console.error("Error loading proposal:", err);
        setErrorMsg("Failed to load proposal details.");
      } finally {
        setIsLoading(false);
      }
    }

    if (proposalId) {
      loadProposal();
    }
  }, [proposalId, supabase]);

  async function handleAcceptProposal() {
    setIsAccepting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/proposals/${proposalId}/accept`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to accept proposal.");
      }

      setAcceptanceResult(data);
      setProposal((prev) =>
        prev
          ? {
              ...prev,
              status: "approved",
              approved_at: new Date().toISOString(),
            }
          : prev
      );
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while accepting proposal.");
    } finally {
      setIsAccepting(false);
    }
  }

  function handleCopyShareLink() {
    navigator.clipboard.writeText(window.location.href.split("?")[0]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-zinc-400">Loading proposal...</p>
        </div>
      </div>
    );
  }

  if (errorMsg && !proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa] px-4">
        <div className="max-w-md w-full bg-white p-7 rounded-2xl border border-zinc-200 shadow-sm text-center">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-zinc-900 mb-1">Proposal Unavailable</h2>
          <p className="text-xs text-zinc-500 mb-5">{errorMsg}</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 transition"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!proposal) return null;

  const isApproved = proposal.status === "approved";
  const businessName = profile?.business_name || "Freelancer";
  const firstInvoiceId = acceptanceResult?.invoice_ids?.[0];

  return (
    <div className="min-h-screen bg-[#fafafa] pb-20 text-zinc-900 selection:bg-zinc-950 selection:text-white">
      {/* Top Banner (If newly created) */}
      {isNewlyCreated && (
        <div className="bg-zinc-950 text-white px-4 py-2 text-center text-xs font-medium flex items-center justify-center gap-3">
          <span>Proposal published. Share this link with your client:</span>
          <button
            onClick={handleCopyShareLink}
            className="px-2.5 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-[11px] transition flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Share2 className="w-3 h-3" />}
            <span>{copied ? "Copied" : "Copy Link"}</span>
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-7 sm:pt-10 space-y-6">
        {/* Document Card */}
        <div className="bg-white rounded-2xl shadow-xs border border-zinc-200/80 overflow-hidden">
          {/* Document Header */}
          <div className="p-6 sm:p-8 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Proposal Document
                </span>
                <span className="w-1 h-1 rounded-full bg-zinc-300" />
                <span className="text-[11px] text-zinc-500">
                  {formatDate(proposal.created_at)}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-zinc-950 tracking-tight">
                {proposal.title}
              </h1>
            </div>

            {/* Provider info with Logo */}
            <div className="flex items-center sm:items-start gap-3 border-t sm:border-t-0 pt-4 sm:pt-0 border-zinc-100 sm:flex-col sm:items-end">
              {profile?.logo_url ? (
                <img
                  src={profile.logo_url}
                  alt={businessName}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover border border-zinc-200 shadow-xs shrink-0"
                />
              ) : (
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-zinc-950 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                  {businessName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="sm:text-right">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Prepared by
                </span>
                <p className="text-base font-bold text-zinc-900 mt-0.5 leading-tight">
                  {businessName}
                </p>
                {profile?.phone && (
                  <p className="text-xs text-zinc-500 font-mono mt-0.5">{profile.phone}</p>
                )}
              </div>
            </div>
          </div>

          {/* Client Recipient Info */}
          {proposal.client && (
            <div className="px-6 sm:px-8 py-3.5 bg-zinc-50/60 border-b border-zinc-100 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Client
                </span>
                <p className="font-semibold text-zinc-900 mt-0.5">{proposal.client.name}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Phone
                </span>
                <p className="font-medium text-zinc-600 font-mono mt-0.5">{proposal.client.phone}</p>
              </div>
            </div>
          )}

          {/* Scope Table */}
          <div className="p-6 sm:p-8 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Scope of Deliverables
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    <th className="pb-2.5 font-medium">Item Description</th>
                    <th className="pb-2.5 font-medium text-center w-16">Qty</th>
                    <th className="pb-2.5 font-medium text-right w-24">Rate (₹)</th>
                    <th className="pb-2.5 font-medium text-right w-28">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                  {(proposal.line_items || []).map((item: LineItem, idx: number) => {
                    const subtotal = (Number(item.quantity) || 1) * (Number(item.rate) || 0);
                    return (
                      <tr key={idx}>
                        <td className="py-3 pr-4 font-medium text-zinc-900">
                          {item.description}
                        </td>
                        <td className="py-3 text-center text-zinc-500 font-mono">
                          {item.quantity}
                        </td>
                        <td className="py-3 text-right text-zinc-500 font-mono">
                          {formatINR(item.rate)}
                        </td>
                        <td className="py-3 text-right font-semibold text-zinc-900 font-mono tabular-nums">
                          {formatINR(subtotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Value */}
            <div className="pt-4 border-t border-zinc-200 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Total Proposal Value
              </span>
              <span className="text-2xl font-bold text-zinc-950 font-mono tabular-nums">
                {formatINR(proposal.total_amount)}
              </span>
            </div>
          </div>

          {/* Milestones Schedule */}
          {proposal.milestones && proposal.milestones.length > 0 && (
            <div className="p-6 sm:p-8 bg-zinc-50/60 border-t border-zinc-100 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Invoicing Milestones
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {proposal.milestones.map((m: Milestone, mIdx: number) => (
                  <div
                    key={mIdx}
                    className="p-3.5 rounded-xl bg-white border border-zinc-200 shadow-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                        Milestone {mIdx + 1}
                      </span>
                      <p className="text-xs font-semibold text-zinc-900 mt-0.5">{m.label}</p>
                    </div>
                    <span className="text-sm font-bold text-zinc-950 font-mono tabular-nums">
                      {formatINR(m.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Approval Card */}
        {isApproved ? (
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-emerald-200 shadow-xs text-center space-y-3">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto border border-emerald-100">
              <Check className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                Proposal Approved & Confirmed
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Accepted on {formatDate(proposal.approved_at || new Date().toISOString())}.
              </p>
            </div>

            {firstInvoiceId && (
              <div className="pt-2">
                <Link
                  href={`/i/${firstInvoiceId}`}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold shadow-xs transition"
                >
                  <Receipt className="w-4 h-4" />
                  <span>View Invoice & Pay via UPI QR</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        ) : (
          /* One-Tap Signoff Button Card */
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-zinc-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-100 text-zinc-700 flex items-center justify-center shrink-0">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-900">One-Tap Client Approval</h4>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Tap to sign off on this proposal. This automatically generates your milestone invoice with a UPI QR code.
                </p>
              </div>
            </div>

            <button
              onClick={handleAcceptProposal}
              disabled={isAccepting}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 active:scale-[0.98] transition disabled:opacity-50 shrink-0"
            >
              {isAccepting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Accept Proposal</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
