const money = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const commonPrintStyles = `
  <style>
    :root {
      --s: 1;
    }

    * {
      box-sizing: border-box;
    }

    @page {
      size: 80mm auto;
      margin: 0;
    }

    html, body {
      margin: 0;
      padding: 0;
      width: 80mm;
      background: #fff;
      color: #000;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      overflow: hidden;
    }

    .receipt {
      width: 76.5mm;
      padding: calc(8px * var(--s)) calc(16px * var(--s)) calc(8px * var(--s)) calc(1px * var(--s));
      font-size: calc(10.5px * var(--s));
      line-height: 1.18;
      margin: 0;
      box-sizing: border-box;
    }

    .center { text-align: center; }

    .title {
      font-weight: 900;
      font-size: calc(15px * var(--s));
      line-height: 1.15;
      word-break: break-word;
      overflow-wrap: break-word;
    }

    .subtitle {
      font-size: calc(10px * var(--s));
      line-height: 1.3;
      word-break: break-word;
      overflow-wrap: break-word;
    }

    .line {
      border-top: 1px solid #000;
      margin: calc(8px * var(--s)) 0 calc(7px * var(--s));
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: calc(9.6px * var(--s));
    }

    td, th {
      padding: 0;
      vertical-align: top;
      line-height: 1.1;
    }

    .label {
      width: 32%;
      white-space: nowrap;
      padding-right: 0;
      text-align: left;
    }

    .value {
      width: 68%;
      text-align: right;
      white-space: nowrap;
      overflow: visible;
      padding-right: calc(16px * var(--s));
      padding-left: 0;
    }

    .strong {
      font-weight: 700;
    }
  </style>
`;

