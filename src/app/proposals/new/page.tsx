"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Client, Profile, LineItem, Milestone } from "@/types/database";
import { Navbar } from "@/components/Navbar";
import { ClientModal } from "@/components/ClientModal";
import { ProfileModal } from "@/components/ProfileModal";
import { formatINR } from "@/lib/utils";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Users,
  CheckCircle2,
  AlertCircle,
  Share2,
  Split,
  Calendar,
  Layers,
  Save,
} from "lucide-react";

export default function NewProposalPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clients, setClients] = useState<Client[]>([]);

  // Modals
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "Website UI/UX Design & Branding", quantity: 1, rate: 25000 },
    { description: "Frontend Development (Next.js & Tailwind)", quantity: 1, rate: 35000 },
  ]);

  // Milestones State
  const [splitMilestones, setSplitMilestones] = useState(true);
  const [milestones, setMilestones] = useState<Milestone[]>([
    { label: "50% Advance on signing", amount: 30000, percentage: 50 },
    { label: "50% on Final Delivery", amount: 30000, percentage: 50 },
  ]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
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

        // Fetch profile
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (prof) setProfile(prof as Profile);

        // Fetch clients
        const { data: clientList } = await supabase
          .from("clients")
          .select("*")
          .eq("user_id", user.id)
          .order("name");

        if (clientList && clientList.length > 0) {
          setClients(clientList as Client[]);
          setSelectedClientId(clientList[0].id);
        }
      } catch (err) {
        console.error("Error loading new proposal page:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router, supabase]);

  // Calculate total amount
  const totalAmount = useMemo(() => {
    return lineItems.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      return sum + qty * rate;
    }, 0);
  }, [lineItems]);

  // Auto-rebalance milestones when total changes if using 50/50 split default
  useEffect(() => {
    if (splitMilestones && milestones.length === 2 && totalAmount > 0) {
      const half = Math.round(totalAmount / 2);
      setMilestones([
        { label: "50% Advance on signing", amount: half, percentage: 50 },
        { label: "50% on Final Delivery", amount: totalAmount - half, percentage: 50 },
      ]);
    }
  }, [totalAmount, splitMilestones]);

  // Line item handlers
  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { description: "", quantity: 1, rate: 0 },
    ]);
  }

  function updateLineItem(index: number, field: keyof LineItem, value: any) {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function removeLineItem(index: number) {
    if (lineItems.length === 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  // Milestone handlers
  function addMilestone() {
    setMilestones((prev) => [
      ...prev,
      { label: `Milestone ${prev.length + 1}`, amount: 0 },
    ]);
  }

  function updateMilestone(index: number, field: keyof Milestone, value: any) {
    setMilestones((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function removeMilestone(index: number) {
    if (milestones.length === 1) return;
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  }

  const milestonesSum = useMemo(() => {
    if (!splitMilestones) return totalAmount;
    return milestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
  }, [milestones, splitMilestones, totalAmount]);

  async function handleSaveProposal(targetStatus: "draft" | "sent") {
    if (!title.trim()) {
      setErrorMessage("Please enter a title for this proposal.");
      return;
    }

    if (lineItems.length === 0 || totalAmount <= 0) {
      setErrorMessage("Please add at least one line item with a rate greater than 0.");
      return;
    }

    if (splitMilestones && Math.abs(milestonesSum - totalAmount) > 1) {
      setErrorMessage(
        `The sum of your milestones (${formatINR(milestonesSum)}) does not match the total proposal amount (${formatINR(totalAmount)}).`
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const finalMilestones = splitMilestones
        ? milestones.map((m) => ({
            label: m.label.trim() || "Milestone",
            amount: Number(m.amount) || 0,
            due_date: m.due_date || undefined,
          }))
        : [
            {
              label: "Full Payment",
              amount: totalAmount,
            },
          ];

      const payload = {
        user_id: userId,
        client_id: selectedClientId || null,
        title: title.trim(),
        line_items: lineItems,
        milestones: finalMilestones,
        total_amount: totalAmount,
        status: targetStatus,
      };

      const { data, error } = await supabase
        .from("proposals")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      if (targetStatus === "sent") {
        router.push(`/p/${data.id}?created=true`);
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create proposal.");
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-zinc-400">Loading builder...</p>
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

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition border border-zinc-200"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-zinc-950 tracking-tight">
                New Proposal
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Build an itemized scope with milestone payment triggers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSaveProposal("draft")}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200 shadow-xs transition disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSaveProposal("sent")}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 shadow-xs transition disabled:opacity-50"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Publish & Share Link</span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Section 1: Title & Client */}
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-zinc-200/80 shadow-xs space-y-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Proposal Details
          </span>

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                Project Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Website Redesign & Brand Identity"
                className="w-full px-3 py-2 text-sm bg-zinc-50/50 border border-zinc-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition font-medium text-zinc-900 placeholder:text-zinc-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-zinc-600">
                  Client
                </label>
                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(true)}
                  className="text-xs font-semibold text-zinc-900 hover:underline flex items-center gap-1 transition"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add New Client</span>
                </button>
              </div>

              {clients.length === 0 ? (
                <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-3">
                  <span className="text-xs text-zinc-500">
                    No client profiles yet. Add your client to attach them.
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsClientModalOpen(true)}
                    className="px-2.5 py-1 rounded-md bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition"
                  >
                    + Add Client
                  </button>
                </div>
              ) : (
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-50/50 border border-zinc-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition text-zinc-800"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone} {c.email ? `• ${c.email}` : ""})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Line Items */}
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-zinc-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Scope & Deliverables
              </span>
              <p className="text-xs text-zinc-500 mt-0.5">
                Itemize tasks, billable modules, or deliverables
              </p>
            </div>
            <button
              type="button"
              onClick={addLineItem}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Row
            </button>
          </div>

          <div className="space-y-2.5">
            {lineItems.map((item, idx) => {
              const subtotal = (Number(item.quantity) || 0) * (Number(item.rate) || 0);

              return (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-zinc-50/70 border border-zinc-200/70 grid grid-cols-12 gap-2.5 items-center"
                >
                  <div className="col-span-12 sm:col-span-6">
                    <input
                      type="text"
                      placeholder="Description of deliverable..."
                      value={item.description}
                      onChange={(e) => updateLineItem(idx, "description", e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-200 rounded-md focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 outline-none text-zinc-900"
                    />
                  </div>

                  <div className="col-span-4 sm:col-span-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) =>
                        updateLineItem(idx, "quantity", Math.max(1, parseInt(e.target.value) || 1))
                      }
                      className="w-full px-2 py-1.5 text-xs bg-white border border-zinc-200 rounded-md focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 outline-none text-center"
                    />
                  </div>

                  <div className="col-span-5 sm:col-span-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="Rate (₹)"
                      value={item.rate}
                      onChange={(e) =>
                        updateLineItem(idx, "rate", Math.max(0, parseFloat(e.target.value) || 0))
                      }
                      className="w-full px-2 py-1.5 text-xs bg-white border border-zinc-200 rounded-md focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 outline-none font-mono text-right"
                    />
                  </div>

                  <div className="col-span-3 sm:col-span-2 flex items-center justify-between sm:justify-end gap-2">
                    <span className="text-xs font-bold text-zinc-900 font-mono tabular-nums">
                      {formatINR(subtotal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLineItem(idx)}
                      disabled={lineItems.length === 1}
                      title="Remove Item"
                      className="p-1 rounded text-zinc-400 hover:text-rose-600 transition disabled:opacity-20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Subtotal Footer */}
          <div className="pt-3 border-t border-zinc-100 flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-zinc-500">Total Proposal Value</span>
            <span className="text-xl font-bold text-zinc-950 font-mono tabular-nums">
              {formatINR(totalAmount)}
            </span>
          </div>
        </div>

        {/* Section 3: Payment Milestones */}
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-zinc-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Split className="w-3.5 h-3.5 text-zinc-600" />
                Payment Milestones
              </span>
              <p className="text-xs text-zinc-500 mt-0.5">
                When approved, each milestone becomes an invoice with its own UPI QR code
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-zinc-100 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setSplitMilestones(false)}
                className={`px-3 py-1 rounded-md font-semibold transition ${
                  !splitMilestones ? "bg-white text-zinc-950 shadow-xs" : "text-zinc-500"
                }`}
              >
                100% Upfront
              </button>
              <button
                type="button"
                onClick={() => setSplitMilestones(true)}
                className={`px-3 py-1 rounded-md font-semibold transition ${
                  splitMilestones ? "bg-white text-zinc-950 shadow-xs" : "text-zinc-500"
                }`}
              >
                Split Milestones
              </button>
            </div>
          </div>

          {splitMilestones && (
            <div className="space-y-2.5 pt-1">
              {milestones.map((m, mIdx) => (
                <div
                  key={mIdx}
                  className="p-3 rounded-lg bg-zinc-50/70 border border-zinc-200/70 grid grid-cols-12 gap-2.5 items-center"
                >
                  <div className="col-span-12 sm:col-span-6">
                    <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      value={m.label}
                      onChange={(e) => updateMilestone(mIdx, "label", e.target.value)}
                      placeholder="e.g. 50% Advance"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-200 rounded-md focus:ring-1 focus:ring-zinc-950 outline-none font-medium"
                    />
                  </div>

                  <div className="col-span-7 sm:col-span-4">
                    <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                      Amount (₹)
                    </label>
                    <input
                      type="number"
                      value={m.amount}
                      onChange={(e) =>
                        updateMilestone(mIdx, "amount", parseFloat(e.target.value) || 0)
                      }
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-200 rounded-md focus:ring-1 focus:ring-zinc-950 outline-none font-mono"
                    />
                  </div>

                  <div className="col-span-5 sm:col-span-2 flex items-center justify-end gap-2 pt-3 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => removeMilestone(mIdx)}
                      disabled={milestones.length === 1}
                      title="Remove Milestone"
                      className="p-1 rounded text-zinc-400 hover:text-rose-600 transition disabled:opacity-20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={addMilestone}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-900 hover:underline transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Milestone</span>
                </button>

                <div className="text-right">
                  <span className="text-xs text-zinc-500">Milestones Sum: </span>
                  <span
                    className={`text-xs font-bold font-mono tabular-nums ${
                      Math.abs(milestonesSum - totalAmount) > 1
                        ? "text-rose-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {formatINR(milestonesSum)} / {formatINR(totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSaveProposal("draft")}
            className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200 shadow-xs transition disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSaveProposal("sent")}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 shadow-xs transition disabled:opacity-50"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{isSubmitting ? "Publishing..." : "Publish & Share Link"}</span>
          </button>
        </div>
      </main>

      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        userId={userId}
        onClientSaved={(newClient) => {
          setClients((prev) => [newClient, ...prev]);
          setSelectedClientId(newClient.id);
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
