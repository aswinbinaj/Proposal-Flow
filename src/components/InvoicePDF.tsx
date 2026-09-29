import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { Invoice, Proposal, Profile } from "@/types/database";

// Create styles for invoice PDF
const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
    color: "#0f172a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 20,
    marginBottom: 20,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#4f46e5",
  },
  subtitle: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 4,
  },
  invoiceMeta: {
    textAlign: "right",
  },
  invoiceTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0f172a",
  },
  invoiceDate: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 2,
  },
  partySection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  partyBox: {
    width: "48%",
  },
  partyLabel: {
    fontSize: 8,
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: 4,
    fontWeight: "bold",
  },
  partyName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0f172a",
  },
  partyText: {
    fontSize: 9,
    color: "#475569",
    marginTop: 2,
  },
  card: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0f172a",
  },
  cardSubtitle: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 2,
  },
  cardAmount: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4f46e5",
    marginTop: 8,
  },
  qrSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eef2ff",
    borderRadius: 8,
    padding: 14,
    marginBottom: 20,
  },
  qrImage: {
    width: 90,
    height: 90,
    marginRight: 16,
    backgroundColor: "#ffffff",
    padding: 4,
    borderRadius: 4,
  },
  qrInfo: {
    flex: 1,
  },
  qrTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#312e81",
  },
  qrText: {
    fontSize: 9,
    color: "#4338ca",
    marginTop: 3,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 36,
    right: 36,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
    fontSize: 8,
    color: "#94a3b8",
  },
});

interface InvoicePDFProps {
  invoice: Invoice;
  proposal: Proposal;
  profile: Profile;
  qrDataUrl: string;
}

export function InvoicePDF({ invoice, proposal, profile, qrDataUrl }: InvoicePDFProps) {
  const formattedAmount = `INR ${Number(invoice.amount).toFixed(2)}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {profile.logo_url ? (
              <Image
                src={profile.logo_url}
                style={{ width: 44, height: 44, borderRadius: 6, marginRight: 12 }}
              />
            ) : null}
            <View>
              <Text style={styles.brandTitle}>
                {profile.business_name || "Invoice"}
              </Text>
              {profile.upi_id && (
                <Text style={styles.subtitle}>UPI ID: {profile.upi_id}</Text>
              )}
            </View>
          </View>
          <View style={styles.invoiceMeta}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceDate}>
              Due Date: {invoice.due_date || "Upon Receipt"}
            </Text>
            <Text style={styles.invoiceDate}>
              Status: {invoice.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Bill To */}
        <View style={styles.partySection}>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>Billed To</Text>
            <Text style={styles.partyName}>
              {proposal.client?.name || "Client"}
            </Text>
            {proposal.client?.phone && (
              <Text style={styles.partyText}>Phone: {proposal.client.phone}</Text>
            )}
            {proposal.client?.email && (
              <Text style={styles.partyText}>Email: {proposal.client.email}</Text>
            )}
          </View>

          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>Project Proposal</Text>
            <Text style={styles.partyName}>{proposal.title}</Text>
            <Text style={styles.partyText}>
              Milestone: {invoice.milestone_label}
            </Text>
          </View>
        </View>

        {/* Amount Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{invoice.milestone_label}</Text>
          <Text style={styles.cardSubtitle}>
            Payment milestone for project: {proposal.title}
          </Text>
          <Text style={styles.cardAmount}>{formattedAmount}</Text>
        </View>

        {/* UPI QR Code Section */}
        {qrDataUrl && (
          <View style={styles.qrSection}>
            <Image src={qrDataUrl} style={styles.qrImage} />
            <View style={styles.qrInfo}>
              <Text style={styles.qrTitle}>Pay with Any UPI App</Text>
              <Text style={styles.qrText}>
                Scan with Google Pay, PhonePe, Paytm, or BHIM.
              </Text>
              <Text style={styles.qrText}>
                Receiving VPA: {profile.upi_id}
              </Text>
              <Text style={styles.qrText}>
                Amount: {formattedAmount}
              </Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Generated via ProposalFlow — Direct UPI payments with 0% processing fees.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
