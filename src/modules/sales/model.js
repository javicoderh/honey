import { createPeriod } from "../../shared/businessDates.js";
import { money } from "../../shared/domain.js";

export function resolveSalesPeriod({ type, date, month, endDate }) {
  if (type === "month" && !/^\d{4}-\d{2}$/.test(month ?? "")) throw new Error("Elige un mes válido.");
  return createPeriod({ type, date: type === "month" ? `${month}-01` : date, endDate });
}

// Los reembolsos se agrupan por aprobación de la venta original, no por fecha de devolución.
export function summarizeSales(sales) {
  return sales.reduce((summary, sale) => {
    if (sale.payment.status === "refunded") {
      summary.refundedCount++;
      summary.refundedTotal = money(summary.refundedTotal + sale.totalPaid);
    } else if (sale.payment.status === "approved") {
      summary.approvedCount++;
      summary.approvedTotal = money(summary.approvedTotal + sale.totalPaid);
    }
    return summary;
  }, { approvedCount: 0, approvedTotal: 0, refundedCount: 0, refundedTotal: 0 });
}
