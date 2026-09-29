"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Client, Profile, Proposal, Invoice } from "@/types/database";
import { Navbar } from "@/components/Navbar";
import { ProfileModal } from "@/components/ProfileModal";
import { ClientModal } from "@/components/ClientModal";
import { ClientDetailsModal } from "@/components/ClientDetailsModal";
import { formatINR, normalizePhoneForWhatsApp } from "@/lib/utils";
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  Edit2,
  Trash2,
  MessageSquare,
  Building,
  CheckCircle2,
  FileText,
  Receipt,
  ExternalLink,
  ChevronRight,
  Filter,
} from "lucide-react";

export default function ClientsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "unpaid" | "paid">("all");

  // Modals
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [selectedClientForDetails, setSelectedClientForDetails] = useState<Client | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
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

        if (profileData) setProfile(profileData as Profile);

        // Fetch Clients
        const { data: clientList } = await supabase
          .from("clients")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (clientList) setClients(clientList as Client[]);

        // Fetch Proposals
        const { data: propList } = await supabase
          .from("proposals")
          .select("*, client:clients(*)")
          .eq("user_id", user.id);

        if (propList) setProposals(propList as unknown as Proposal[]);

        // Fetch Invoices
        const { data: invList } = await supabase
          .from("invoices")
          .select("*, proposal:proposals(*, client:clients(*))");

        if (invList) setInvoices(invList as unknown as Invoice[]);
      } catch (err) {
        console.error("Clients page load error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router, supabase]);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  }

  async function handleDeleteClient(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete client "${name}"? Existing proposals will be preserved.`)) {
      return;
    }

    const { error } = await supabase.from("clients").delete().eq("id", id).eq("user_id", userId);
    if (!error) {
      setClients((prev) => prev.filter((c) => c.id !== id));
      showToast("Client removed");
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

  // Calculate client financial stats
  const clientFinancialMap = useMemo(() => {
    const map = new Map<
      string,
      { totalBilled: number; totalPaid: number; totalPending: number; worksCount: number }
    >();

    clients.forEach((c) => {
      const clientProps = proposals.filter((p) => p.client_id === c.id);
      const propIds = new Set(clientProps.map((p) => p.id));
      const clientInvs = invoices.filter(
        (inv) => propIds.has(inv.proposal_id) || inv.proposal?.client_id === c.id
      );

      const totalBilled = clientProps.reduce((s, p) => s + Number(p.total_amount || 0), 0);
      const totalPaid = clientInvs
        .filter((i) => i.status === "paid")
        .reduce((s, i) => s + Number(i.amount || 0), 0);
      const totalPending = clientInvs
        .filter((i) => i.status !== "paid")
        .reduce((s, i) => s + Number(i.amount || 0), 0);

      map.set(c.id, {
        totalBilled,
        totalPaid,
        totalPending,
        worksCount: clientProps.length,
      });
    });

    return map;
  }, [clients, proposals, invoices]);

  // Filtered Clients based on search & payment status filter
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      const stats = clientFinancialMap.get(c.id);
      if (!stats) return paymentFilter === "all";

      if (paymentFilter === "unpaid") {
        return stats.totalPending > 0;
      }
      if (paymentFilter === "paid") {
        return stats.totalPaid > 0 && stats.totalPending === 0;
      }

      return true;
    });
  }, [clients, searchQuery, paymentFilter, clientFinancialMap]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-zinc-400">Loading clients directory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col selection:bg-zinc-950 selection:text-white">
      <Navbar
        userEmail={userEmail}
        profile={profile}
        onOpenProfile={() => setIsProfileModalOpen(true)}
      />

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="bg-zinc-900 text-white px-3.5 py-2 rounded-xl shadow-lg border border-zinc-800 flex items-center gap-2 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-zinc-950 tracking-tight">Clients Directory</h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Click any client to inspect their proposals, invoices, and payment history
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 outline-none w-full sm:w-56 transition placeholder:text-zinc-400"
              />
            </div>

            <button
              onClick={() => {
                setClientToEdit(null);
                setIsClientModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 transition shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add Client</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs (All / Pending Payment / Fully Paid) */}
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg max-w-fit text-xs font-semibold">
          <button
            onClick={() => setPaymentFilter("all")}
            className={`px-3 py-1 rounded-md transition ${
              paymentFilter === "all"
                ? "bg-white text-zinc-950 shadow-xs"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            All Clients ({clients.length})
          </button>
          <button
            onClick={() => setPaymentFilter("unpaid")}
            className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 ${
              paymentFilter === "unpaid"
                ? "bg-white text-amber-800 shadow-xs"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Pending Payment</span>
          </button>
          <button
            onClick={() => setPaymentFilter("paid")}
            className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 ${
              paymentFilter === "paid"
                ? "bg-white text-emerald-800 shadow-xs"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Fully Paid</span>
          </button>
        </div>

        {/* Clients Table */}
        <div className="bg-white rounded-xl border border-zinc-200/80 shadow-xs overflow-hidden">
          {filteredClients.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-600 flex items-center justify-center mx-auto mb-3">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-900">No clients match this filter</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
                {searchQuery || paymentFilter !== "all"
                  ? "Try resetting your search or payment filter tab."
                  : "Add your first client to create proposals and send WhatsApp reminders."}
              </p>
              <button
                onClick={() => {
                  setPaymentFilter("all");
                  setSearchQuery("");
                  if (clients.length === 0) setIsClientModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 transition"
              >
                {clients.length === 0 ? "Add Client" : "Clear Filters"}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-50/50">
                    <th className="py-3 px-5">Client</th>
                    <th className="py-3 px-5">Contact</th>
                    <th className="py-3 px-5">Works</th>
                    <th className="py-3 px-5">Payment Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                  {filteredClients.map((client) => {
                    const stats = clientFinancialMap.get(client.id) || {
                      totalBilled: 0,
                      totalPaid: 0,
                      totalPending: 0,
                      worksCount: 0,
                    };
                    const waUrl = `https://wa.me/${normalizePhoneForWhatsApp(client.phone)}`;

                    return (
                      <tr
                        key={client.id}
                        className="hover:bg-zinc-50/80 transition cursor-pointer group"
                        onClick={() => setSelectedClientForDetails(client)}
                      >
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-800 flex items-center justify-center text-[10px] font-bold">
                              {client.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-zinc-900 group-hover:text-zinc-600 transition flex items-center gap-1.5">
                                <span>{client.name}</span>
                                <ChevronRight className="w-3 h-3 text-zinc-400 opacity-0 group-hover:opacity-100 transition" />
                              </div>
                              <span className="text-[10px] text-zinc-400">Click to view works</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-5 text-zinc-600 font-mono">
                          <div className="flex items-center gap-2">
                            <span>{client.phone}</span>
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Chat on WhatsApp"
                              className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>

                        <td className="py-3.5 px-5">
                          <span className="inline-flex items-center gap-1 text-zinc-700 font-medium">
                            <FileText className="w-3 h-3 text-zinc-400" />
                            <span>{stats.worksCount} project(s)</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-5">
                          {stats.totalPending > 0 ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 font-mono tabular-nums">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              <span>{formatINR(stats.totalPending)} Pending</span>
                            </div>
                          ) : stats.totalPaid > 0 ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-mono tabular-nums">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>All Paid ({formatINR(stats.totalPaid)})</span>
                            </div>
                          ) : (
                            <span className="text-zinc-400 text-[11px]">No invoices</span>
                          )}
                        </td>

                        <td className="py-3.5 px-5 text-right">
                          <div
                            className="flex items-center justify-end gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => setSelectedClientForDetails(client)}
                              title="View Works & History"
                              className="px-2.5 py-1 rounded-md text-xs font-medium text-zinc-700 hover:bg-zinc-100 border border-zinc-200 transition"
                            >
                              View Works
                            </button>

                            <button
                              onClick={() => {
                                setClientToEdit(client);
                                setIsClientModalOpen(true);
                              }}
                              title="Edit Client"
                              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteClient(client.id, client.name)}
                              title="Delete Client"
                              className="p-1.5 rounded-md text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
      </main>

      {/* Client Works & Invoices Details Modal */}
      <ClientDetailsModal
        isOpen={Boolean(selectedClientForDetails)}
        onClose={() => setSelectedClientForDetails(null)}
        client={selectedClientForDetails}
        proposals={proposals}
        invoices={invoices}
        onMarkAsPaid={handleMarkAsPaid}
      />

      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        userId={userId}
        clientToEdit={clientToEdit}
        onClientSaved={(saved) => {
          setClients((prev) => {
            const exists = prev.some((c) => c.id === saved.id);
            if (exists) {
              return prev.map((c) => (c.id === saved.id ? saved : c));
            }
            return [saved, ...prev];
          });
          showToast(clientToEdit ? "Client updated" : "Client added");
        }}
      />

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
