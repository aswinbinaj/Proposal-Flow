import React from "react";
import { ProposalStatus, InvoiceStatus } from "@/types/database";

interface StatusBadgeProps {
  status: ProposalStatus | InvoiceStatus | string;
  type?: "proposal" | "invoice";
}

export function StatusBadge({ status, type = "proposal" }: StatusBadgeProps) {
  let badgeStyle = "bg-zinc-100 text-zinc-700 border-zinc-200/80";
  let dotStyle = "bg-zinc-400";
  let label = status;

  if (type === "proposal") {
    switch (status) {
      case "draft":
        badgeStyle = "bg-zinc-100 text-zinc-600 border-zinc-200";
        dotStyle = "bg-zinc-400";
        label = "Draft";
        break;
      case "sent":
        badgeStyle = "bg-blue-50 text-blue-700 border-blue-200/80";
        dotStyle = "bg-blue-500";
        label = "Sent to Client";
        break;
      case "approved":
        badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200/80";
        dotStyle = "bg-emerald-500";
        label = "Approved";
        break;
    }
  } else {
    switch (status) {
      case "unpaid":
        badgeStyle = "bg-amber-50 text-amber-700 border-amber-200/80";
        dotStyle = "bg-amber-500";
        label = "Unpaid";
        break;
      case "paid":
        badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200/80";
        dotStyle = "bg-emerald-500";
        label = "Paid";
        break;
      case "overdue":
        badgeStyle = "bg-rose-50 text-rose-700 border-rose-200/80";
        dotStyle = "bg-rose-500";
        label = "Overdue";
        break;
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border ${badgeStyle}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotStyle}`} />
      <span>{label}</span>
    </span>
  );
}
