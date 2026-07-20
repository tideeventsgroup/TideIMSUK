import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Incident } from '../types/incident';
import type { EventInfo } from '../types/event';
import { categoryLabel } from '../constants/taxonomy';
import { zoneLabel } from '../constants/zones';
import { escalationDef } from '../constants/escalation';

/** Print-static severity palette — PDFs don't carry the app's light/dark theme. */
const SEV_RGB: Record<string, [number, number, number]> = {
  Level1: [107, 114, 128],
  Level2: [180, 83, 9],
  Level3: [220, 38, 38],
  Level4: [153, 27, 27],
};

const BRAND_ORANGE: [number, number, number] = [240, 85, 36];
const INK: [number, number, number] = [26, 26, 26];
const MUTED: [number, number, number] = [110, 110, 110];

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch('/icons/icon-512.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function addHeader(doc: jsPDF, logo: string | null, title: string, subtitle?: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  if (logo) doc.addImage(logo, 'PNG', 14, 10, 11, 11);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...INK);
  doc.text('Tide IMS', logo ? 29 : 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Generated ${new Date().toLocaleString('en-GB')}`, pageWidth - 14, 12, { align: 'right' });

  let y = 30;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text(title, 14, y);
  y += 6;

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(subtitle, 14, y);
    y += 5;
  }

  doc.setDrawColor(...BRAND_ORANGE);
  doc.setLineWidth(0.8);
  doc.line(14, y + 2, pageWidth - 14, y + 2);
  return y + 10;
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('Tide IMS — Confidential', 14, pageHeight - 8);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
  }
}

function severityLabel(level: string): string {
  const def = escalationDef(level);
  return def ? `L${def.number} ${def.name}` : level;
}

/** Full detail for a single incident — replaces printing the detail page from the browser. */
export async function exportIncidentToPdf(incident: Incident) {
  const doc = new jsPDF();
  const logo = await loadLogoDataUrl();

  const y0 = addHeader(
    doc,
    logo,
    'Incident Report',
    `${categoryLabel(incident.category)}${incident.subcategory ? ' — ' + incident.subcategory : ''}`,
  );

  const [r, g, b] = SEV_RGB[incident.escalationLevel] ?? SEV_RGB.Level1;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(r, g, b);
  doc.text(severityLabel(incident.escalationLevel), 14, y0);

  autoTable(doc, {
    startY: y0 + 4,
    theme: 'plain',
    styles: { fontSize: 9, textColor: INK },
    body: [
      ['Timestamp', new Date(incident.timestamp).toLocaleString('en-GB')],
      ['Zone', zoneLabel(incident.zone)],
      ['Status', incident.status],
      ['Priority', incident.priority],
      ['Radio channel', incident.radioChannel ? `Ch${incident.radioChannel}` : '—'],
      ['GPS', incident.lat && incident.lng ? `${incident.lat.toFixed(5)}, ${incident.lng.toFixed(5)}` : '—'],
      ['Logged by', `${incident.loggedByName} (${incident.loggedByRole})`],
      ['Assigned agency', incident.assignedAgency ?? '—'],
      ['Locked', incident.locked ? 'Yes — Controller/Admin only' : 'No'],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
  });

  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text('Narrative', 14, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const narrativeLines = doc.splitTextToSize(incident.narrative, doc.internal.pageSize.getWidth() - 28);
  doc.text(narrativeLines, 14, y);
  y += narrativeLines.length * 4.5 + 8;

  if (incident.updates && incident.updates.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Timestamp', 'User', 'Update']],
      body: incident.updates.map((u) => [new Date(u.timestamp).toLocaleString('en-GB'), u.userName, u.text]),
      headStyles: { fillColor: [51, 51, 51] },
      styles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 28 } },
    });
  }

  addFooter(doc);
  doc.save(`tide-ims-incident-${incident.id}.pdf`);
}

interface HandoverSummary {
  totalOpen: number;
  totalInProgress: number;
  byCategory: Record<string, number>;
  byZone: Record<string, number>;
  criticalOrMajor: Incident[];
}

/** Shift handover / debrief report — Build Plan Section 11 & Phase 3. */
export async function exportHandoverReportToPdf(opts: {
  event: EventInfo;
  summary: HandoverSummary;
  totalLogged: number;
  aiSummaryText: string | null;
}) {
  const { event, summary, totalLogged, aiSummaryText } = opts;
  const doc = new jsPDF();
  const logo = await loadLogoDataUrl();
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = addHeader(doc, logo, 'Shift Handover / Debrief Report', `${event.name} — ${event.venue} (${event.startDate} to ${event.endDate})`);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(`${summary.totalOpen} open  ·  ${summary.totalInProgress} in progress  ·  ${totalLogged} total logged`, 14, y);
  y += 8;

  const categoryRows = Object.entries(summary.byCategory).map(([k, v]) => [categoryLabel(k), String(v)]);
  const zoneRows = Object.entries(summary.byZone).map(([k, v]) => [zoneLabel(k), String(v)]);

  autoTable(doc, {
    startY: y,
    head: [['By category', 'Count']],
    body: categoryRows.length ? categoryRows : [['None', '0']],
    headStyles: { fillColor: [51, 51, 51] },
    styles: { fontSize: 9 },
    tableWidth: (pageWidth - 28) / 2 - 3,
    margin: { left: 14 },
  });
  const leftFinalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, {
    startY: y,
    head: [['By zone', 'Count']],
    body: zoneRows.length ? zoneRows : [['None', '0']],
    headStyles: { fillColor: [51, 51, 51] },
    styles: { fontSize: 9 },
    tableWidth: (pageWidth - 28) / 2 - 3,
    margin: { left: 14 + (pageWidth - 28) / 2 + 3 },
  });
  const rightFinalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  y = Math.max(leftFinalY, rightFinalY) + 10;

  if (aiSummaryText) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text('AI shift summary (draft — human review required)', 14, y);
    y += 5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(aiSummaryText, pageWidth - 28);
    doc.text(lines, 14, y);
    y += lines.length * 4.5 + 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text('Reviewed by: _______________________        Date: _______________', 14, y);
    y += 10;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text('Level 3/4 incidents', 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Time', 'Level', 'Category', 'Zone', 'Narrative']],
    body: summary.criticalOrMajor.length
      ? summary.criticalOrMajor.map((i) => [
          new Date(i.timestamp).toLocaleString('en-GB'),
          severityLabel(i.escalationLevel),
          categoryLabel(i.category),
          zoneLabel(i.zone),
          i.narrative,
        ])
      : [['None', '', '', '', '']],
    headStyles: { fillColor: [51, 51, 51] },
    styles: { fontSize: 8 },
    columnStyles: { 4: { cellWidth: 70 } },
  });

  addFooter(doc);
  const slug = event.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  doc.save(`tide-ims-handover-${slug || 'report'}.pdf`);
}

/** Full incident log as PDF — same data as the CSV export, for a printable pack. */
export async function exportIncidentLogToPdf(incidents: Incident[], event: EventInfo) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const logo = await loadLogoDataUrl();

  const y = addHeader(doc, logo, 'Incident Log', `${event.name} — ${event.venue} (${event.startDate} to ${event.endDate})`);

  autoTable(doc, {
    startY: y,
    head: [['Time', 'Level', 'Category', 'Zone', 'Status', 'Priority', 'Logged by', 'Narrative']],
    body: incidents.map((i) => [
      new Date(i.timestamp).toLocaleString('en-GB'),
      severityLabel(i.escalationLevel),
      categoryLabel(i.category),
      zoneLabel(i.zone),
      i.status,
      i.priority,
      i.loggedByName,
      i.narrative,
    ]),
    headStyles: { fillColor: [51, 51, 51] },
    styles: { fontSize: 8 },
    columnStyles: { 7: { cellWidth: 90 } },
  });

  addFooter(doc);
  doc.save('tide-ims-incident-log.pdf');
}
