"use client";

// Builds a real, structured .xlsx workbook for the Reports page: a Summary sheet with the
// period's KPIs, a Charts sheet with the actual on-screen charts embedded as images, and a
// Daily Data sheet with a proper formatted/filterable table (not a flat CSV dump).

// Type-only import: erased at compile time, so it doesn't pull the exceljs runtime (and its
// Node-oriented main entry) into every bundle that imports this module — only the dynamic
// `import("exceljs")` below does that, and only when an export actually runs.
import type { Row } from "exceljs";

type DailyRow = {
  dateStr: string;
  displayDate: string;
  orders: number;
  revenue: number;
  commission: number;
  clicks: number;
  conversions: number;
  topAffiliate: { id: string; name: string; email: string } | null;
};

type StatBlock = { total: number; trend: number };

type Stats = {
  totalOrders: StatBlock;
  totalRevenue: StatBlock;
  totalCommission: StatBlock;
  totalClicks: StatBlock;
};

const BRAND = "4F46E5"; // matches the app's primary color, used for header fills

/** Rasterizes a live recharts <svg> node to a PNG data URL, at 2x for crisp embedding. */
function svgNodeToPngDataUrl(svg: SVGSVGElement): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const width = svg.clientWidth || parseInt(svg.getAttribute("width") || "600", 10);
    const height = svg.clientHeight || parseInt(svg.getAttribute("height") || "300", 10);

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    // Charts render on a transparent background on screen; give the export a white one.
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("width", "100%");
    bg.setAttribute("height", "100%");
    bg.setAttribute("fill", "#ffffff");
    clone.insertBefore(bg, clone.firstChild);

    const svgString = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.scale(scale, scale);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve({ dataUrl: canvas.toDataURL("image/png"), width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to rasterize chart"));
    };
    img.src = url;
  });
}

