"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, LayoutGrid, AlertTriangle, ShieldCheck, FileText, Loader2, ArrowRight, Download, Rocket } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function EvalDashboard() {
  const [data, setData] = useState<{
    metrics: any[];
    allScans: any[];
  } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedScan, setSelectedScan] = useState("latest");

  const activeScan = selectedScan === 'latest'
    ? (data?.allScans?.[0]?.value ?? null)
    : selectedScan;

  const downloadFile = (type: 'md' | 'csv') => {
    if (!activeScan) return;
    const url = `/api/eval/report?scan=${encodeURIComponent(activeScan)}&type=${type}`;
    const a = document.createElement('a');
    a.href = url;
    a.click();
  };

  useEffect(() => {
    setLoading(true);
    fetch("/api/eval?scanFile=" + selectedScan)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "HTTP " + res.status + " Неизвестная ошибка");
        return json;
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [selectedScan]);

  const { avgAR, avgFA, avgCP, avgCR, totalQueries, passedQueries } = useMemo(() => {
    if (!data || !data.metrics || data.metrics.length === 0) {
      return { avgAR: 0, avgFA: null, avgCP: null, avgCR: null, totalQueries: 0, passedQueries: 0 };
    }

    const { metrics } = data;
    
    const arValues = metrics.filter(m => m.answer_relevancy_score !== null).map(m => m.answer_relevancy_score);
    const avgAR = arValues.length ? arValues.reduce((a, b) => a + b, 0) / arValues.length : 0;

    const faValues = metrics.filter(m => m.faithfulness_score !== null).map(m => m.faithfulness_score);
    const avgFA: number | null = faValues.length ? faValues.reduce((a, b) => a + b, 0) / faValues.length : null;

    const cpValues = metrics.filter(m => m.contextual_precision_score != null).map(m => m.contextual_precision_score);
    const avgCP: number | null = cpValues.length ? cpValues.reduce((a: number, b: number) => a + b, 0) / cpValues.length : null;

    const crValues = metrics.filter(m => m.contextual_recall_score != null).map(m => m.contextual_recall_score);
    const avgCR: number | null = crValues.length ? crValues.reduce((a: number, b: number) => a + b, 0) / crValues.length : null;

    // A query counts as "passed" strictly if AR passed AND (FA passed or FA is null)
    let passedCount = 0;
    metrics.forEach(m => {
        const arOk = m.answer_relevancy_passed === true;
        const faOk = m.faithfulness_passed === null || m.faithfulness_passed === true;
        if (arOk && faOk) passedCount++;
    });

    return { avgAR, avgFA: avgFA as number | null, avgCP, avgCR, totalQueries: metrics.length, passedQueries: passedCount };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
        <div className="animate-pulse flex flex-col items-center">
          <Activity className="w-16 h-16 mb-4 text-purple-500 animate-spin" />
          <h2 suppressHydrationWarning className="text-2xl font-bold tracking-tight">Загрузка RAG-метрик...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] bg-transparent text-white animate-in fade-in zoom-in duration-500">
        <div className="bg-white/5 border border-white/10 p-10 rounded-[32px] backdrop-blur-2xl shadow-2xl max-w-xl text-center relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-10">
               <Activity className="w-48 h-48 text-purple-500" />
           </div>
           <div className="relative z-10">
             <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                 <Rocket className="w-10 h-10 text-purple-400" />
             </div>
             <h2 suppressHydrationWarning className="text-3xl font-extrabold tracking-tight mb-4 drop-shadow-sm">Оценка RAG пока пуста</h2>
             <p className="text-white/60 text-lg mb-8 leading-relaxed">
               В системе пока нет отчетов о качестве генерации.<br/>Перейдите в API Runner, чтобы запустить свой первый тест.
             </p>
             <a href="/runner" className="inline-flex items-center justify-center bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-600/20 px-8 py-4 text-white font-bold w-full rounded-2xl transition-all">
                <Rocket className="w-5 h-5 mr-3" />
                Перейти в API Runner
             </a>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 suppressHydrationWarning className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-sm">
              RAG Quality
            </h1>
            <p className="text-white/80 mt-3 text-lg font-medium">Оценка релевантности и фактологии</p>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-4 no-print">
            {data?.allScans && data.allScans.length > 0 && (
              <div className="w-80">
                <Select value={selectedScan} onValueChange={(val) => val && setSelectedScan(val)}>
                  <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-200 h-auto py-2">
                    {(() => {
                      const lbl = data.allScans.find((s: any) => s.value === activeScan)?.label ?? "Выберите скан";
                      const dotIdx = lbl.indexOf('·');
                      if (dotIdx === -1) return <span className="text-sm">{lbl}</span>;
                      const datePart = lbl.slice(0, dotIdx).trim();
                      const namePart = lbl.slice(dotIdx + 1).trim();
                      return (
                        <div className="text-left min-w-0 overflow-hidden">
                          <div className="text-sm font-medium leading-tight">{datePart}</div>
                          <div className="text-xs text-slate-400 truncate leading-tight">{namePart}</div>
                        </div>
                      );
                    })()}
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    {data.allScans.map((scan: any) => {
                      const dotIdx = scan.label.indexOf('·');
                      if (dotIdx === -1) return <SelectItem key={scan.value} value={scan.value}>{scan.label}</SelectItem>;
                      const datePart = scan.label.slice(0, dotIdx).trim();
                      const namePart = scan.label.slice(dotIdx + 1).trim();
                      return (
                        <SelectItem key={scan.value} value={scan.value}>
                          <div>
                            <div className="text-sm font-medium">{datePart}</div>
                            <div className="text-xs text-slate-400">{namePart}</div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
            {data?.allScans && data.allScans.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => downloadFile('md')}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/40 hover:text-white transition-all text-sm font-medium"
                >
                  <Download className="w-4 h-4" /> Отчёт MD
                </button>
                <button
                  onClick={() => downloadFile('csv')}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/40 border border-slate-600/30 text-slate-300 hover:bg-slate-600/60 hover:text-white transition-all text-sm font-medium"
                >
                  <Download className="w-4 h-4" /> CSV метрики
                </button>
              </div>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6">
          <Card className="bg-white/5 border border-white/10 backdrop-blur-[40px] shadow-2xl rounded-2xl overflow-hidden relative group">
            <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold text-white/90 drop-shadow-sm">Answer Relevancy</CardTitle>
              <LayoutGrid className="h-6 w-6 text-blue-400 drop-shadow-md" />
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-bold text-white tracking-tight drop-shadow-md">{(avgAR * 100).toFixed(1)}%</div>
              <p className="text-[15px] text-white/80 mt-3 font-medium">Релевантность ответов вопросу</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white/5 border border-white/10 backdrop-blur-[40px] shadow-2xl rounded-2xl overflow-hidden relative group">
            <div className="absolute inset-0 bg-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold text-white/90 drop-shadow-sm">Faithfulness</CardTitle>
              <ShieldCheck className="h-6 w-6 text-pink-400 drop-shadow-md" />
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-bold text-white tracking-tight drop-shadow-md">{avgFA !== null ? (avgFA * 100).toFixed(1) + "%" : "—"}</div>
              <p className="text-[15px] text-white/80 mt-3 font-medium">Обоснованность контекстом (RAG)</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border border-white/10 backdrop-blur-[40px] shadow-2xl rounded-2xl overflow-hidden relative group">
            <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold text-white/90 drop-shadow-sm">Ctx Precision</CardTitle>
              <LayoutGrid className="h-6 w-6 text-cyan-400 drop-shadow-md" />
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-bold text-white tracking-tight drop-shadow-md">{avgCP !== null ? (avgCP * 100).toFixed(1) + "%" : "—"}</div>
              <p className="text-[15px] text-white/80 mt-3 font-medium">Точность retrieved чанков</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border border-white/10 backdrop-blur-[40px] shadow-2xl rounded-2xl overflow-hidden relative group">
            <div className="absolute inset-0 bg-violet-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold text-white/90 drop-shadow-sm">Ctx Recall</CardTitle>
              <ShieldCheck className="h-6 w-6 text-violet-400 drop-shadow-md" />
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-bold text-white tracking-tight drop-shadow-md">{avgCR !== null ? (avgCR * 100).toFixed(1) + "%" : "—"}</div>
              <p className="text-[15px] text-white/80 mt-3 font-medium">Охват ожидаемого ответа</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border border-white/10 backdrop-blur-[40px] shadow-2xl rounded-2xl overflow-hidden relative group">
            <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold text-white/90 drop-shadow-sm">Успешно</CardTitle>
              <Activity className="h-6 w-6 text-emerald-400 drop-shadow-md" />
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-bold text-white tracking-tight drop-shadow-md">{passedQueries}</div>
              <p className="text-[15px] text-white/80 mt-3 font-medium">Пройдено по всем метрикам</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border border-white/10 backdrop-blur-[40px] shadow-2xl rounded-2xl overflow-hidden relative group">
            <div className="absolute inset-0 bg-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold text-white/90 drop-shadow-sm">Провалов</CardTitle>
              <AlertTriangle className="h-6 w-6 text-orange-400 drop-shadow-md" />
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-bold text-white tracking-tight drop-shadow-md">{totalQueries - passedQueries}</div>
              <p className="text-[15px] text-white/80 mt-3 font-medium">Вопросов с галлюцинациями</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Logs Accordion */}
        <div className="space-y-4 pt-10">
            <h2 suppressHydrationWarning className="text-2xl font-bold flex items-center gap-3 drop-shadow-sm mb-6">
                <FileText className="w-6 h-6 text-purple-400" /> Детальные ответы модели
            </h2>
            
            <Accordion className="w-full space-y-4">
               {data?.metrics.map((m: any, idx: number) => {
                   const isFail = m.answer_relevancy_passed === false || m.faithfulness_passed === false;
                   return (
                     <AccordionItem value={"item-" + idx} key={idx} className={"border transition-all duration-300 shadow-sm hover:shadow-md " + (isFail ? 'border-red-500/20 bg-red-950/10' : 'border-white/10 bg-white/5 backdrop-blur-xl') + " rounded-2xl px-6"}>
                        <AccordionTrigger className="hover:no-underline py-6 px-2 text-white hover:text-white/80 transition-colors">
                            <div className="flex items-center justify-between w-full pr-4 text-left">
                                <div className="space-y-2">
                                    <p className="font-bold text-lg text-white drop-shadow-sm leading-tight">{m.user_query}</p>
                                    <div className="flex gap-2">
                                        <Badge variant="outline" className="bg-white/10 text-white font-medium border-white/20 px-2 py-0.5 text-sm">{m.category}</Badge>
                                        <Badge variant="outline" className="bg-white/10 text-white font-medium border-white/20 px-2 py-0.5 text-sm">{m.intent}</Badge>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {m.answer_relevancy_score !== null && (
                                        <Badge className={"w-20 justify-center " + (m.answer_relevancy_passed ? 'bg-emerald-900 text-emerald-400' : 'bg-red-900 text-red-400')}>AR: {(m.answer_relevancy_score * 100).toFixed(0)}%</Badge>
                                    )}
                                    {m.faithfulness_score !== null && (
                                        <Badge className={"w-20 justify-center " + (m.faithfulness_passed ? 'bg-pink-900 text-pink-400' : 'bg-orange-900 text-orange-400')}>FA: {(m.faithfulness_score * 100).toFixed(0)}%</Badge>
                                    )}
                                    {m.faithfulness_score === null && (
                                        <Badge variant="outline" className="w-20 justify-center border-slate-800 text-slate-500">FA: N/A</Badge>
                                    )}
                                    {m.contextual_precision_score != null ? (
                                        <Badge className={"w-20 justify-center " + (m.contextual_precision_passed ? 'bg-cyan-900 text-cyan-400' : 'bg-red-900 text-red-400')}>CP: {(m.contextual_precision_score * 100).toFixed(0)}%</Badge>
                                    ) : (
                                        <Badge variant="outline" className="w-20 justify-center border-slate-800 text-slate-500">CP: N/A</Badge>
                                    )}
                                    {m.contextual_recall_score != null ? (
                                        <Badge className={"w-20 justify-center " + (m.contextual_recall_passed ? 'bg-violet-900 text-violet-400' : 'bg-red-900 text-red-400')}>CR: {(m.contextual_recall_score * 100).toFixed(0)}%</Badge>
                                    ) : (
                                        <Badge variant="outline" className="w-20 justify-center border-slate-800 text-slate-500">CR: N/A</Badge>
                                    )}
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-6 space-y-6">
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                               <div className="space-y-2">
                                  <h4 suppressHydrationWarning className="text-sm font-medium text-slate-400">Фактический ответ (Actual)</h4>
                                  <div className="bg-slate-950 p-4 rounded-md text-slate-300 text-sm border border-slate-800">
                                      {m.actual_answer}
                                  </div>
                               </div>
                               {m.expected_answer && (
                                 <div className="space-y-2">
                                    <h4 suppressHydrationWarning className="text-sm font-medium text-slate-400">Ожидаемый ответ (Expected)</h4>
                                    <div className="bg-slate-950 p-4 rounded-md text-slate-300 text-sm border border-slate-800">
                                        {m.expected_answer}
                                    </div>
                                 </div>
                               )}
                            </div>

                            {/* Reasons */}
                            <div className="space-y-3 pt-4 border-t border-slate-800/50">
                                {m.answer_relevancy_reason && (
                                    <div className="text-sm bg-blue-950/30 border border-blue-900/30 p-3 rounded-md text-blue-200">
                                        <span className="font-semibold text-blue-400 mr-2">Судья AR:</span>
                                        {m.answer_relevancy_reason}
                                    </div>
                                )}
                                {m.faithfulness_reason && (
                                    <div className="text-sm bg-pink-950/30 border border-pink-900/30 p-3 rounded-md text-pink-200">
                                        <span className="font-semibold text-pink-400 mr-2">Судья FA:</span>
                                        {m.faithfulness_reason}
                                    </div>
                                )}
                                {m.contextual_precision_reason && (
                                    <div className="text-sm bg-cyan-950/30 border border-cyan-900/30 p-3 rounded-md text-cyan-200">
                                        <span className="font-semibold text-cyan-400 mr-2">Судья CP:</span>
                                        {m.contextual_precision_reason}
                                    </div>
                                )}
                                {m.contextual_recall_reason && (
                                    <div className="text-sm bg-violet-950/30 border border-violet-900/30 p-3 rounded-md text-violet-200">
                                        <span className="font-semibold text-violet-400 mr-2">Судья CR:</span>
                                        {m.contextual_recall_reason}
                                    </div>
                                )}
                            </div>

                            {/* Context */}
                            {m.retrieval_context && m.retrieval_context.length > 0 && (
                                <div className="space-y-2 pt-4">
                                    <h4 suppressHydrationWarning className="text-base font-semibold text-white/90 drop-shadow-sm">Контекст из BZ (Retrieval Context)</h4>
                                    <div className="space-y-3">
                                        {m.retrieval_context.map((ctx: string, cIdx: number) => (
                                            <div key={cIdx} className="bg-white/5 border border-white/10 p-4 rounded-xl text-[15px] font-medium text-white/90 font-mono shadow-inner">
                                                <span className="text-cyan-400 font-bold mr-2">[{cIdx + 1}]</span> 
                                                {ctx.length > 350 ? ctx.substring(0, 350) + '...' : ctx}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </AccordionContent>
                     </AccordionItem>
                   );
               })}
            </Accordion>
        </div>

    </div>
  );
}
