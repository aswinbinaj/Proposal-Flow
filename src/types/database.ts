export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  rate: number;
}

export interface Milestone {
  id?: string;
  label: string;
  amount: number;
  percentage?: number;
  due_date?: string;
}

export type ProposalStatus = "draft" | "sent" | "approved";
export type InvoiceStatus = "unpaid" | "paid" | "overdue";

export interface Profile {
  id: string;
  business_name: string;
  upi_id: string;
  phone?: string;
  logo_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  email?: string;
  created_at?: string;
}

export interface Proposal {
  id: string;
  user_id: string;
  client_id?: string | null;
  title: string;
  line_items: LineItem[];
  milestones: Milestone[];
  total_amount: number;
  status: ProposalStatus;
  approved_at?: string | null;
  approved_ip?: string | null;
  created_at: string;
  client?: Client | null;
  profile?: Profile | null;
}

export interface Invoice {
  id: string;
  proposal_id: string;
  milestone_label: string;
  amount: number;
  status: InvoiceStatus;
  due_date: string;
  paid_at?: string | null;
  created_at: string;
  proposal?: Proposal | null;
}

export type Database = any;
