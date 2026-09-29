import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const proposalId = params.id;
  if (!proposalId) {
    return NextResponse.json({ error: "Missing proposal ID" }, { status: 400 });
  }

  // Extract client IP address for audit trail
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : realIp || "127.0.0.1";

  const supabase = createAdminClient();

  try {
    // Try calling the atomic approve_proposal RPC function
    const { data: rpcData, error: rpcError } = await supabase.rpc("approve_proposal", {
      p_proposal_id: proposalId,
      p_ip: clientIp,
    });

    if (!rpcError && rpcData?.success) {
      return NextResponse.json(rpcData);
    }

    // Fallback if RPC is not present or threw error: perform direct atomic update and invoice generation
    console.warn("RPC failed or not found, falling back to direct update:", rpcError?.message);

    // 1. Fetch proposal
    const { data: proposal, error: fetchErr } = await supabase
      .from("proposals")
      .select("*")
      .eq("id", proposalId)
      .single();

    if (fetchErr || !proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    // 2. Mark proposal as approved
    const { error: updateErr } = await supabase
      .from("proposals")
      .update({
        status: "approved",
        approved_at: proposal.approved_at || new Date().toISOString(),
        approved_ip: proposal.approved_ip || clientIp,
      })
      .eq("id", proposalId);

    if (updateErr) throw updateErr;

    // 3. Check existing invoices
    const { data: existingInvoices } = await supabase
      .from("invoices")
      .select("id")
      .eq("proposal_id", proposalId);

    if (existingInvoices && existingInvoices.length > 0) {
      return NextResponse.json({
        success: true,
        proposal_id: proposalId,
        invoice_ids: existingInvoices.map((inv) => inv.id),
      });
    }

    // 4. Generate invoices based on milestones
    const milestones = proposal.milestones || [];
    const invoiceRows =
      milestones.length > 0
        ? milestones.map((m: any) => ({
            proposal_id: proposalId,
            milestone_label: m.label || "Milestone",
            amount: Number(m.amount) || proposal.total_amount,
            due_date:
              m.due_date ||
              new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            status: "unpaid",
          }))
        : [
            {
              proposal_id: proposalId,
              milestone_label: "Full Payment",
              amount: proposal.total_amount,
              due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              status: "unpaid",
            },
          ];

    const { data: insertedInvoices, error: invError } = await supabase
      .from("invoices")
      .insert(invoiceRows)
      .select("id");

    if (invError) throw invError;

    return NextResponse.json({
      success: true,
      proposal_id: proposalId,
      invoice_ids: (insertedInvoices || []).map((i) => i.id),
    });
  } catch (err: any) {
    console.error("Error approving proposal:", err);
    return NextResponse.json(
      { error: err.message || "Failed to approve proposal" },
      { status: 500 }
    );
  }
}