function styleHeaderRow(row: Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND}` } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });
  row.height = 22;
}

export async function exportReportToExcel({
  dailyData,
  stats,
  dateRangeLabel,
  affiliateLabel,
  revenueChartSvg,
  clicksChartSvg,
}: {
  dailyData: DailyRow[];
  stats: Stats;
  dateRangeLabel: string;
  affiliateLabel: string;
  revenueChartSvg: SVGSVGElement | null;
  clicksChartSvg: SVGSVGElement | null;
}) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LumeraMD Affiliates";
  workbook.created = new Date();

  // ---- Summary sheet ----
  const summary = workbook.addWorksheet("Summary", { views: [{ showGridLines: false }] });
  summary.columns = [
    { key: "label", width: 28 },
    { key: "value", width: 20 },
    { key: "trend", width: 22 },
  ];

  summary.mergeCells("A1:C1");
  const title = summary.getCell("A1");
  title.value = "Affiliate Program Report";
  title.font = { bold: true, size: 16, color: { argb: `FF${BRAND}` } };
  summary.getRow(1).height = 28;

  summary.mergeCells("A2:C2");
  summary.getCell("A2").value = `Period: ${dateRangeLabel}   ·   Affiliate: ${affiliateLabel}   ·   Generated: ${new Date().toLocaleString()}`;
  summary.getCell("A2").font = { italic: true, color: { argb: "FF64748B" } };

  summary.addRow([]);
  const headerRow = summary.addRow(["Metric", "Value", "vs. previous period"]);
  styleHeaderRow(headerRow);

  const kpiRows: [string, number | string, number][] = [
    ["Total Orders", stats.totalOrders.total, stats.totalOrders.trend],
    ["Total Revenue", stats.totalRevenue.total, stats.totalRevenue.trend],
    ["Total Commission", stats.totalCommission.total, stats.totalCommission.trend],
    ["Total Clicks", stats.totalClicks.total, stats.totalClicks.trend],
  ];
  const currencyRows = new Set(["Total Revenue", "Total Commission"]);

  for (const [label, value, trend] of kpiRows) {
    const row = summary.addRow([label, value, `${trend > 0 ? "+" : ""}${trend}%`]);
    if (currencyRows.has(label)) {
      row.getCell(2).numFmt = '"$"#,##0.00';
    } else {
      row.getCell(2).numFmt = "#,##0";
    }
    row.getCell(3).font = { color: { argb: trend < 0 ? "FFDC2626" : "FF16A34A" }, bold: true };
    row.getCell(1).font = { bold: true };
  }

  const overallConvRate =
    stats.totalClicks.total > 0 ? (stats.totalOrders.total / stats.totalClicks.total) * 100 : 0;
  const avgOrderValue = stats.totalOrders.total > 0 ? stats.totalRevenue.total / stats.totalOrders.total : 0;
  summary.addRow([]);
  const derivedRow = summary.addRow(["Conversion Rate", `${overallConvRate.toFixed(2)}%`, ""]);
  derivedRow.getCell(1).font = { bold: true };
  const aovRow = summary.addRow(["Average Order Value", avgOrderValue, ""]);
  aovRow.getCell(1).font = { bold: true };
  aovRow.getCell(2).numFmt = '"$"#,##0.00';

  // ---- Charts sheet (the actual on-screen charts, embedded as images) ----
  const chartsSheet = workbook.addWorksheet("Charts", { views: [{ showGridLines: false }] });
  chartsSheet.getColumn(1).width = 2;
  chartsSheet.getCell("A1").value = "Revenue & Commission and Clicks vs Conversions charts for the selected period.";
  chartsSheet.getCell("A1").font = { italic: true, color: { argb: "FF64748B" } };

  let nextRow = 3;
  if (revenueChartSvg) {
    try {
      const { dataUrl, width, height } = await svgNodeToPngDataUrl(revenueChartSvg);
      const imageId = workbook.addImage({ base64: dataUrl, extension: "png" });
      chartsSheet.addImage(imageId, {
        tl: { col: 0.2, row: nextRow - 1 },
        ext: { width, height },
      });
      nextRow += Math.ceil(height / 20) + 2;
    } catch {
      // If rasterizing fails (e.g. no data yet), skip the image rather than fail the export.
    }
  }
  if (clicksChartSvg) {
    try {
      const { dataUrl, width, height } = await svgNodeToPngDataUrl(clicksChartSvg);
      const imageId = workbook.addImage({ base64: dataUrl, extension: "png" });
      chartsSheet.addImage(imageId, {
        tl: { col: 0.2, row: nextRow - 1 },
        ext: { width, height },
      });
    } catch {
      // skip
    }
  }

  // ---- Daily Data sheet: a real structured, filterable table ----
  const daily = workbook.addWorksheet("Daily Data", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  daily.columns = [
    { header: "Date", key: "date", width: 16 },
    { header: "Orders", key: "orders", width: 12 },
    { header: "Revenue", key: "revenue", width: 16 },
    { header: "Commission", key: "commission", width: 16 },
    { header: "Clicks", key: "clicks", width: 12 },
    { header: "Conversions", key: "conversions", width: 14 },
    { header: "Top Affiliate", key: "topAffiliateName", width: 24 },
    { header: "Top Affiliate Email", key: "topAffiliateEmail", width: 28 },
  ];
  styleHeaderRow(daily.getRow(1));

  for (const d of dailyData) {
    const row = daily.addRow({
      date: d.displayDate,
      orders: d.orders,
      revenue: d.revenue,
      commission: d.commission,
      clicks: d.clicks,
      conversions: d.conversions,
      topAffiliateName: d.topAffiliate?.name || "None",
      topAffiliateEmail: d.topAffiliate?.email || "",
    });
    row.getCell("revenue").numFmt = '"$"#,##0.00';
    row.getCell("commission").numFmt = '"$"#,##0.00';
  }

  if (dailyData.length > 0) {
    daily.autoFilter = { from: "A1", to: "H1" };
    // Totals row
    const totalsRow = daily.addRow({
      date: "Total",
      orders: dailyData.reduce((a, d) => a + d.orders, 0),
      revenue: dailyData.reduce((a, d) => a + d.revenue, 0),
      commission: dailyData.reduce((a, d) => a + d.commission, 0),
      clicks: dailyData.reduce((a, d) => a + d.clicks, 0),
      conversions: dailyData.reduce((a, d) => a + d.conversions, 0),
    });
    totalsRow.font = { bold: true };
    totalsRow.getCell("revenue").numFmt = '"$"#,##0.00';
    totalsRow.getCell("commission").numFmt = '"$"#,##0.00';
    totalsRow.eachCell((cell) => {
      cell.border = { top: { style: "thin", color: { argb: "FF94A3B8" } } };
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `affiliate_report_${dateRangeLabel.replace(/\s+/g, "_").toLowerCase()}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
