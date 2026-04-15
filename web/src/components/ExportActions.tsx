"use client";

import { Button } from "@/components/ui/button";
import { FileText, Printer, Download } from "lucide-react";
import {
  SEVERITY_BADGE,
  calculateSecurityScore,
  getTopVulnerabilities,
  getEvidenceDialogs,
  getRecommendations,
  getWorstByOwaspId,
} from "@/lib/owasp";

export function ExportActions({ data }: { data: any }) {
  const downloadMarkdown = () => {
    if (!data || !data.scanData) return;

    const scanData = data.scanData;
    const meta = data.metadata || {};
    const score = calculateSecurityScore(scanData);
    const totalTests = scanData.reduce((a: number, r: any) => a + (r.total || 0), 0);
    const totalFailed = scanData.reduce((a: number, r: any) => a + (r.failed || 0), 0);
    const overallAsr = totalTests > 0 ? ((totalFailed / totalTests) * 100).toFixed(1) : "0.0";
    const topVulns = getTopVulnerabilities(scanData);
    const worstByOwasp = getWorstByOwaspId(scanData);
    const evidence = getEvidenceDialogs(scanData);
    const recommendations = getRecommendations(scanData);
    const date = meta.timestamp ? new Date(meta.timestamp).toLocaleString("ru-RU") : new Date().toLocaleString("ru-RU");

    // Status line
    const statusLine = totalFailed === 0
      ? "✅ **Все тесты пройдены успешно.** Модель успешно отразила все симулированные атаки."
      : totalFailed <= totalTests / 4
        ? `⚠️ **Обнаружены отдельные уязвимости** (${totalFailed} из ${totalTests} тестов провалено). Требуется устранение.`
        : `❌ **Критический уровень уязвимостей** (${totalFailed} из ${totalTests} тестов провалено). Немедленное вмешательство необходимо.`;

    let md = "";

    // Cover
    md += `# 🛡️ DeepThroath — Отчёт о безопасности LLM\n\n`;
    md += `**Дата:** ${date}  \n`;
    md += `**Тестируемая модель:** \`${meta.model_version || "N/A"}\`  \n`;
    md += `**Модель-судья:** \`${meta.judge_version || "N/A"}\`  \n\n`;
    md += `---\n\n`;

    // KPI table
    md += `## Индекс безопасности: ${score}/100\n\n`;
    md += `| Метрика | Значение |\n`;
    md += `|---------|----------|\n`;
    md += `| Индекс безопасности | **${score}/100** |\n`;
    md += `| Успешность атак (ASR) | **${overallAsr}%** |\n`;
    md += `| Всего тестов | **${totalTests}** |\n`;
    md += `| Провалено тестов | **${totalFailed}** |\n\n`;
    md += `---\n\n`;

    // Section 1: Executive summary
    md += `## 1. Резюме для руководства\n\n`;
    md += statusLine + "\n\n";

    if (topVulns.length > 0) {
      md += `### Критические находки\n\n`;
      md += `| Уязвимость | OWASP | Критичность | ASR |\n`;
      md += `|-----------|-------|-------------|-----|\n`;
      topVulns.forEach(v => {
        md += `| ${v.vulnerability} | ${v.owasp_id} | ${v.severity} | **${(v.asr * 100).toFixed(1)}%** |\n`;
      });
      md += `\n`;
    }
    md += `---\n\n`;

    // Section 2: Methodology
    const attacks = [...new Set(scanData.map((r: any) => r.attack_type).filter(Boolean))];
    const vulnNames = [...new Set(scanData.map((r: any) => r.vulnerability).filter(Boolean))];
    const maxSims = Math.max(...scanData.map((r: any) => r.total || 0), 0);

    md += `## 2. Методология и метрики\n\n`;
    md += `- **ASR (Attack Success Rate):** процент атак, приведших к небезопасному ответу модели. Чем ниже, тем лучше.\n`;
    md += `- **Pass Rate:** процент успешно отражённых атак.\n`;
    md += `- **Индекс безопасности:** взвешенная оценка, где Critical/High уязвимости имеют больший вес.\n\n`;
    md += `| Параметр | Значение |\n`;
    md += `|----------|----------|\n`;
    md += `| Целевая модель | \`${meta.model_version || "N/A"}\` |\n`;
    md += `| Модель-судья | \`${meta.judge_version || "N/A"}\` |\n`;
    md += `| Методы атак | ${attacks.join(", ") || "N/A"} |\n`;
    md += `| Симуляций на тип | ${maxSims} |\n\n`;
    md += `---\n\n`;

    // Section 3: OWASP results table
    md += `## 3. Результаты по категориям OWASP LLM Top 10\n\n`;
    md += `| ID | Категория | Критичность | Защита | ASR |\n`;
    md += `|----|-----------|-------------|--------|-----|\n`;
    worstByOwasp.forEach(row => {
      const passRate = 1.0 - (row.asr || 0);
      const passCell = passRate === 1.0
        ? `✅ ${(passRate * 100).toFixed(1)}%`
        : passRate >= 0.5
          ? `⚠️ ${(passRate * 100).toFixed(1)}%`
          : `❌ ${(passRate * 100).toFixed(1)}%`;
      const asrCell = row.asr === 0
        ? "—"
        : row.asr <= 0.5
          ? `⚠️ ${(row.asr * 100).toFixed(1)}%`
          : `❌ ${(row.asr * 100).toFixed(1)}%`;
      md += `| **${row.owasp_id}** | ${row.owasp_name} | ${row.severity} | ${passCell} | ${asrCell} |\n`;
    });
    md += `\n---\n\n`;

    // Section 4: Evidence
    if (evidence.length > 0) {
      md += `## 4. Примеры успешных атак (Evidence)\n\n`;
      md += `Ниже приведены реальные диалоги, в которых защита модели была обойдена.\n\n`;
      evidence.forEach(ev => {
        md += `### [${ev.owasp_id}] ${ev.vulnerability} (${ev.severity})\n\n`;
        md += `**Ввод атакующего:**\n\`\`\`\n${ev.dialog.input}\n\`\`\`\n\n`;
        md += `**Ответ модели:**\n\`\`\`\n${ev.dialog.output}\n\`\`\`\n\n`;
        md += `> ⚠️ **ВЕРДИКТ: НЕБЕЗОПАСНО**\n\n---\n\n`;
      });
    } else {
      md += `## 4. Примеры успешных атак (Evidence)\n\n`;
      md += `✅ Успешных атак не зафиксировано.\n\n---\n\n`;
    }

    // Section 5: Recommendations
    if (recommendations.length > 0) {
      md += `## 5. Рекомендации по устранению\n\n`;
      recommendations.forEach(rec => {
        md += `### ${rec.owasp_id} — ${rec.vulnerability} (${rec.severity})\n\n`;
        md += `${rec.remediation}\n\n`;
      });
    } else {
      md += `## 5. Рекомендации по устранению\n\n`;
      md += `✅ Рекомендации не требуются — все уязвимости отражены.\n\n`;
    }

    md += `---\n\n*Сгенерировано платформой DeepThroath LLM Security | Конфиденциально*\n`;

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Security_Report_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadLogs = () => {
    if (!data || !data.scanData) return;
    const json = JSON.stringify(data.scanData, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scan_logs_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openPdfReport = () => {
    if (!data || !data.scanData) return;

    const scanData = data.scanData;
    const meta = data.metadata || {};
    const score = calculateSecurityScore(scanData);
    const totalTests = scanData.reduce((a: number, r: any) => a + (r.total || 0), 0);
    const totalFailed = scanData.reduce((a: number, r: any) => a + (r.failed || 0), 0);
    const overallAsr = totalTests > 0 ? ((totalFailed / totalTests) * 100).toFixed(1) : "0.0";
    const topVulns = getTopVulnerabilities(scanData);
    const worstByOwasp = getWorstByOwaspId(scanData);
    const evidence = getEvidenceDialogs(scanData);
    const recommendations = getRecommendations(scanData);
    const date = meta.timestamp ? new Date(meta.timestamp).toLocaleString("ru-RU") : new Date().toLocaleString("ru-RU");

    const severityColor: Record<string, string> = {
      Critical: "#dc2626", High: "#ea580c", Medium: "#ca8a04", Low: "#16a34a"
    };
    const severityBg: Record<string, string> = {
      Critical: "#fef2f2", High: "#fff7ed", Medium: "#fefce8", Low: "#f0fdf4"
    };

    const statusText = totalFailed === 0
      ? `<span style="color:#16a34a">✅ Все тесты пройдены успешно.</span>`
      : totalFailed <= totalTests / 4
        ? `<span style="color:#ca8a04">⚠️ Обнаружены отдельные уязвимости (${totalFailed} из ${totalTests} тестов провалено). Требуется устранение.</span>`
        : `<span style="color:#dc2626">❌ Критический уровень уязвимостей (${totalFailed} из ${totalTests} тестов провалено). Немедленное вмешательство необходимо.</span>`;

    const badgeHtml = (sev: string) =>
      `<span style="background:${severityColor[sev]||'#6b7280'};color:white;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:0.5px">${sev.toUpperCase()}</span>`;

    const topVulnsRows = topVulns.map(v =>
      `<tr><td>${v.vulnerability}</td><td>${v.owasp_id}</td><td>${badgeHtml(v.severity)}</td><td><b>${(v.asr*100).toFixed(1)}%</b></td></tr>`
    ).join("");

    const owaspRows = worstByOwasp.map(row => {
      const passRate = (1 - (row.asr||0));
      const passCell = passRate === 1
        ? `<span style="color:#16a34a">✅ ${(passRate*100).toFixed(1)}%</span>`
        : passRate >= 0.5
          ? `<span style="color:#ca8a04">⚠️ ${(passRate*100).toFixed(1)}%</span>`
          : `<span style="color:#dc2626">✗ ${(passRate*100).toFixed(1)}%</span>`;
      const asrCell = row.asr === 0 ? `<span style="color:#6b7280">—</span>`
        : `<span style="color:#dc2626"><b>${(row.asr*100).toFixed(1)}%</b></span>`;
      return `<tr>
        <td><b style="color:${severityColor[row.owasp_id]||'#374151'}">${row.owasp_id}</b></td>
        <td>${row.owasp_name}</td>
        <td>${badgeHtml(row.severity)}</td>
        <td>${passCell}</td>
        <td>${asrCell}</td>
      </tr>`;
    }).join("");

    const evidenceHtml = evidence.length === 0
      ? `<p style="color:#16a34a">✅ Успешных атак не зафиксировано.</p>`
      : evidence.map(ev => `
        <div style="margin-bottom:24px;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
          <h3 suppressHydrationWarning style="margin:0 0 12px;font-size:15px">${badgeHtml(ev.severity)} [${ev.owasp_id}] ${ev.vulnerability}</h3>
          <p style="font-size:12px;color:#6b7280;margin:0 0 6px">Метод атаки: ${ev.attack_type}</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;margin-bottom:8px">
            <p style="font-size:11px;color:#6b7280;margin:0 0 4px">ВВОД АТАКУЮЩЕГО:</p>
            <p style="font-size:13px;margin:0;white-space:pre-wrap">${ev.dialog.input?.replace(/</g,'&lt;')}</p>
          </div>
          <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:6px;padding:12px">
            <p style="font-size:11px;color:#6b7280;margin:0 0 4px">ОТВЕТ МОДЕЛИ:</p>
            <p style="font-size:13px;margin:0;white-space:pre-wrap">${ev.dialog.output?.replace(/</g,'&lt;')}</p>
          </div>
          <p style="margin:8px 0 0;color:#dc2626;font-weight:600;font-size:13px">⚠️ ВЕРДИКТ: НЕБЕЗОПАСНО</p>
        </div>`).join("");

    const recsHtml = recommendations.length === 0
      ? `<p style="color:#16a34a">✅ Рекомендации не требуются — все уязвимости отражены.</p>`
      : recommendations.map(rec => `
        <div style="margin-bottom:20px;padding:16px;border-left:4px solid ${severityColor[rec.severity]||'#6b7280'};background:${severityBg[rec.severity]||'#f9fafb'};border-radius:0 8px 8px 0">
          <h3 suppressHydrationWarning style="margin:0 0 8px;font-size:14px">${badgeHtml(rec.severity)} ${rec.owasp_id} — ${rec.vulnerability}</h3>
          <p style="margin:0;font-size:13px;color:#374151">${rec.remediation}</p>
        </div>`).join("");

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>DeepThroath Security Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; background: white; }
  .cover { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; text-align: center; padding: 48px; page-break-after: always; }
  .cover-logo { font-size: 14px; font-weight: 700; letter-spacing: 2px; color: #94a3b8; margin-bottom: 32px; text-transform: uppercase; }
  .cover-logo span { color: #ef4444; }
  .cover-title { font-size: 52px; font-weight: 900; line-height: 1.1; margin-bottom: 8px; }
  .cover-subtitle { font-size: 20px; color: #94a3b8; margin-bottom: 48px; }
  .score-box { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px 48px; margin-bottom: 24px; }
  .score-num { font-size: 80px; font-weight: 900; line-height: 1; }
  .score-label { font-size: 13px; color: #94a3b8; margin-top: 4px; }
  .score-delta { font-size: 14px; margin-top: 8px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 32px; width: 100%; max-width: 480px; }
  .meta-item { background: rgba(255,255,255,0.05); border-radius: 10px; padding: 12px 16px; text-align: left; }
  .meta-label { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .meta-value { font-size: 13px; color: #e2e8f0; }
  .section { padding: 48px; page-break-before: always; }
  .section:first-of-type { page-break-before: avoid; }
  h2 { font-size: 22px; font-weight: 700; color: #111827; border-bottom: 3px solid #ef4444; padding-bottom: 12px; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 0.5px; }
  h3 { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #1e293b; }
  .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
  .kpi-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; text-align: center; }
  .kpi-num { font-size: 28px; font-weight: 800; color: #111827; }
  .kpi-lbl { font-size: 10px; color: #6b7280; text-transform: uppercase; margin-top: 4px; letter-spacing: 0.5px; }
  .findings-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-top: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #f1f5f9; text-align: left; padding: 10px 12px; font-weight: 600; color: #374151; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; }
  td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #374151; }
  tr:last-child td { border-bottom: none; }
  .meta-table td:first-child { font-weight: 600; width: 200px; }
  ul { padding-left: 20px; margin-bottom: 12px; }
  li { margin-bottom: 6px; font-size: 14px; color: #374151; line-height: 1.5; }
  .footer { text-align: center; padding: 32px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
  @media print { .cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>

<div class="cover">
  <div class="cover-logo">🛡 DeepThroath <span>Security</span></div>
  <div class="cover-title">Отчёт о безопасности<br>LLM</div>
  <div class="score-box">
    <div class="score-num">${score}<span style="font-size:36px;color:#94a3b8">/100</span></div>
    <div class="score-label">Индекс безопасности</div>
  </div>
  <div class="meta-grid">
    <div class="meta-item"><div class="meta-label">Тестируемая модель</div><div class="meta-value">${meta.model_version||'N/A'}</div></div>
    <div class="meta-item"><div class="meta-label">Модель-судья</div><div class="meta-value">${meta.judge_version||'N/A'}</div></div>
    <div class="meta-item"><div class="meta-label">Дата отчёта</div><div class="meta-value">${date}</div></div>
    <div class="meta-item"><div class="meta-label">Всего тестов</div><div class="meta-value">${totalTests} (Провалено: ${totalFailed})</div></div>
  </div>
</div>

<div class="section">
  <h2 suppressHydrationWarning>1. Резюме для руководства</h2>
  <p style="margin-bottom:24px;font-size:14px;line-height:1.6;color:#374151">Данный отчёт содержит результаты автоматизированного тестирования (Red Teaming) языковой модели на соответствие стандартам безопасности <b>OWASP LLM Top 10</b>.</p>
  <div class="kpi-row">
    <div class="kpi-card"><div class="kpi-num">${score}/100</div><div class="kpi-lbl">Индекс безопасности</div></div>
    <div class="kpi-card"><div class="kpi-num">${overallAsr}%</div><div class="kpi-lbl">Успешность атак (ASR)</div></div>
    <div class="kpi-card"><div class="kpi-num">${totalTests}</div><div class="kpi-lbl">Выполнено тестов</div></div>
    <div class="kpi-card"><div class="kpi-num">${totalFailed}</div><div class="kpi-lbl">Найдено уязвимостей</div></div>
  </div>
  <p style="margin-bottom:16px">${statusText}</p>
  ${topVulns.length > 0 ? `<div class="findings-box"><h3 suppressHydrationWarning>Критические находки</h3><table><thead><tr><th>Уязвимость</th><th>OWASP</th><th>Критичность</th><th>ASR</th></tr></thead><tbody>${topVulnsRows}</tbody></table></div>` : ""}
</div>

<div class="section">
  <h2 suppressHydrationWarning>2. Методология и метрики</h2>
  <p style="margin-bottom:16px;font-size:14px;line-height:1.6;color:#374151">Тестирование проводилось методом имитации враждебных атак. Каждое взаимодействие оценивается независимой <b>моделью-судьёй (LLM-as-a-Judge)</b>.</p>
  <ul>
    <li><b>ASR (Attack Success Rate):</b> Процент атак, которые привели к небезопасному ответу модели. Чем ниже ASR, тем лучше защита.</li>
    <li><b>Pass Rate:</b> Процент успешно отражённых атак.</li>
    <li><b>Индекс безопасности:</b> Взвешенная оценка, где критические уязвимости (Critical/High) имеют больший вес при расчёте общего балла.</li>
  </ul>
  <table class="meta-table" style="margin-top:16px"><tbody>
    <tr><td>Целевая модель</td><td><code>${meta.model_version||'N/A'}</code></td></tr>
    <tr><td>Модель-судья</td><td><code>${meta.judge_version||'N/A'}</code></td></tr>
    <tr><td>Методы атак</td><td>${[...new Set(scanData.map((r:any)=>r.attack_type).filter(Boolean))].join(', ')||'N/A'}</td></tr>
    <tr><td>Количество симуляций</td><td>${Math.max(...scanData.map((r:any)=>r.total||0),0)} на каждый тип</td></tr>
  </tbody></table>
</div>

<div class="section">
  <h2 suppressHydrationWarning>3. Результаты по категориям OWASP</h2>
  <table><thead><tr><th>ID</th><th>Категория</th><th>Критичность</th><th>Защита</th><th>Взломы (ASR)</th></tr></thead><tbody>${owaspRows}</tbody></table>
</div>

<div class="section">
  <h2 suppressHydrationWarning>4. Примеры успешных атак (Evidence)</h2>
  ${evidenceHtml}
</div>

<div class="section">
  <h2 suppressHydrationWarning>5. Рекомендации по устранению</h2>
  ${recsHtml}
</div>

<div class="footer">Сгенерировано платформой DeepThroath LLM Security | Конфиденциально</div>

<script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  return (
    <div className="flex items-center gap-3 no-print mt-4 md:mt-0">
      <Button variant="outline" className="border-slate-700 bg-slate-900/50 hover:bg-slate-800" onClick={downloadMarkdown}>
        <FileText className="w-4 h-4 mr-2" />
        Отчёт MD
      </Button>
      <Button variant="outline" className="border-slate-700 bg-slate-900/50 hover:bg-slate-800" onClick={downloadLogs}>
        <Download className="w-4 h-4 mr-2" />
        Логи JSON
      </Button>
      <Button variant="default" className="bg-emerald-600 hover:bg-emerald-700" onClick={openPdfReport}>
        <Printer className="w-4 h-4 mr-2" />
        Печать PDF
      </Button>
    </div>
  );
}
