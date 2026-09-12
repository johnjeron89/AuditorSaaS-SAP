import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

export async function buildReport(auditRun: any, findings: any[], aiSummary: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  let page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  let y = height - 50;

  const drawText = (text: string, size: number = 12, isBold: boolean = false, color = rgb(0, 0, 0)) => {
    if (y < 50) {
      page = pdfDoc.addPage();
      y = height - 50;
    }
    page.drawText(text, { x: 50, y, size, font: isBold ? boldFont : font, color });
    y -= size + 10;
  };

  const drawMultilineText = (text: string, size: number = 10, isBold: boolean = false) => {
    const maxWidth = width - 100;
    const words = text.split(' ');
    let line = '';
    
    for (const word of words) {
      const testLine = line + word + ' ';
      const textWidth = (isBold ? boldFont : font).widthOfTextAtSize(testLine, size);
      if (textWidth > maxWidth && line !== '') {
        drawText(line, size, isBold);
        line = word + ' ';
      } else {
        line = testLine;
      }
    }
    if (line !== '') {
      drawText(line, size, isBold);
    }
  };

  drawText("Security Audit Report", 24, true);
  y -= 10;
  drawText(`Date: ${new Date().toLocaleDateString()}`, 12);
  drawText(`Framework: ${auditRun.framework || "Google Workspace CIS"}`, 12);
  const score = auditRun.score ?? 0;
  drawText(`Score: ${score}/100`, 16, true);
  y -= 20;
  drawText("Executive Summary", 16, true);
  drawMultilineText(aiSummary, 12);
  
  const drawFindings = (severityLevel: string, severityTitle: string, color: any) => {
    page = pdfDoc.addPage();
    y = height - 50;
    drawText(severityTitle, 18, true, color);
    y -= 10;
    
    const severityFindings = findings.filter(f => f.severity === severityLevel);
    if (severityFindings.length === 0) {
      drawText("No findings in this category.", 12);
      return;
    }
    
    severityFindings.forEach(f => {
      drawText(`${f.check_id}: ${f.title}`, 14, true);
      drawText(`Status: ${f.status.toUpperCase()}`, 10, true, f.status === 'pass' ? rgb(0, 0.5, 0) : rgb(0.8, 0, 0));
      drawText(`Regulation: ${f.regulation_section}`, 10);
      y -= 5;
      drawMultilineText(`Description: ${f.description}`, 10);
      drawMultilineText(`Fix: ${f.fix_instructions}`, 10);
      y -= 15;
    });
  };

  drawFindings('critical', 'Critical Findings', rgb(0.8, 0, 0));
  drawFindings('high', 'High Findings', rgb(0.9, 0.5, 0));
  
  page = pdfDoc.addPage();
  y = height - 50;
  drawText("Medium / Low Findings", 18, true);
  y -= 10;
  const medLowFindings = findings.filter(f => ['medium', 'low'].includes(f.severity));
  medLowFindings.forEach(f => {
    drawText(`${f.check_id}: ${f.title} [${f.severity.toUpperCase()}]`, 12, true);
    drawText(`Status: ${f.status.toUpperCase()}`, 10, true, f.status === 'pass' ? rgb(0, 0.5, 0) : (f.severity === 'medium' ? rgb(0.8, 0.8, 0) : rgb(0, 0, 0.8)));
    drawText(`Regulation: ${f.regulation_section}`, 10);
    y -= 5;
    drawMultilineText(`Description: ${f.description}`, 10);
    drawMultilineText(`Fix: ${f.fix_instructions}`, 10);
    y -= 15;
  });

  return await pdfDoc.save();
}
