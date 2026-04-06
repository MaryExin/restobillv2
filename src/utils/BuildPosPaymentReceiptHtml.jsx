import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const peso = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const signedNegativePeso = (value) => `- ${peso(value)}`;

export function BuildPosPaymentReceiptHtml({
  transaction,
  items = [],
  computed,
  payments = [],
  otherCharges = [],
  customerCards = [],
  isDuplicateCopy = false,
  terminalConfig = {},
  businessInfo = {},
}) {
  const yesNoToBool = (value) =>
    String(value || "")
      .trim()
      .toLowerCase() === "yes";

  const safeTransaction = transaction || {};
  const safeComputed = computed || {};
  const safeItems = Array.isArray(items) ? items : [];
  const safePayments = Array.isArray(payments) ? payments : [];
  const safeOtherCharges = Array.isArray(otherCharges) ? otherCharges : [];
  const safeCustomerCards = Array.isArray(customerCards) ? customerCards : [];

  const paymentLabel =
    safePayments.length > 0
      ? [
          ...new Set(
            safePayments
              .map((p) => String(p?.payment_method || "").trim())
              .filter(Boolean),
          ),
        ].join(", ")
      : safeTransaction?.payment_method || "Cash";

  const activeBreakdown = Array.isArray(safeComputed?.discountBreakdown)
    ? safeComputed.discountBreakdown.filter(
        (entry) =>
          Number(entry?.qualifiedCount || 0) > 0 ||
          Number(entry?.discountAmount || 0) > 0,
      )
    : [];

  // PAYMENT BREAKDOWN
  const paymentBreakdown = Array.isArray(safePayments)
    ? Object.entries(
        safePayments.reduce((acc, payment) => {
          const method =
            String(payment?.payment_method || "Cash").trim() || "Cash";
          const amount = Number(payment?.payment_amount || 0);

          if (!acc[method]) {
            acc[method] = 0;
          }

          acc[method] += amount;
          return acc;
        }, {}),
      ).map(([method, amount]) => ({
        method,
        amount,
      }))
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
    Number(safeComputed?.safeCustomerCount || 0) > 0 ||
    Number(
      safeComputed?.totalQualifiedCount || safeComputed?.totalQualifiedAll || 0,
    ) > 0 ||
    Number(safeComputed?.statutoryQualifiedCount || 0) > 0 ||
    activeBreakdown.length > 0;

  const MetaColGroup = () => (
    <colgroup>
      <col style={{ width: "32%" }} />
      <col style={{ width: "68%" }} />
    </colgroup>
  );

  const splitAddressLines = (value) =>
    String(value || "")
      .split(/\r?\n|\|/)
      .map((line) => line.trim())
      .filter(Boolean);

  const companyName = String(businessInfo?.companyName || "COMPANY").trim();
  const storeName = String(businessInfo?.storeName || "STORE").trim();
  const corpName = String(businessInfo?.corpName || "CORPORATION").trim();

  const storeAddress = splitAddressLines(
    businessInfo?.address || terminalConfig?.unitAddress || "ADDRESS",
  );

  const storeTin = String(
    businessInfo?.tin || terminalConfig?.vatTin || "STORE TIN",
  ).trim();

  const machineNumber = String(
    businessInfo?.machineNumber ||
      terminalConfig?.machineNumber ||
      "MACHINE NUMBER",
  ).trim();

  const serialNumber = String(
    businessInfo?.serialNumber ||
      terminalConfig?.serialNumber ||
      "SERIAL NUMBER",
  ).trim();

  const posProviderName = String(
    businessInfo?.posProviderName || "POS PROVIDER NAME",
  ).trim();

  const posProviderAddress = splitAddressLines(
    businessInfo?.posProviderAddress || "POS PROVIDER ADDRESS",
  );

  const posProviderTin = String(
    businessInfo?.posProviderTin || "POS PROVIDER TIN",
  ).trim();

  const posProviderBirAccreNo = String(
    businessInfo?.posProviderBirAccreNo || "POS PROVIDER ACCRE NO.",
  ).trim();

  const posProviderAccreDateIssued = String(
    businessInfo?.posProviderAccreDateIssued || "ACCRE DATE ISSUED",
  ).trim();

  const posProviderPTUNo = String(
    businessInfo?.posProviderPTUNo || "PTU No.",
  ).trim();

  const posProviderPTUDateIssued = String(
    businessInfo?.posProviderPTUDateIssued || "PTU DATE ISSUED",
  ).trim();

  const receipt = (
    <html>
      <head>
        <meta charSet="UTF-8" />
        <title>
          {safeTransaction?.transaction_id || "receipt"}-
          {isDuplicateCopy ? "duplicate-invoice" : "invoice"}
        </title>
        <style>{`
          :root {
            --s: 1;
          }

          * {
            box-sizing: border-box;
          }

          @page {
            margin: 0;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            width: 80mm;
            min-width: 80mm;
            background: #ffffff;
            color: #000000;
            font-family: Arial, Helvetica, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            overflow: visible;
          }

          body {
            overflow: visible;
          }

          .print-root {
            width: 76.5mm;
            padding: calc(8px * var(--s)) calc(18px * var(--s)) calc(20px * var(--s)) calc(1px * var(--s));
            font-size: calc(10.5px * var(--s));
            line-height: 1.18;
            margin: 0;
            background: #ffffff;
            color: #000000;
            overflow: visible;
          }

          .section {
            display: block;
            width: 100%;
          }

          .keep-together {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: calc(9.6px * var(--s));
          }

          thead {
            display: table-header-group;
          }

          tbody {
            display: table-row-group;
          }

          td,
          th {
            padding: 0;
            vertical-align: top;
            line-height: 1.1;
            page-break-inside: auto;
            break-inside: auto;
          }

          .center {
            text-align: center;
          }

          .right {
            text-align: right;
          }

          .left {
            text-align: left;
          }

          .bold {
            font-weight: 700;
          }

          .black {
            font-weight: 900;
          }

          .header-title {
            font-weight: 900;
            font-size: calc(15px * var(--s));
            line-height: 1.15;
          }

          .sub-title {
            font-weight: 700;
            font-size: calc(12px * var(--s));
            margin-top: calc(2px * var(--s));
          }

          .small {
            font-size: calc(10px * var(--s));
          }

          .invoice-title {
            text-align: center;
            font-weight: 900;
            font-size: calc(14px * var(--s));
            margin-bottom: calc(4px * var(--s));
          }

          .duplicate-copy {
            text-align: center;
            font-weight: 900;
            font-size: calc(11px * var(--s));
            margin-bottom: calc(8px * var(--s));
          }

          .divider {
            border-top: 1px solid #000;
            margin: calc(8px * var(--s)) 0 calc(7px * var(--s));
          }

          .divider-tight {
            border-top: 1px solid #000;
            margin: calc(8px * var(--s)) 0 calc(6px * var(--s));
          }

          .meta-table th,
          .meta-table td {
            font-size: calc(9.6px * var(--s));
          }

          .meta-table th {
            padding-bottom: calc(4px * var(--s));
          }

          .label-col {
            width: 38%;
            white-space: normal;
            word-break: break-word;
            overflow-wrap: anywhere;
            padding-right: calc(4px * var(--s));
          }

          .value-col {
            width: 62%;
            text-align: right;
            white-space: nowrap;
            overflow: visible;
            text-overflow: clip;
            padding-right: calc(12px * var(--s));
            padding-left: 0;
          }

          .item-table th,
          .item-table td {
            font-size: calc(9.6px * var(--s));
          }

          .item-table th {
            padding-bottom: calc(4px * var(--s));
          }

          .item-col {
            width: 44%;
            text-align: left;
            word-break: break-word;
            overflow-wrap: break-word;
            padding-right: calc(1px * var(--s));
            padding-left: 0;
          }

          .qty-col {
            width: 10%;
            text-align: center;
            white-space: nowrap;
            padding-right: 0;
            padding-left: 0;
          }

          .amt-col {
            width: 46%;
            text-align: right;
            white-space: nowrap;
            padding-right: calc(16px * var(--s));
            padding-left: 0;
          }

          .item-row td {
            padding-bottom: calc(1px * var(--s));
          }

          .amount-due-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-weight: 900;
            font-size: calc(16px * var(--s));
          }

          .amount-due-label-cell {
            text-align: left;
            white-space: nowrap;
          }

          .amount-due-value-cell {
            text-align: right;
            white-space: nowrap;
            padding-right: calc(16px * var(--s));
          }

          .customer-section-title {
            font-size: calc(10px * var(--s));
            font-weight: 700;
            margin-bottom: calc(4px * var(--s));
          }

          .thanks {
            text-align: center;
            font-size: calc(10px * var(--s));
          }

          .supplier-block {
            margin-top: calc(10px * var(--s));
            padding-bottom: calc(12px * var(--s));
            text-align: center;
            font-size: calc(10px * var(--s));
          }

          .supplier-block .bold {
            font-weight: 700;
          }
        `}</style>
      </head>
      <body>
        <div className="print-root">
          <div className="section keep-together center">
            <div className="header-title">{companyName}</div>
            <div className="sub-title">{String(storeName).toUpperCase()}</div>

            {corpName ? (
              <div className="sub-title">{String(corpName).toUpperCase()}</div>
            ) : null}

            {storeAddress.map((line, index) => (
              <div
                key={`address-${index}`}
                className="small"
                style={index === 0 ? { marginTop: "8px" } : undefined}
              >
                {line}
              </div>
            ))}

            {storeTin ? (
              <div className="small">VAT REG TIN: {storeTin}</div>
            ) : null}
            <div className="small">MIN: {machineNumber || "-"}</div>
            <div className="small">S/N: {serialNumber || "-"}</div>
          </div>

          <div className="divider" />

          <div className="section keep-together">
            <div className="invoice-title">INVOICE</div>

            {isDuplicateCopy ? (
              <div className="duplicate-copy">DUPLICATE INVOICE COPY</div>
            ) : null}
          </div>

          <div className="section">
            <table className="meta-table">
              <MetaColGroup />
              <tbody>
                <tr>
                  <td className="bold label-col">Trans. No.:</td>
                  <td className="value-col">
                    {safeTransaction?.transaction_id || "-"}
                  </td>
                </tr>
                <tr>
                  <td className="bold label-col">INV#:</td>
                  <td className="value-col">
                    {safeTransaction?.invoice_no || "-"}
                  </td>
                </tr>
                <tr>
                  <td className="bold label-col">Trans. Date:</td>
                  <td className="value-col">
                    {safeTransaction?.transaction_date || "-"}
                  </td>
                </tr>
                <tr>
                  <td className="bold label-col">Trans. Time:</td>
                  <td className="value-col">
                    {safeTransaction?.transaction_time || "-"}
                  </td>
                </tr>
                <tr>
                  <td className="bold label-col">Terminal No.:</td>
                  <td className="value-col">
                    {safeTransaction?.terminal_number ||
                      terminalConfig?.terminalNumber ||
                      "-"}
                  </td>
                </tr>
                <tr>
                  <td className="bold label-col">Order Type:</td>
                  <td className="value-col">
                    {safeTransaction?.order_type || "-"}
                  </td>
                </tr>
                <tr>
                  <td className="bold label-col">Ref./Tag #:</td>
                  <td className="value-col">
                    {safeTransaction?.table_number || "-"}
                  </td>
                </tr>
                <tr>
                  <td className="bold label-col">Cashier:</td>
                  <td className="value-col">
                    {safeTransaction?.cashier || "-"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="divider" />

          <div className="section">
            <table className="item-table">
              <thead>
                <tr>
                  <th className="item-col">Item</th>
                  <th className="qty-col">Qty</th>
                  <th className="amt-col">Amt</th>
                </tr>
              </thead>
              <tbody>
                {safeItems.map((item, index) => {
                  const qty = Number(item.sales_quantity || 0);
                  const price = Number(item.selling_price || 0);
                  const lineTotal = qty * price;

                  const isDiscountable = yesNoToBool(item.isDiscountable);
                  const itemLabel = String(
                    item.item_name || item.product_id || "-",
                  ).toUpperCase();

                  return (
                    <tr key={item.ID || index} className="item-row">
                      <td className="item-col">
                        • {itemLabel}
                        {isDiscountable ? " (D)" : ""}
                      </td>
                      <td className="qty-col">
                        {qty} {item.unit_of_measure || ""}
                      </td>
                      <td className="amt-col">
                        {peso(lineTotal)}
                        {item.vatable === "Yes" ? "V" : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="divider" />

          <div className="section">
            <table className="meta-table">
              <MetaColGroup />
              <tbody>
                <tr>
                  <td className="bold label-col">TOTAL SALES:</td>
                  <td className="value-col">
                    {peso(safeComputed?.grossTotal)}
                  </td>
                </tr>

                {activeBreakdown.map((entry) =>
                  Number(entry?.discountAmount || 0) > 0 ? (
                    <tr key={entry.key}>
                      <td className="bold label-col">
                        {String(entry?.label || "DISCOUNT").toUpperCase()}:
                      </td>
                      <td className="value-col">
                        {signedNegativePeso(entry?.discountAmount)}
                      </td>
                    </tr>
                  ) : null,
                )}

                {Number(safeComputed?.totalVatExemption || 0) > 0 ? (
                  <tr>
                    <td className="bold label-col">VAT EXEMPTION:</td>
                    <td className="value-col">
                      {signedNegativePeso(safeComputed?.totalVatExemption)}
                    </td>
                  </tr>
                ) : null}

                {safeOtherCharges.map((charge, index) => (
                  <tr key={`${charge.particulars}-${index}`}>
                    <td className="bold label-col">
                      {String(
                        charge.particulars || "OTHER CHARGE",
                      ).toUpperCase()}
                      :
                    </td>
                    <td className="value-col">{peso(charge.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divider-tight" />

          <div className="section keep-together">
            <table className="amount-due-table">
              <tbody>
                <tr>
                  <td className="amount-due-label-cell">AMOUNT DUE:</td>
                  <td className="amount-due-value-cell">
                    {peso(safeComputed?.totalAmountDue)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="divider-tight" />

          <div className="section">
            <table className="meta-table">
              <MetaColGroup />
              <tbody>
                {paymentBreakdown.length > 0 ? (
                  <>
                    <tr>
                      <td className="bold label-col">PAYMENT:</td>
                      <td className="value-col"></td>
                    </tr>

                    {paymentBreakdown.map((payment, index) => (
                      <tr key={`${payment.method}-${index}`}>
                        <td className="label-col">
                          {index === paymentBreakdown.length - 1
                            ? `(${payment.method}):`
                            : `${payment.method}:`}
                        </td>
                        <td className="value-col">{peso(payment.amount)}</td>
                      </tr>
                    ))}

                    <tr>
                      <td className="bold label-col">TOTAL PAYMENT:</td>
                      <td className="value-col">
                        {peso(safeComputed?.totalPaid)}
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td className="bold label-col">
                      PAYMENT ({paymentLabel}):
                    </td>
                    <td className="value-col">
                      {peso(safeComputed?.totalPaid)}
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="bold label-col">CHANGE:</td>
                  <td className="value-col">
                    {peso(safeComputed?.changeAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="divider-tight" />

          <div className="section">
            <table className="meta-table">
              <MetaColGroup />
              <tbody>
                <tr>
                  <td className="bold label-col">VATABLE SALES:</td>
                  <td className="value-col">
                    {peso(safeComputed?.vatableSales)}
                  </td>
                </tr>
                <tr>
                  <td className="bold label-col">VAT AMOUNT:</td>
                  <td className="value-col">
                    {peso(safeComputed?.vatableSalesVat)}
                  </td>
                </tr>
                <tr>
                  <td className="bold label-col">VAT EXEMPT SALES:</td>
                  <td className="value-col">
                    {peso(safeComputed?.vatExemptSales)}
                  </td>
                </tr>
                <tr>
                  <td className="bold label-col">VAT EXEMPTION:</td>
                  <td className="value-col">
                    {peso(safeComputed?.totalVatExemption)}
                  </td>
                </tr>
                <tr>
                  <td className="bold label-col">ZERO RATED SALES:</td>
                  <td className="value-col">
                    {peso(safeComputed?.vatZeroRatedSales)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {shouldShowDiscountSummary ? (
            <>
              <div className="divider" />
              <div className="section">
                <table className="meta-table">
                  <MetaColGroup />
                  <tbody>
                    <tr>
                      <td className="bold label-col">Total Customers:</td>
                      <td className="value-col">
                        {Number(safeComputed?.safeCustomerCount || 0)}
                      </td>
                    </tr>

                    <tr>
                      <td className="bold label-col">Total Qualified:</td>
                      <td className="value-col">
                        {Number(
                          safeComputed?.totalQualifiedCount ||
                            safeComputed?.totalQualifiedAll ||
                            0,
                        )}
                      </td>
                    </tr>

                    {activeBreakdown.map((entry) => (
                      <React.Fragment key={`summary-${entry.key}`}>
                        <tr>
                          <td className="bold label-col">
                            {getDiscountCountLabel(entry)}
                          </td>
                          <td className="value-col">
                            {Number(entry?.qualifiedCount || 0)}
                          </td>
                        </tr>

                        <tr>
                          <td className="bold label-col">
                            {getDiscountAmountLabel(entry)}
                          </td>
                          <td className="value-col">
                            {peso(entry?.discountAmount)}
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}

                    <tr>
                      <td className="bold label-col">Discountable Gross:</td>
                      <td className="value-col">
                        {peso(safeComputed?.discountableGross)}
                      </td>
                    </tr>

                    <tr>
                      <td className="bold label-col">Discountable Base:</td>
                      <td className="value-col">
                        {peso(safeComputed?.discountableBase)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {safeCustomerCards.length > 0 ? (
            <>
              <div className="divider" />

              <div className="section keep-together">
                <div className="customer-section-title">
                  DISCOUNT CUSTOMER DETAILS
                </div>
              </div>

              <div className="section">
                {safeCustomerCards.map((card, index) => (
                  <table
                    key={index}
                    className="meta-table"
                    style={{ marginBottom: "6px" }}
                  >
                    <MetaColGroup />
                    <tbody>
                      <tr>
                        <td className="label-col bold">Name:</td>
                        <td className="value-col">
                          {card.customer_name || ""}
                        </td>
                      </tr>
                      <tr>
                        <td className="label-col bold">ID:</td>
                        <td className="value-col">
                          {card.customer_exclusive_id || ""}
                        </td>
                      </tr>
                      <tr>
                        <td className="label-col bold">Signature:</td>
                        <td className="value-col"></td>
                      </tr>
                    </tbody>
                  </table>
                ))}
              </div>
            </>
          ) : null}

          <div className="divider" />

          <div className="section keep-together thanks">
            <div className="bold">Thank you</div>
            <div className="bold">Please come again.</div>
          </div>

          <div className="section keep-together supplier-block">
            {posProviderName ? (
              <div className="bold">SUPPLIER: {posProviderName}</div>
            ) : null}
            {posProviderAddress.map((line, index) => (
              <div key={`supplier-${index}`}>{line}</div>
            ))}
            {posProviderTin ? <div>TIN: {posProviderTin}</div> : null}
            {posProviderBirAccreNo ? (
              <div>BIR ACC#: {posProviderBirAccreNo}</div>
            ) : null}
            {posProviderAccreDateIssued ? (
              <div>DATE ISSUED: {posProviderAccreDateIssued}</div>
            ) : null}
            {posProviderPTUNo ? <div>PTU: {posProviderPTUNo}</div> : null}
            {posProviderPTUDateIssued ? (
              <div>PTU DATE ISSUED: {posProviderPTUDateIssued}</div>
            ) : null}
          </div>
        </div>
      </body>
    </html>
  );

  return "<!DOCTYPE html>" + renderToStaticMarkup(receipt);
}

export default BuildPosPaymentReceiptHtml;
