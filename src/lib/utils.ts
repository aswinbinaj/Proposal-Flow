import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amount: number | string | null | undefined): string {
  const num = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(isNaN(num) ? 0 : num);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Builds standard UPI deep link string
 * format: upi://pay?pa={upi_id}&pn={business_name}&am={amount}&tn={milestone_label}&cu=INR
 */
export function buildUpiDeepLink({
  upiId,
  businessName,
  amount,
  milestoneLabel,
}: {
  upiId: string;
  businessName: string;
  amount: number | string;
  milestoneLabel: string;
}): string {
  const cleanAmount = typeof amount === "number" ? amount.toFixed(2) : parseFloat(amount).toFixed(2);
  const params = new URLSearchParams({
    pa: upiId.trim(),
    pn: businessName.trim(),
    am: cleanAmount,
    tn: milestoneLabel.trim() || "Invoice Payment",
    cu: "INR",
  });
  return `upi://pay?${params.toString()}`;
}

/**
 * Normalizes phone number for wa.me links
 * e.g., converts '9876543210' -> '919876543210'
 */
export function normalizePhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

/**
 * Checks if an invoice is overdue based on due_date and status
 */
export function isInvoiceOverdue(dueDate: string, status: string): boolean {
  if (status === "paid") return false;
  const due = new Date(dueDate);
  const now = new Date();
  // Set both to midnight for pure day comparison
  due.setHours(23, 59, 59, 999);
  return now.getTime() > due.getTime();
}