export const buildXPrintHtml = (data) => {
  const otherPaymentsBreakdown = Array.isArray(data?.otherPaymentsBreakdown)
    ? data.otherPaymentsBreakdown
    : Array.isArray(data?.paymentBreakdown)
      ? data.paymentBreakdown
      : [];

  const otherPaymentsRows =
    otherPaymentsBreakdown.length > 0
      ? otherPaymentsBreakdown
          .map(
            (item) => `
            <tr>
              <td class="label sublabel">- ${item?.payment_method || "Other"}</td>
              <td class="value subvalue">${money(item?.payment_amount || 0)}</td>
            </tr>
          `,
          )
          .join("")
      : `
        <tr>
          <td class="label sublabel">- None</td>
          <td class="value subvalue">${money(0)}</td>
        </tr>
      `;

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>X Reading</title>
      ${commonPrintStyles}
    <style>
      .sublabel {
        padding-left: calc(14px * var(--s));
        font-size: calc(9.6px * var(--s));
      }

      .subvalue {
        font-size: calc(9.6px * var(--s));
        text-align: right;
        white-space: nowrap;
        padding-right: calc(14px * var(--s));
      }
    </style>
    </head>
    <body>
      <div class="receipt">
        <div class="center">
          <div class="title">${data.companyName || ""}</div>
          <div class="subtitle">${data.storeName || ""}</div>
          <div class="subtitle">${data.corpName || ""}</div>
          <div class="subtitle">${data.address || ""}</div>
          <div class="subtitle">TIN: ${data.tin || ""}</div>
          <div class="subtitle">MIN: ${data.machineNumber || ""}</div>
          <div class="subtitle">S/N: ${data.serialNumber || ""}</div>
          <div class="title" style="margin-top:8px;">X-READING</div>
        </div>

        <div class="line"></div>
        <table>
          <tr><td class="label">Report Date</td><td class="value">${data.reportDate || ""}</td></tr>
          <tr><td class="label">Report Time</td><td class="value">${data.reportTime || ""}</td></tr>
          <tr><td class="label">Start Date/Time</td><td class="value">${data.startDateTime || ""}</td></tr>
          <tr><td class="label">End Date/Time</td><td class="value">${data.endDateTime || ""}</td></tr>
          <tr><td class="label">Cashier</td><td class="value">${data.cashier || ""}</td></tr>
          <tr><td class="label">Beg. INV.</td><td class="value">${data.begOR || ""}</td></tr>
          <tr><td class="label">End INV.</td><td class="value">${data.endOR || ""}</td></tr>
        </table>

        <div class="line"></div>
        <div class="strong">PAYMENTS</div>
        <table>
          <tr><td class="label">Opening Fund</td><td class="value">${money(data.openingFund)}</td></tr>
          <tr><td class="label">Cash</td><td class="value">${money(data.cash)}</td></tr>
          <tr><td class="label">Cheque</td><td class="value">${money(data.cheque)}</td></tr>
          <tr><td class="label">Credit Card</td><td class="value">${money(data.creditCard)}</td></tr>
          <tr><td class="label">Other Payments</td><td class="value">${money(data.otherPaymentsTotal ?? data.otherPayments)}</td></tr>
          ${otherPaymentsRows}
          <tr><td class="label strong">Total Payments</td><td class="value strong">${money(data.totalPayments)}</td></tr>
          <tr><td class="label">Void</td><td class="value">${money(data.void)}</td></tr>
          <tr><td class="label">Refund</td><td class="value">${money(data.refund)}</td></tr>
          <tr><td class="label">Withdrawal</td><td class="value">${money(data.withdrawal)}</td></tr>
        </table>

        <div class="line"></div>
        <div class="strong">SUMMARY</div>
        <table>
          <tr><td class="label">Cash In Drawer</td><td class="value">${money(data.summaryCashInDrawer)}</td></tr>
          <tr><td class="label">Cheque</td><td class="value">${money(data.summaryCheque)}</td></tr>
          <tr><td class="label">Credit Card</td><td class="value">${money(data.summaryCreditCard)}</td></tr>
          <tr><td class="label">Other Payments</td><td class="value">${money(data.summaryOtherPayments)}</td></tr>
          <tr><td class="label">Opening Fund</td><td class="value">${money(data.summaryOpeningFund)}</td></tr>
          <tr><td class="label">Withdrawal</td><td class="value">${money(data.summaryWithdrawal)}</td></tr>
          <tr><td class="label">Payments Received</td><td class="value">${money(data.summaryPaymentsReceived)}</td></tr>
          <tr><td class="label strong">Short / Over</td><td class="value strong">${money(data.summaryShortOver)}</td></tr>
        </table>
      </div>
    </body>
  </html>
`;
};

export const buildZPrintHtml = (data) => {
  const vatExemptionValue =
    data.vatExemption ?? data.lessVatExemption ?? data.vatExemptVat ?? 0;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Z Reading</title>
        ${commonPrintStyles}
      </head>
      <body>
        <div class="receipt">
          <div class="center">
            <div class="title">${data.companyName || ""}</div>
            <div class="subtitle">${data.storeName || ""}</div>
            <div class="subtitle">${data.corpName || ""}</div>
            <div class="subtitle">${data.address || ""}</div>
            <div class="subtitle">TIN: ${data.tin || ""}</div>
            <div class="subtitle">MIN: ${data.machineNumber || ""}</div>
            <div class="subtitle">S/N: ${data.serialNumber || ""}</div>
            <div class="title" style="margin-top:8px;">Z-READING</div>
          </div>

          <div class="line"></div>
          <table>
            <tr><td class="label">Date Issued</td><td class="value">${data.reportDate || ""}</td></tr>
            <tr><td class="label">Time</td><td class="value">${data.reportTime || ""}</td></tr>
            <tr><td class="label">Beg SI No.</td><td class="value">${data.begSI || ""}</td></tr>
            <tr><td class="label">End SI No.</td><td class="value">${data.endSI || ""}</td></tr>
            <tr><td class="label">Beg Void No.</td><td class="value">${data.begVoid || ""}</td></tr>
            <tr><td class="label">End Void No.</td><td class="value">${data.endVoid || ""}</td></tr>
            <tr><td class="label">Beg Return No.</td><td class="value">${data.begReturn || ""}</td></tr>
            <tr><td class="label">End Return No.</td><td class="value">${data.endReturn || ""}</td></tr>
            <tr><td class="label">Reset Counter No.</td><td class="value">${data.resetCounterNo || 0}</td></tr>
            <tr><td class="label">Z Counter No.</td><td class="value">${data.zCounterNo || 0}</td></tr>
          </table>

          <div class="line"></div>
          <table>
            <tr><td class="label">Present Accum. Sales</td><td class="value">${money(data.presentAccumulatedSales)}</td></tr>
            <tr><td class="label">Previous Accum. Sales</td><td class="value">${money(data.previousAccumulatedSales)}</td></tr>
            <tr><td class="label">Sales for the Day</td><td class="value">${money(data.salesForTheDay)}</td></tr>
          </table>

          <div class="line"></div>
          <div class="strong">BREAKDOWN OF SALES</div>
          <table>
            <tr><td class="label">VATABLE SALES</td><td class="value">${money(data.vatableSales)}</td></tr>
            <tr><td class="label">VAT AMOUNT</td><td class="value">${money(data.vatAmount)}</td></tr>
            <tr><td class="label">VAT-EXEMPT SALES</td><td class="value">${money(data.vatExemptSales)}</td></tr>
            <tr><td class="label">VAT EXEMPTION</td><td class="value">${money(vatExemptionValue)}</td></tr>
            <tr><td class="label">ZERO RATED SALES</td><td class="value">${money(data.zeroRatedSales)}</td></tr>
            <tr><td class="label">OTHER CHARGES</td><td class="value">${money(data.otherCharges)}</td></tr>
          </table>

          <div class="line"></div>
          <table>
            <tr><td class="label">Gross Amount:</td><td class="value">${money(data.grossAmount)}</td></tr>
            <tr><td class="label">Discount:</td><td class="value">${money(data.lessDiscount)}</td></tr>
            <tr><td class="label">VAT Exemption:</td><td class="value">${money(vatExemptionValue)}</td></tr>
            <tr><td class="label">Refund:</td><td class="value">${money(data.lessReturn)}</td></tr>
            <tr><td class="label">Void:</td><td class="value">${money(data.lessVoid)}</td></tr>
            <tr><td class="label">VAT Adjustment:</td><td class="value">${money(data.lessVatAdjustment)}</td></tr>
            <tr><td class="label strong">Net Amount:</td><td class="value strong">${money(data.netAmount)}</td></tr>
          </table>

          <div class="line"></div>
          <div class="strong">DISCOUNT SUMMARY</div>
          <table>
            <tr><td class="label">SC Disc</td><td class="value">${money(data.scDisc)}</td></tr>
            <tr><td class="label">PWD Disc</td><td class="value">${money(data.pwdDisc)}</td></tr>
            <tr><td class="label">NAAC Disc</td><td class="value">${money(data.naacDisc)}</td></tr>
            <tr><td class="label">Solo Parent Disc</td><td class="value">${money(data.soloParentDisc)}</td></tr>
            <tr><td class="label">Other Disc</td><td class="value">${money(data.otherDisc)}</td></tr>
          </table>

          <div class="line"></div>
          <div class="strong">SALES ADJUSTMENT</div>
          <table>
            <tr><td class="label">Void</td><td class="value">${money(data.salesAdjustmentVoid)}</td></tr>
            <tr><td class="label">Return</td><td class="value">${money(data.salesAdjustmentReturn)}</td></tr>
          </table>

          <div class="line"></div>
          <div class="strong">VAT ADJUSTMENT</div>
          <table>
            <tr><td class="label">SC Trans VAT Adj</td><td class="value">${money(data.scTransVatAdj)}</td></tr>
            <tr><td class="label">PWD Trans VAT Adj</td><td class="value">${money(data.pwdTransVatAdj)}</td></tr>
            <tr><td class="label">Reg Disc Trans VAT Adj</td><td class="value">${money(data.regDiscTransVatAdj)}</td></tr>
            <tr><td class="label">Zero Rated Trans VAT Adj</td><td class="value">${money(data.zeroRatedTransVatAdj)}</td></tr>
            <tr><td class="label">VAT on Return</td><td class="value">${money(data.vatOnReturn)}</td></tr>
            <tr><td class="label">Other VAT Adjustments</td><td class="value">${money(data.otherVatAdjustments)}</td></tr>
          </table>

          <div class="line"></div>
          <div class="strong">TRANSACTION SUMMARY</div>
          <table>
            <tr><td class="label">Cash In Drawer</td><td class="value">${money(data.cashInDrawer)}</td></tr>
            <tr><td class="label">Cheque</td><td class="value">${money(data.cheque)}</td></tr>
            <tr><td class="label">Credit Card</td><td class="value">${money(data.creditCard)}</td></tr>
            <tr><td class="label">Other Payments</td><td class="value">${money(data.otherPayments)}</td></tr>
            <tr><td class="label">Opening Fund</td><td class="value">${money(data.openingFund)}</td></tr>
            <tr><td class="label">Less Withdrawal</td><td class="value">${money(data.lessWithdrawal)}</td></tr>
            <tr><td class="label">Payments Received</td><td class="value">${money(data.paymentsReceived)}</td></tr>
            <tr><td class="label strong">Short / Over</td><td class="value strong">${money(data.shortOver)}</td></tr>
          </table>
        </div>
      </body>
    </html>
  `;
};
