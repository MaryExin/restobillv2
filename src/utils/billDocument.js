// Name of the pre-payment document. Room Service orders go on the guest's
// stay, so they print as a GUEST FOLIO; every other sales type prints a BILL.
// Display text only: the API still receives printTitle "BILLING" (numbering).

export const BILL_FOLIO_LABEL = "Bill / Folio";

export const isFolioSalesType = (salesType) =>
  String(salesType ?? "").trim().toUpperCase() === "ROOM SERVICE";

export function getBillDocument(salesType) {
  const folio = isFolioSalesType(salesType);
  return {
    folio,
    title: folio ? "GUEST FOLIO" : "BILL",
    noun: folio ? "Folio" : "Bill",
    numberLabel: folio ? "Folio No." : "Bill No.",
  };
}
