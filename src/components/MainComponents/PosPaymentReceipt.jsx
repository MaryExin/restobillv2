import React from "react";

const peso = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const signedNegativePeso = (value) => `- ${peso(value)}`;

const PosPaymentReceipt = React.forwardRef(
  (
    {
      transaction,
      items = [],
      computed,
      payments = [],
      otherCharges = [],
      customerCards = [],
      isDuplicateCopy = false,
    },
    ref,
  ) => {
    const paymentLabel =
      payments.length > 0
        ? [
            ...new Set(payments.map((p) => p.payment_method).filter(Boolean)),
          ].join(", ")
        : transaction?.payment_method || "Cash";

    const activeBreakdown = Array.isArray(computed?.discountBreakdown)
      ? computed.discountBreakdown.filter(
          (entry) =>
            Number(entry?.qualifiedCount || 0) > 0 ||
            Number(entry?.discountAmount || 0) > 0,
        )
      : [];

    return (
      <div
        ref={ref}
        className="print-root"
        style={{
          width: "80mm",
          minHeight: "100vh",
          background: "#ffffff",
          color: "#000000",
          padding: "14px 5px",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "11px",
          lineHeight: 1.25,
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{ fontWeight: "900", fontSize: "15px", lineHeight: 1.15 }}
          >
            {String("CRABS N CRACK SEAFOOD HOUSE").toUpperCase()}
          </div>
          <div
            style={{ fontWeight: "700", fontSize: "12px", marginTop: "2px" }}
          >
            AND SHAKING CRABS - STA. MARIA
          </div>
          <div style={{ fontWeight: "700", fontSize: "12px" }}>
            ARU FOOD CORP.
          </div>

          <div style={{ marginTop: "8px", fontSize: "10px" }}>
            BYPASS ROAD TABING BAKOD P. STA MARIA
          </div>
          <div style={{ fontSize: "10px" }}>BULACAN</div>
          <div style={{ fontSize: "10px" }}>VAT REG TIN: 634-742-586-00012</div>
          <div style={{ fontSize: "10px" }}>MIN:</div>
          <div style={{ fontSize: "10px" }}>S/N:</div>
        </div>

        <div style={{ borderTop: "1px solid #000", margin: "10px 0 8px" }} />

        <div
          style={{
            textAlign: "center",
            fontWeight: "900",
            fontSize: "14px",
            marginBottom: "4px",
          }}
        >
          INVOICE
        </div>

        {isDuplicateCopy ? (
          <div
            style={{
              textAlign: "center",
              fontWeight: "900",
              fontSize: "11px",
              marginBottom: "8px",
            }}
          >
            DUPLICATE INVOICE COPY
          </div>
        ) : null}

        <table
          style={{
            width: "100%",
            fontSize: "10px",
            borderCollapse: "collapse",
          }}
        >
          <tbody>
            <tr>
              <td style={{ fontWeight: "700", padding: "1px 0" }}>
                Trans. No.:
              </td>
              <td style={{ textAlign: "right", padding: "1px 0" }}>
                {transaction?.transaction_id || "-"}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: "700", padding: "1px 0" }}>INV#:</td>
              <td style={{ textAlign: "right", padding: "1px 0" }}>
                {transaction?.invoice_no || "-"}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: "700", padding: "1px 0" }}>
                Trans. Date:
              </td>
              <td style={{ textAlign: "right", padding: "1px 0" }}>
                {transaction?.transaction_date || "-"}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: "700", padding: "1px 0" }}>
                Trans. Time:
              </td>
              <td style={{ textAlign: "right", padding: "1px 0" }}>
                {transaction?.transaction_time || "-"}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: "700", padding: "1px 0" }}>
                Terminal No.:
              </td>
              <td style={{ textAlign: "right", padding: "1px 0" }}>
                {transaction?.terminal_number || "-"}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: "700", padding: "1px 0" }}>
                Order Type:
              </td>
              <td style={{ textAlign: "right", padding: "1px 0" }}>
                {transaction?.order_type || "-"}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: "700", padding: "1px 0" }}>
                Ref./Tag #:
              </td>
              <td style={{ textAlign: "right", padding: "1px 0" }}>
                {transaction?.table_number || "-"}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: "700", padding: "1px 0" }}>Cashier:</td>
              <td style={{ textAlign: "right", padding: "1px 0" }}>
                {transaction?.cashier || "-"}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ borderTop: "1px solid #000", margin: "10px 0 6px" }} />

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "10px",
          }}
        >
          <thead>
            <tr>
              <th style={{ textAlign: "left", paddingBottom: "4px" }}>Item</th>
              <th style={{ textAlign: "center", paddingBottom: "4px" }}>Qty</th>
              <th style={{ textAlign: "right", paddingBottom: "4px" }}>Amt</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const qty = Number(item.sales_quantity || 0);
              const price = Number(item.selling_price || 0);
              const lineTotal = qty * price;

              return (
                <tr key={item.ID || index}>
                  <td style={{ padding: "2px 0", verticalAlign: "top" }}>
                    •{" "}
                    {String(
                      item.item_name || item.product_id || "-",
                    ).toUpperCase()}
                  </td>
                  <td
                    style={{
                      textAlign: "center",
                      padding: "2px 0",
                      verticalAlign: "top",
                    }}
                  >
                    {qty} {item.unit_of_measure || ""}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "2px 0",
                      verticalAlign: "top",
                    }}
                  >
                    {peso(lineTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ borderTop: "1px solid #000", margin: "10px 0 6px" }} />

        <table
          style={{
            width: "100%",
            fontSize: "10px",
            borderCollapse: "collapse",
          }}
        >
          <tbody>
            <tr>
              <td style={{ fontWeight: "700", padding: "1px 0" }}>
                TOTAL SALES:
              </td>
              <td style={{ textAlign: "right", padding: "1px 0" }}>
                {peso(computed?.grossTotal)}
              </td>
            </tr>

            {activeBreakdown.map((entry) =>
              Number(entry?.discountAmount || 0) > 0 ? (
                <tr key={entry.key}>
                  <td style={{ fontWeight: "700", padding: "1px 0" }}>
                    {String(entry?.label || "DISCOUNT").toUpperCase()}:
                  </td>
                  <td style={{ textAlign: "right", padding: "1px 0" }}>
                    {signedNegativePeso(entry?.discountAmount)}
                  </td>
                </tr>
              ) : null,
            )}

            {Number(computed?.totalVatExemption || 0) > 0 ? (
              <tr>
                <td style={{ fontWeight: "700", padding: "1px 0" }}>
                  VAT EXEMPTION:
                </td>
                <td style={{ textAlign: "right", padding: "1px 0" }}>
                  {signedNegativePeso(computed?.totalVatExemption)}
                </td>
              </tr>
            ) : null}

            {otherCharges.map((charge, index) => (
              <tr key={`${charge.particulars}-${index}`}>
                <td style={{ fontWeight: "700", padding: "1px 0" }}>
                  {String(charge.particulars || "OTHER CHARGE").toUpperCase()}:
                </td>
                <td style={{ textAlign: "right", padding: "1px 0" }}>
                  {peso(charge.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ borderTop: "1px solid #000", margin: "8px 0 6px" }} />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            fontWeight: "900",
            fontSize: "14px",
            marginBottom: "8px",
          }}
        >
          <span>AMOUNT DUE:</span>
          <span>{peso(computed?.totalAmountDue)}</span>
        </div>

        <table
          style={{
            width: "100%",
            fontSize: "10px",
            borderCollapse: "collapse",
          }}
        >
          <tbody>
            <tr>
              <td style={{ fontWeight: "700", padding: "1px 0" }}>
                PAYMENT ({paymentLabel}):
              </td>
              <td style={{ textAlign: "right", padding: "1px 0" }}>
                {peso(computed?.totalPaid)}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: "700", padding: "1px 0" }}>CHANGE:</td>
              <td style={{ textAlign: "right", padding: "1px 0" }}>
                {peso(computed?.changeAmount)}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ borderTop: "1px solid #000", margin: "8px 0 6px" }} />

        <table
          style={{
            width: "100%",
            fontSize: "10px",
            borderCollapse: "collapse",
          }}
        >
          <tbody>
            <tr>
              <td style={{ fontWeight: "700", padding: "1px 0" }}>
                VATABLE SALES:
              </td>
              <td style={{ textAlign: "right", padding: "1px 0" }}>
                {peso(computed?.vatableSales)}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: "700", padding: "1px 0" }}>
                VAT AMOUNT:
              </td>
              <td style={{ textAlign: "right", padding: "1px 0" }}>
                {peso(computed?.vatableSalesVat)}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: "700", padding: "1px 0" }}>
                VAT EXEMPT SALES:
              </td>
              <td style={{ textAlign: "right", padding: "1px 0" }}>
                {peso(computed?.vatExemptSales)}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: "700", padding: "1px 0" }}>
                ZERO RATED SALES:
              </td>
              <td style={{ textAlign: "right", padding: "1px 0" }}>
                {peso(computed?.vatZeroRatedSales)}
              </td>
            </tr>
          </tbody>
        </table>

        {customerCards.length > 0 ? (
          <>
            <div
              style={{ borderTop: "1px solid #000", margin: "10px 0 8px" }}
            />

            <div
              style={{
                fontSize: "10px",
                fontWeight: "700",
                marginBottom: "4px",
              }}
            >
              DISCOUNT CUSTOMER DETAILS
            </div>

            {customerCards.map((card, index) => (
              <table
                key={index}
                style={{
                  width: "100%",
                  fontSize: "10px",
                  borderCollapse: "collapse",
                  marginBottom: "6px",
                }}
              >
                <tbody>
                  <tr>
                    <td style={{ fontWeight: "700", padding: "1px 0" }}>
                      Customer #{index + 1}:
                    </td>
                    <td style={{ padding: "1px 0" }}>
                      {card.customer_name || ""}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: "700", padding: "1px 0" }}>ID:</td>
                    <td style={{ padding: "1px 0" }}>
                      {card.customer_exclusive_id || ""}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: "700", padding: "1px 0" }}>
                      Birthdate:
                    </td>
                    <td style={{ padding: "1px 0" }}>
                      {card.date_of_birth || ""}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: "700", padding: "1px 0" }}>
                      Gender:
                    </td>
                    <td style={{ padding: "1px 0" }}>{card.gender || ""}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: "700", padding: "1px 0" }}>
                      TIN:
                    </td>
                    <td style={{ padding: "1px 0" }}>{card.tin || ""}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: "700", padding: "1px 0" }}>
                      Contact:
                    </td>
                    <td style={{ padding: "1px 0" }}>
                      {card.contact_no || ""}
                    </td>
                  </tr>
                </tbody>
              </table>
            ))}
          </>
        ) : null}

        <div style={{ marginTop: "12px", fontSize: "10px" }}>
          <div style={{ fontWeight: "700" }}>Customer Signature:</div>
          <div
            style={{
              borderBottom: "1px solid #000",
              height: "18px",
              marginTop: "3px",
            }}
          />
        </div>

        <div style={{ borderTop: "1px solid #000", margin: "10px 0 8px" }} />

        <div style={{ textAlign: "center", fontSize: "10px" }}>
          <div style={{ fontWeight: "700" }}>Thank you</div>
          <div style={{ fontWeight: "700" }}>Please come again.</div>
        </div>

        <div
          style={{ marginTop: "10px", textAlign: "center", fontSize: "10px" }}
        >
          <div style={{ fontWeight: "700" }}>
            SUPPLIER: LIGHTEM SOLUTIONS INCORPORATED
          </div>
          <div>1187, PARULAN, PLARIDEL</div>
          <div>BULACAN, PHILIPPINES</div>
          <div>TIN: 626717559-000</div>
          <div>BIR ACC#: 25A6267175592023091853</div>
          <div>DATE ISSUED: 12/04/2023</div>
          <div>PTU: FP02204-067-0432508-00003</div>
        </div>
      </div>
    );
  },
);

export default PosPaymentReceipt;
