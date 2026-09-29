"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import { Invoice, Proposal, Profile } from "@/types/database";
import { formatINR, formatDate, buildUpiDeepLink, isInvoiceOverdue } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { BrandLogo } from "@/components/BrandLogo";
import {
  QrCode as QrIcon,
  Download,
  ExternalLink,
  ShieldCheck,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Smartphone,
  Share2,
  ArrowRight,
} from "lucide-react";
import dynamic from "next/dynamic";

// Dynamically import PDFDownloadLink with SSR disabled
const PDFDownloadButton = dynamic(
  () =>
    import("@react-pdf/renderer").then((mod) => {
      const { PDFDownloadLink } = mod;
      const { InvoicePDF } = require("@/components/InvoicePDF");

      return function PDFButton({
        invoice,
        proposal,
        profile,
        qrDataUrl,
      }: {
        invoice: Invoice;
        proposal: Proposal;
        profile: Profile;
        qrDataUrl: string;
      }) {
        return (
          <PDFDownloadLink
            document={
              <InvoicePDF
                invoice={invoice}
                proposal={proposal}
                profile={profile}
                qrDataUrl={qrDataUrl}
              />
            }
            fileName={`Invoice-${invoice.milestone_label.replace(/\s+/g, "_")}.pdf`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200 shadow-xs transition active:scale-[0.98]"
          >
            {/* @ts-ignore */}
            {({ loading }) => (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>{loading ? "Preparing PDF..." : "Download PDF"}</span>
              </>
            )}
          </PDFDownloadLink>
        );
      };
    }),
  { ssr: false }
);

export default function PublicInvoicePage() {
  const params = useParams();
  const invoiceId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [upiLink, setUpiLink] = useState<string>("");
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function loadInvoice() {
      setIsLoading(true);
      try {
        const { data: inv, error: invErr } = await supabase
          .from("invoices")
          .select("*, proposal:proposals(*, client:clients(*))")
          .eq("id", invoiceId)
          .single();

        if (invErr || !inv) {
          setErrorMessage("Invoice not found or link has expired.");
          return;
        }

        setInvoice(inv as unknown as Invoice);
        const prop = inv.proposal as unknown as Proposal;
        setProposal(prop);

        if (prop?.user_id) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", prop.user_id)
            .single();

          if (prof) {
            setProfile(prof as Profile);

            const deepLink = buildUpiDeepLink({
              upiId: prof.upi_id || "freelancer@upi",
              businessName: prof.business_name || "Freelancer",
              amount: inv.amount,
              milestoneLabel: inv.milestone_label || "Milestone Payment",
            });

            setUpiLink(deepLink);

            const qrCodeData = await QRCode.toDataURL(deepLink, {
              width: 320,
              margin: 2,
              color: {
                dark: "#09090b",
                light: "#ffffff",
              },
            });
            setQrDataUrl(qrCodeData);
          }
        }
      } catch (err: any) {
        console.error("Error loading invoice:", err);
        setErrorMessage("Failed to load invoice details.");
      } finally {
        setIsLoading(false);
      }
    }

    if (invoiceId) {
      loadInvoice();
    }
  }, [invoiceId, supabase]);

  function copyUpiId() {
    if (!profile?.upi_id) return;
    navigator.clipboard.writeText(profile.upi_id);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  }

  function copyInvoiceLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-zinc-400">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (errorMessage || !invoice || !proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa] px-4">
        <div className="max-w-md w-full bg-white p-7 rounded-2xl border border-zinc-200 shadow-sm text-center">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-zinc-900 mb-1">Invoice Unavailable</h2>
          <p className="text-xs text-zinc-500 mb-5">{errorMessage || "Invalid invoice link."}</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 transition"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isPaid = invoice.status === "paid";
  const isOverdue = isInvoiceOverdue(invoice.due_date, invoice.status);
  const displayStatus = isPaid ? "paid" : isOverdue ? "overdue" : "unpaid";
  const businessName = profile?.business_name || "Freelancer";

  return (
    <div className="min-h-screen bg-[#fafafa] pb-20 text-zinc-900 selection:bg-zinc-950 selection:text-white">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-zinc-200/80 py-3 px-4 sm:px-8 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {profile?.logo_url ? (
              <img
                src={profile.logo_url}
                alt={businessName}
                className="w-7 h-7 rounded-lg object-cover border border-zinc-200 shadow-xs"
              />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-zinc-950 text-white flex items-center justify-center font-bold text-[10px] shadow-xs">
                {businessName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-bold text-zinc-950 tracking-tight text-xs leading-none">
                {businessName}
              </span>
              <span className="text-[10px] text-zinc-400 mt-0.5">Invoice</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyInvoiceLink}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition border border-zinc-200 text-xs font-medium flex items-center gap-1"
              title="Copy invoice link"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copiedLink ? "Copied" : "Share"}</span>
            </button>

            {profile && (
              <PDFDownloadButton
                invoice={invoice}
                proposal={proposal}
                profile={profile}
                qrDataUrl={qrDataUrl}
              />
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-7 space-y-5">
        {/* Paid Confirmation */}
        {isPaid && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                Payment Confirmed
              </h4>
              <p className="text-xs text-emerald-700 mt-0.5">
                This invoice was settled on {formatDate(invoice.paid_at || invoice.created_at)}.
              </p>
            </div>
          </div>
        )}

        {/* Invoice Card */}
        <div className="bg-white rounded-2xl shadow-xs border border-zinc-200/80 overflow-hidden">
          {/* Card Header with Freelancer Logo on Mobile & Desktop */}
          <div className="p-6 sm:p-8 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-start justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status={displayStatus} type="invoice" />
                <span className="text-[11px] text-zinc-400">
                  Due: {formatDate(invoice.due_date)}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
                {invoice.milestone_label}
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                Project: <span className="font-medium text-zinc-700">{proposal.title}</span>
              </p>
            </div>

            {/* Freelancer Brand Box (Prominent on Mobile) */}
            <div className="flex items-center sm:items-start gap-3 border-t sm:border-t-0 pt-4 sm:pt-0 border-zinc-100 sm:flex-col sm:items-end">
              {profile?.logo_url ? (
                <img
                  src={profile.logo_url}
                  alt={businessName}
                  className="w-12 h-12 rounded-xl object-cover border border-zinc-200 shadow-xs shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-zinc-950 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                  {businessName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="sm:text-right">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Payable To
                </span>
                <p className="text-base font-bold text-zinc-900 mt-0.5 leading-tight">{businessName}</p>
                {profile?.phone && (
                  <p className="text-xs text-zinc-500 font-mono mt-0.5">{profile.phone}</p>
                )}
                {profile?.upi_id && (
                  <div className="inline-flex items-center gap-1.5 mt-1 font-mono text-xs text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-md">
                    <span>{profile.upi_id}</span>
                    <button onClick={copyUpiId} title="Copy UPI VPA">
                      {copiedUpi ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3 text-zinc-400" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Amount Due Display */}
          <div className="p-6 sm:p-8 bg-zinc-50/50 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Amount Due
              </span>
              <p className="text-3xl sm:text-4xl font-black text-zinc-950 font-mono tabular-nums tracking-tight mt-0.5">
                {formatINR(invoice.amount)}
              </p>
            </div>

            {/* Mobile Pay with UPI button */}
            {upiLink && !isPaid && (
              <a
                href={upiLink}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-xs transition sm:hidden"
              >
                <Smartphone className="w-4 h-4" />
                <span>Pay via UPI App</span>
              </a>
            )}
          </div>

          {/* UPI QR Payment Section */}
          {!isPaid && (
            <div className="p-6 sm:p-8 flex flex-col md:flex-row items-center gap-8 justify-between">
              <div className="flex-1 space-y-2.5 text-center md:text-left">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Payment QR Code
                </span>
                <h3 className="text-base font-bold text-zinc-900">
                  Scan to Pay with Any UPI App
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed max-w-sm">
                  Open Google Pay, PhonePe, Paytm, or BHIM and scan this code to transfer {formatINR(invoice.amount)} directly to {businessName}.
                </p>

                <div className="pt-2 flex flex-wrap gap-1.5 justify-center md:justify-start text-[11px] text-zinc-500">
                  <span className="px-2 py-0.5 rounded-md bg-zinc-100 font-medium">Google Pay</span>
                  <span className="px-2 py-0.5 rounded-md bg-zinc-100 font-medium">PhonePe</span>
                  <span className="px-2 py-0.5 rounded-md bg-zinc-100 font-medium">Paytm</span>
                  <span className="px-2 py-0.5 rounded-md bg-zinc-100 font-medium">BHIM</span>
                </div>
              </div>

              {/* QR Graphic Box */}
              <div className="bg-zinc-50 p-3.5 rounded-2xl border border-zinc-200/80 flex flex-col items-center gap-1.5">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="UPI Payment QR Code"
                    className="w-52 h-52 rounded-xl bg-white p-1.5 border border-zinc-200"
                  />
                ) : (
                  <div className="w-52 h-52 rounded-xl bg-zinc-200 animate-pulse" />
                )}
                <span className="text-[10px] font-medium text-zinc-400 tracking-wider uppercase">
                  Direct UPI VPA
                </span>
              </div>
            </div>
          )}

          {/* Proposal Link */}
          <div className="px-6 sm:px-8 py-3.5 bg-zinc-50/50 border-t border-zinc-100 flex items-center justify-between text-xs">
            <span className="text-zinc-500">Related Proposal</span>
            <Link
              href={`/p/${proposal.id}`}
              className="font-semibold text-zinc-900 hover:underline flex items-center gap-1 transition"
            >
              <span>View Full Proposal</span>
              <ExternalLink className="w-3 h-3 text-zinc-400" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
