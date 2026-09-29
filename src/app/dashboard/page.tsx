"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Proposal, Profile, Client, Invoice } from "@/types/database";
import { Navbar } from "@/components/Navbar";
import { ProfileModal } from "@/components/ProfileModal";
import { StatusBadge } from "@/components/StatusBadge";
import { formatINR, formatDate, isInvoiceOverdue, normalizePhoneForWhatsApp } from "@/lib/utils";
import {
  FileText,
  Plus,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  AlertCircle,
  Clock,
  CheckCircle2,
  TrendingUp,
  Receipt,
  MessageSquare,
  Search,
  Trash2,
  ArrowUpRight,
  ShieldCheck,
  IndianRupee,
  Wallet,
  Hourglass,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "draft" | "sent" | "approved">("all");
  const [activeView, setActiveView] = useState<"proposals" | "invoices">("proposals");
  const [searchQuery, setSearchQuery] = useState("");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    async function initDashboard() {
      setIsLoading(true);
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.push("/login");
          return;
        }

        setUserEmail(user.email || "");
        setUserId(user.id);

        // Fetch Profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profileData) {
          setProfile(profileData as Profile);
        } else {
          const defaultProfile: Partial<Profile> = {
            id: user.id,
            business_name: "",
            upi_id: "",
          };
          const { data: created } = await supabase
            .from("profiles")
            .upsert(defaultProfile)
            .select()
            .single();
          if (created) setProfile(created as Profile);
        }

        // Fetch Proposals & Invoices
        await refreshProposals(user.id);
        await refreshInvoices();
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    initDashboard();
  }, [router, supabase]);

  async function refreshProposals(uid?: string) {
    const currentUid = uid || userId;
    if (!currentUid) return;

    const { data, error } = await supabase
      .from("proposals")
      .select("*, client:clients(*)")
      .eq("user_id", currentUid)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setProposals(data as unknown as Proposal[]);
    }
  }

  async function refreshInvoices() {
    const { data, error } = await supabase
      .from("invoices")
      .select("*, proposal:proposals(*, client:clients(*))")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setInvoices(data as unknown as Invoice[]);
    }
  }

  async function handleDeleteProposal(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this proposal?")) return;

    const { error } = await supabase.from("proposals").delete().eq("id", id);
    if (!error) {
      setProposals((prev) => prev.filter((p) => p.id !== id));
      showToast("Proposal deleted");
    }
  }

  async function handleMarkAsPaid(invoiceId: string) {
    const { error } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    if (!error) {
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId
            ? { ...inv, status: "paid", paid_at: new Date().toISOString() }
            : inv
        )
      );
      showToast("Invoice marked as Paid!");
    }
  }

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }

  function copyShareLink(proposalId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const url = `${window.location.origin}/p/${proposalId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(proposalId);
    showToast("Shareable link copied!");
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Filtered Proposals
  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      const matchesTab = activeTab === "all" || p.status === activeTab;
      const clientName = p.client?.name || "";
      const matchesSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        clientName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [proposals, activeTab, searchQuery]);

  // Financial Stats: how much we got, how much is left
  const financialStats = useMemo(() => {
    const totalReceived = invoices
      .filter((inv) => inv.status === "paid")
      .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

    const totalLeft = invoices
      .filter((inv) => inv.status !== "paid")
      .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

    const totalInvoiced = totalReceived + totalLeft;
    const collectionPercentage =
      totalInvoiced > 0 ? Math.round((totalReceived / totalInvoiced) * 100) : 0;

    const overdueAmount = invoices
      .filter((inv) => inv.status !== "paid" && isInvoiceOverdue(inv.due_date, inv.status))
      .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

    const proposalsCount = proposals.length;
    const sentCount = proposals.filter((p) => p.status === "sent").length;
    const approvedCount = proposals.filter((p) => p.status === "approved").length;

    return {
      totalReceived,
      totalLeft,
      totalInvoiced,
      collectionPercentage,
      overdueAmount,
      proposalsCount,
      sentCount,
      approvedCount,
    };
  }, [invoices, proposals]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-zinc-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const needsUpiSetup = !profile?.upi_id || !profile?.business_name;

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col selection:bg-zinc-950 selection:text-white">
      <Navbar
        userEmail={userEmail}
        profile={profile}
        onOpenProfile={() => setIsProfileModalOpen(true)}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="bg-zinc-900 text-white px-3.5 py-2 rounded-xl shadow-lg border border-zinc-800 flex items-center gap-2 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-6">
        {/* Profile Warning Banner */}
        {needsUpiSetup && (
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-950">Add your UPI ID & Business Name</h4>
                <p className="text-xs text-amber-800/90 mt-0.5">
                  Clients need your UPI ID to generate payment QR codes when they accept your proposals.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-700 hover:bg-amber-800 text-white transition shrink-0"
            >
              <span>Setup Now</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Financial Overview Card: How much we got vs How much is left */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-zinc-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Financial Health & Cashflow
              </span>
              <h2 className="text-base font-bold text-zinc-950 mt-0.5">
                Payments & Outstanding Pipeline
              </h2>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-500 font-medium">Collection Progress:</span>
              <span className="font-bold text-zinc-900 font-mono">
                {financialStats.collectionPercentage}%
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-zinc-100 rounded-full h-2.5 overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${financialStats.collectionPercentage}%` }}
              title={`Received: ${formatINR(financialStats.totalReceived)}`}
            />
          </div>

          {/* 3 Core Metric Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
            {/* Box 1: Total Received */}
            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/70">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Payment Received
                </span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                  Cleared
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-mono tabular-nums mt-2">
                {formatINR(financialStats.totalReceived)}
              </p>
              <p className="text-[11px] text-emerald-700/80 mt-1 font-medium">
                Deposited directly to your UPI bank
              </p>
            </div>

            {/* Box 2: Total Left / Pending */}
            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/70">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Hourglass className="w-3.5 h-3.5 text-amber-600" />
                  Amount Left to Collect
                </span>
                <span className="text-[10px] font-semibold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-full">
                  Outstanding
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-amber-800 font-mono tabular-nums mt-2">
                {formatINR(financialStats.totalLeft)}
              </p>
              <p className="text-[11px] text-amber-700/80 mt-1 font-medium">
                {financialStats.overdueAmount > 0
                  ? `Includes ${formatINR(financialStats.overdueAmount)} overdue`
                  : "Awaiting client payments"}
              </p>
            </div>

            {/* Box 3: Total Invoiced */}
            <div className="p-4 rounded-xl bg-zinc-50/70 border border-zinc-200/80">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-zinc-400" />
                  Total Invoiced
                </span>
                <span className="text-[10px] font-semibold text-zinc-600 bg-zinc-200/60 px-2 py-0.5 rounded-full">
                  {invoices.length} invoices
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-zinc-950 font-mono tabular-nums mt-2">
                {formatINR(financialStats.totalInvoiced)}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1 font-medium">
                Across {financialStats.approvedCount} approved project(s)
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center p-1 bg-zinc-100 rounded-lg max-w-fit">
            <button
              onClick={() => setActiveView("proposals")}
              className={`px-3.5 py-1 rounded-md text-xs font-semibold transition ${
                activeView === "proposals"
                  ? "bg-white text-zinc-950 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              Proposals ({proposals.length})
            </button>
            <button
              onClick={() => setActiveView("invoices")}
              className={`px-3.5 py-1 rounded-md text-xs font-semibold transition ${
                activeView === "invoices"
                  ? "bg-white text-zinc-950 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              Invoices & QR ({invoices.length})
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 outline-none w-full sm:w-56 transition placeholder:text-zinc-400"
              />
            </div>
            <Link
              href="/proposals/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 transition shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              New Proposal
            </Link>
          </div>
        </div>

        {/* View 1: Proposals View */}
        {activeView === "proposals" && (
          <div className="bg-white rounded-xl border border-zinc-200/80 shadow-xs overflow-hidden">
            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 px-4 py-2.5 border-b border-zinc-100 overflow-x-auto text-xs font-medium">
              {(["all", "draft", "sent", "approved"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded-md capitalize transition ${
                    activeTab === tab
                      ? "bg-zinc-900 text-white font-semibold"
                      : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                  }`}
                >
                  {tab === "all" ? "All Proposals" : tab}
                </button>
              ))}
            </div>

            {filteredProposals.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-600 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900">No proposals found</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
                  {searchQuery || activeTab !== "all"
                    ? "Try adjusting your search filter."
                    : "Create a proposal and share the link with your client for 1-tap approval."}
                </p>
                <Link
                  href="/proposals/new"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create First Proposal
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-100 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-50/50">
                      <th className="py-3 px-5">Proposal</th>
                      <th className="py-3 px-5">Client</th>
                      <th className="py-3 px-5">Amount</th>
                      <th className="py-3 px-5">Status</th>
                      <th className="py-3 px-5">Date</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-xs">
                    {filteredProposals.map((prop) => (
                      <tr
                        key={prop.id}
                        className="hover:bg-zinc-50/80 transition cursor-pointer group"
                        onClick={() => window.open(`/p/${prop.id}`, "_blank")}
                      >
                        <td className="py-3.5 px-5">
                          <div className="font-semibold text-zinc-900 group-hover:text-zinc-600 transition flex items-center gap-1.5">
                            {prop.title}
                            <ExternalLink className="w-3 h-3 text-zinc-400 opacity-0 group-hover:opacity-100 transition" />
                          </div>
                          <div className="text-[11px] text-zinc-400 mt-0.5">
                            {prop.line_items?.length || 0} items • {prop.milestones?.length || 1} milestone(s)
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-zinc-700 font-medium">
                          {prop.client?.name || <span className="text-zinc-400 italic">No client</span>}
                        </td>
                        <td className="py-3.5 px-5 font-bold text-zinc-950 font-mono tabular-nums">
                          {formatINR(prop.total_amount)}
                        </td>
                        <td className="py-3.5 px-5">
                          <StatusBadge status={prop.status} type="proposal" />
                        </td>
                        <td className="py-3.5 px-5 text-zinc-400 tabular-nums">
                          {formatDate(prop.created_at)}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div
                            className="flex items-center justify-end gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={(e) => copyShareLink(prop.id, e)}
                              title="Copy Share Link"
                              className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition border border-zinc-200"
                            >
                              {copiedId === prop.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              onClick={(e) => handleDeleteProposal(prop.id, e)}
                              title="Delete Proposal"
                              className="p-1.5 rounded-md text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* View 2: Invoices & Payments View */}
        {activeView === "invoices" && (
          <div className="bg-white rounded-xl border border-zinc-200/80 shadow-xs overflow-hidden">
            {invoices.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-600 flex items-center justify-center mx-auto mb-3">
                  <Receipt className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900">No invoices yet</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
                  Invoices are automatically generated when a client accepts your proposal link.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-100 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-50/50">
                      <th className="py-3 px-5">Milestone / Invoice</th>
                      <th className="py-3 px-5">Client</th>
                      <th className="py-3 px-5">Amount</th>
                      <th className="py-3 px-5">Due Date</th>
                      <th className="py-3 px-5">Status</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-xs">
                    {invoices.map((inv) => {
                      const overdue = isInvoiceOverdue(inv.due_date, inv.status);
                      const displayStatus = overdue && inv.status === "unpaid" ? "overdue" : inv.status;
                      const clientPhone = inv.proposal?.client?.phone || "";
                      const clientName = inv.proposal?.client?.name || "Client";
                      const invoiceLink = `${typeof window !== "undefined" ? window.location.origin : ""}/i/${inv.id}`;
                      const reminderMessage = `Hi ${clientName}, here is the invoice for ${inv.milestone_label} (${formatINR(inv.amount)}). You can view and pay via UPI QR code here: ${invoiceLink}`;
                      const waUrl = `https://wa.me/${normalizePhoneForWhatsApp(clientPhone)}?text=${encodeURIComponent(reminderMessage)}`;

                      return (
                        <tr
                          key={inv.id}
                          className="hover:bg-zinc-50/80 transition cursor-pointer"
                          onClick={() => window.open(`/i/${inv.id}`, "_blank")}
                        >
                          <td className="py-3.5 px-5">
                            <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                              {inv.milestone_label}
                              <ExternalLink className="w-3 h-3 text-zinc-400" />
                            </div>
                            <div className="text-[11px] text-zinc-400 mt-0.5">
                              {inv.proposal?.title || "Proposal"}
                            </div>
                          </td>
                          <td className="py-3.5 px-5 font-medium text-zinc-700">
                            {inv.proposal?.client?.name || "-"}
                          </td>
                          <td className="py-3.5 px-5 font-bold text-zinc-950 font-mono tabular-nums">
                            {formatINR(inv.amount)}
                          </td>
                          <td className="py-3.5 px-5 text-zinc-400 tabular-nums">
                            {formatDate(inv.due_date)}
                          </td>
                          <td className="py-3.5 px-5">
                            <StatusBadge status={displayStatus} type="invoice" />
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <div
                              className="flex items-center justify-end gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {inv.status !== "paid" && (
                                <>
                                  <button
                                    onClick={() => handleMarkAsPaid(inv.id)}
                                    className="px-2.5 py-1 rounded-md text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                                  >
                                    Mark Paid
                                  </button>
                                  {clientPhone && (
                                    <a
                                      href={waUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Send WhatsApp Reminder"
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition"
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                      WhatsApp
                                    </a>
                                  )}
                                </>
                              )}
                              {inv.status === "paid" && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                  <Check className="w-3 h-3" />
                                  Paid {formatDate(inv.paid_at)}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        userId={userId}
        initialProfile={profile}
        onProfileUpdated={(updated) => setProfile(updated)}
      />
    </div>
  );
}
