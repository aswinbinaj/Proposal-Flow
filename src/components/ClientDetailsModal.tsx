"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Client, Proposal, Invoice } from "@/types/database";
import { formatINR, formatDate, isInvoiceOverdue, normalizePhoneForWhatsApp } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import {
  X,
  Phone,
  Mail,
  ExternalLink,
  MessageSquare,
  FileText,
  Receipt,
  Check,
  Calendar,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
} from "lucide-react";

interface ClientDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  proposals: Proposal[];
  invoices: Invoice[];
  onMarkAsPaid?: (invoiceId: string) => void;
}

export function ClientDetailsModal({
  isOpen,
  onClose,
  client,
  proposals,
  invoices,
  onMarkAsPaid,
}: ClientDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<"works" | "invoices">("works");

  if (!isOpen || !client) return null;

  // Filter client's proposals and invoices
  const clientProposals = proposals.filter((p) => p.client_id === client.id);
  const clientProposalIds = new Set(clientProposals.map((p) => p.id));
  const clientInvoices = invoices.filter(
    (inv) =>
      clientProposalIds.has(inv.proposal_id) ||
      inv.proposal?.client_id === client.id
  );

  // Financial calculations
  const totalBilled = clientProposals.reduce(
    (sum, p) => sum + Number(p.total_amount || 0),
    0
  );
  const totalPaid = clientInvoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
  const totalPending = clientInvoices
    .filter((inv) => inv.status !== "paid")
    .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

  const waUrl = `https://wa.me/${normalizePhoneForWhatsApp(client.phone)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-zinc-200/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-zinc-100 flex items-start justify-between bg-zinc-50/50">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-zinc-950 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {client.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-950 tracking-tight leading-snug">
                {client.name}
              </h3>
              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 mt-1 font-mono">
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-zinc-400" />
                  {client.phone}
                </span>
                {client.email && (
                  <span className="flex items-center gap-1 font-sans">
                    <Mail className="w-3 h-3 text-zinc-400" />
                    {client.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Financial KPI Summary */}
        <div className="p-5 border-b border-zinc-100 bg-white grid grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-zinc-50/70 border border-zinc-200/70">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Total Proposals
            </span>
            <p className="text-base font-bold text-zinc-950 font-mono tabular-nums mt-1">
              {formatINR(totalBilled)}
            </p>
            <p className="text-[10px] text-zinc-400 mt-0.5">{clientProposals.length} project(s)</p>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/70">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
              Payments Received
            </span>
            <p className="text-base font-bold text-emerald-700 font-mono tabular-nums mt-1">
              {formatINR(totalPaid)}
            </p>
            <p className="text-[10px] text-emerald-600/80 mt-0.5">Cleared via UPI</p>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/70">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
              Pending / Left
            </span>
            <p className="text-base font-bold text-amber-800 font-mono tabular-nums mt-1">
              {formatINR(totalPending)}
            </p>
            <p className="text-[10px] text-amber-700/80 mt-0.5">Outstanding balance</p>
          </div>
        </div>

        {/* Tabs: Works / Invoices */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-zinc-100 bg-zinc-50/40 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("works")}
            className={`pb-2.5 px-1 border-b-2 transition ${
              activeTab === "works"
                ? "border-zinc-950 text-zinc-950"
                : "border-transparent text-zinc-400 hover:text-zinc-700"
            }`}
          >
            Works & Proposals ({clientProposals.length})
          </button>
          <button
            onClick={() => setActiveTab("invoices")}
            className={`pb-2.5 px-1 border-b-2 transition ${
              activeTab === "invoices"
                ? "border-zinc-950 text-zinc-950"
                : "border-transparent text-zinc-400 hover:text-zinc-700"
            }`}
          >
            Invoices & Payments ({clientInvoices.length})
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {activeTab === "works" && (
            <>
              {clientProposals.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500">No proposals created for this client yet.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {clientProposals.map((prop) => (
                    <div
                      key={prop.id}
                      className="p-3.5 rounded-xl border border-zinc-200/80 bg-white hover:bg-zinc-50/70 transition flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-zinc-900 truncate">
                            {prop.title}
                          </h4>
                          <StatusBadge status={prop.status} type="proposal" />
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-1">
                          <span>{formatDate(prop.created_at)}</span>
                          <span>•</span>
                          <span>{prop.line_items?.length || 0} line items</span>
                          <span>•</span>
                          <span>{prop.milestones?.length || 1} milestone(s)</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-bold text-zinc-950 font-mono tabular-nums">
                          {formatINR(prop.total_amount)}
                        </span>
                        <a
                          href={`/p/${prop.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition border border-zinc-200"
                          title="Open Client Proposal Link"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "invoices" && (
            <>
              {clientInvoices.length === 0 ? (
                <div className="py-12 text-center">
                  <Receipt className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500">
                    No invoices generated yet. Invoices are auto-created when the client accepts a proposal.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {clientInvoices.map((inv) => {
                    const overdue = isInvoiceOverdue(inv.due_date, inv.status);
                    const displayStatus = overdue && inv.status === "unpaid" ? "overdue" : inv.status;
                    const invoiceLink = `${typeof window !== "undefined" ? window.location.origin : ""}/i/${inv.id}`;
                    const reminderMsg = `Hi ${client.name}, here is the invoice for ${inv.milestone_label} (${formatINR(inv.amount)}). You can view and pay via UPI QR here: ${invoiceLink}`;
                    const invWaUrl = `https://wa.me/${normalizePhoneForWhatsApp(client.phone)}?text=${encodeURIComponent(reminderMsg)}`;

                    return (
                      <div
                        key={inv.id}
                        className="p-3.5 rounded-xl border border-zinc-200/80 bg-white hover:bg-zinc-50/70 transition flex items-center justify-between gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-zinc-900 truncate">
                              {inv.milestone_label}
                            </h4>
                            <StatusBadge status={displayStatus} type="invoice" />
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-1">
                            <span>Due: {formatDate(inv.due_date)}</span>
                            {inv.paid_at && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-600 font-medium">
                                  Paid {formatDate(inv.paid_at)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="text-xs font-bold text-zinc-950 font-mono tabular-nums">
                            {formatINR(inv.amount)}
                          </span>

                          {inv.status !== "paid" && (
                            <>
                              {onMarkAsPaid && (
                                <button
                                  onClick={() => onMarkAsPaid(inv.id)}
                                  className="px-2 py-1 rounded-md text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                                >
                                  Mark Paid
                                </button>
                              )}
                              <a
                                href={invWaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Send WhatsApp Reminder"
                                className="p-1.5 rounded-md text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>
                            </>
                          )}

                          <a
                            href={`/i/${inv.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition border border-zinc-200"
                            title="Open Invoice & UPI QR"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
