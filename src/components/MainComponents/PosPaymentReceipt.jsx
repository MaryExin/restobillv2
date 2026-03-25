import React, { useEffect, useState } from "react";

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
      apiHost = "",
      categoryCode = "",
      unitCode = "",
      terminalNumber = "",
      corpName = "",
    },
    ref,
  ) => {
    const [terminalConfig, setTerminalConfig] = useState({
      categoryCode: categoryCode || transaction?.Category_Code || "",
      unitCode: unitCode || transaction?.Unit_Code || "",
      businessUnitName: "",
      terminalNumber: terminalNumber || transaction?.terminal_number || "1",
      corpName: corpName || transaction?.corp_name || "",
      machineNumber: "",
      serialNumber: "",
      ptuNumber: "",
      ptuDateIssued: "",
    });

    useEffect(() => {
      if (!apiHost) return;

      let isMounted = true;

      const loadTerminalConfig = async () => {
        try {
          const params = new URLSearchParams({
            unitCode: unitCode || transaction?.Unit_Code || "",
            terminalNumber:
              terminalNumber || transaction?.terminal_number || "1",
            categoryCode: categoryCode || transaction?.Category_Code || "",
          });

          const response = await fetch(
            `${apiHost}/api/read_pos_terminal_config.php?${params.toString()}`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            },
          );

          const result = await response.json();

          if (!isMounted) return;

          if (!response.ok || !result.success) {
            throw new Error(
              result?.message || "Failed to load POS terminal configuration.",
            );
          }

          const cfg = result.data || {};

          setTerminalConfig({
            categoryCode: String(
              cfg.categoryCode ??
                categoryCode ??
                transaction?.Category_Code ??
                "",
            ),
            unitCode: String(
              cfg.unitCode ?? unitCode ?? transaction?.Unit_Code ?? "",
            ),
            businessUnitName: String(cfg.businessUnitName ?? ""),
            terminalNumber: String(
              cfg.terminalNumber ??
                terminalNumber ??
                transaction?.terminal_number ??
                "1",
            ),
            corpName: String(
              cfg.corpName ?? corpName ?? transaction?.corp_name ?? "",
            ),
            machineNumber: String(cfg.machineNumber ?? ""),
            serialNumber: String(cfg.serialNumber ?? ""),
            ptuNumber: String(cfg.ptuNumber ?? ""),
            ptuDateIssued: String(cfg.ptuDateIssued ?? ""),
          });
        } catch (error) {
          if (!isMounted) return;

          setTerminalConfig((prev) => ({
            ...prev,
            categoryCode:
              categoryCode || transaction?.Category_Code || prev.categoryCode,
            unitCode: unitCode || transaction?.Unit_Code || prev.unitCode,
            terminalNumber:
              terminalNumber ||
              transaction?.terminal_number ||
              prev.terminalNumber,
            corpName: corpName || transaction?.corp_name || prev.corpName,
          }));
        }
      };

      loadTerminalConfig();

      return () => {
        isMounted = false;
      };
    }, [
      apiHost,
      categoryCode,
      unitCode,
      terminalNumber,
      corpName,
      transaction?.Category_Code,
      transaction?.Unit_Code,
      transaction?.terminal_number,
      transaction?.corp_name,
    ]);

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

    const getDiscountCountLabel = (entry) => {
      if (entry?.key === "senior") return "Senior Citizen Discount Count:";
      if (entry?.key === "pwd") return "PWD Discount Count:";
      if (entry?.key === "manual") return "Manual Discount Count:";
      return `${entry?.label || "Discount"} Count:`;
    };

    const getDiscountAmountLabel = (entry) => {
      if (entry?.key === "senior") return "Senior Citizen Discount Amount:";
      if (entry?.key === "pwd") return "PWD Discount Amount:";
      if (entry?.key === "manual") return "Manual Discount Amount:";
      return `${entry?.label || "Discount"} Amount:`;
    };

    const shouldShowDiscountSummary =
      Number(computed?.safeCustomerCount || 0) > 0 ||
      Number(
        computed?.totalQualifiedCount || computed?.totalQualifiedAll || 0,
      ) > 0 ||
      Number(computed?.statutoryQualifiedCount || 0) > 0 ||
      activeBreakdown.length > 0;

    return (
      <div
        ref={ref}
        className="print-root"
        style={{
          width: "80mm",
          minHeight: "100vh",
          background: "#ffffff",
          color: "#000000",
          padding: "14px 29px",
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
            {String(
              terminalConfig.corpName || "CRABS N CRACK SEAFOOD HOUSE",
            ).toUpperCase()}
          </div>

          <div
            style={{ fontWeight: "700", fontSize: "12px", marginTop: "2px" }}
          >
            {terminalConfig.businessUnitName ||
              "AND SHAKING CRABS - STA. MARIA"}
          </div>

          <div style={{ fontWeight: "700", fontSize: "12px" }}>
            ARU FOOD CORP.
          </div>

          <div style={{ marginTop: "8px", fontSize: "10px" }}>
            BYPASS ROAD TABING BAKOD P. STA MARIA
          </div>
          <div style={{ fontSize: "10px" }}>BULACAN</div>
          <div style={{ fontSize: "10px" }}>VAT REG TIN: 634-742-586-00012</div>

          <div style={{ fontSize: "10px" }}>
            MIN: {terminalConfig.machineNumber || "-"}
          </div>
          <div style={{ fontSize: "10px" }}>
            S/N: {terminalConfig.serialNumber || "-"}
          </div>
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
                {transaction?.terminal_number ||
                  terminalConfig.terminalNumber ||
                  "-"}
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
                VAT EXEMPTION:
              </td>
              <td style={{ textAlign: "right", padding: "1px 0" }}>
                {peso(computed?.totalVatExemption)}
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

        {shouldShowDiscountSummary ? (
          <>
            <div
              style={{ borderTop: "1px solid #000", margin: "10px 0 8px" }}
            />

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
                    Total Customers:
                  </td>
                  <td style={{ textAlign: "right", padding: "1px 0" }}>
                    {Number(computed?.safeCustomerCount || 0)}
                  </td>
                </tr>

                <tr>
                  <td style={{ fontWeight: "700", padding: "1px 0" }}>
                    Total Qualified:
                  </td>
                  <td style={{ textAlign: "right", padding: "1px 0" }}>
                    {Number(
                      computed?.totalQualifiedCount ||
                        computed?.totalQualifiedAll ||
                        0,
                    )}
                  </td>
                </tr>

                {/* <tr>
                  <td style={{ fontWeight: "700", padding: "1px 0" }}>
                    Statutory Qualified:
                  </td>
                  <td style={{ textAlign: "right", padding: "1px 0" }}>
                    {Number(computed?.statutoryQualifiedCount || 0)}
                  </td>
                </tr> */}

                {activeBreakdown.map((entry) => (
                  <React.Fragment key={`summary-${entry.key}`}>
                    <tr>
                      <td style={{ fontWeight: "700", padding: "1px 0" }}>
                        {getDiscountCountLabel(entry)}
                      </td>
                      <td style={{ textAlign: "right", padding: "1px 0" }}>
                        {Number(entry?.qualifiedCount || 0)}
                      </td>
                    </tr>

                    <tr>
                      <td style={{ fontWeight: "700", padding: "1px 0" }}>
                        {getDiscountAmountLabel(entry)}
                      </td>
                      <td style={{ textAlign: "right", padding: "1px 0" }}>
                        {peso(entry?.discountAmount)}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}

                <tr>
                  <td style={{ fontWeight: "700", padding: "1px 0" }}>
                    Discountable Gross:
                  </td>
                  <td style={{ textAlign: "right", padding: "1px 0" }}>
                    {peso(computed?.discountableGross)}
                  </td>
                </tr>

                <tr>
                  <td style={{ fontWeight: "700", padding: "1px 0" }}>
                    Discountable Base:
                  </td>
                  <td style={{ textAlign: "right", padding: "1px 0" }}>
                    {peso(computed?.discountableBase)}
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        ) : null}

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
                    <td style={{ padding: "1px 0" }}>
                      {card.customer_name || ""}
                    </td>
                  </tr>

                  <tr>
                    <td style={{ fontWeight: "700", padding: "1px 0" }}>
                      Name:
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
                      Signature:
                    </td>
                    <td style={{ padding: "1px 0" }}></td>
                  </tr>
                </tbody>
              </table>
            ))}
          </>
        ) : null}

        {/* <div style={{ marginTop: "12px", fontSize: "10px" }}>
          <div style={{ fontWeight: "700" }}>Customer Signature:</div>
          <div
            style={{
              borderBottom: "1px solid #000",
              height: "18px",
              marginTop: "3px",
            }}
          />
        </div> */}

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
          <div>PTU: {terminalConfig.ptuNumber}</div>
          <div>DATE ISSUED: {terminalConfig.ptuDateIssued}</div>
        </div>
      </div>
    );
  },
);

export default PosPaymentReceipt;
