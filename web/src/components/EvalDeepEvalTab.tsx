"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, LayoutGrid, AlertTriangle, ShieldCheck, FileText, Download, Rocket, Printer, ArrowUp, ArrowDown, Minus, GitCompare } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function EvalDeepEvalTab() {
  const [data, setData] = useState<{
    metrics: any[];
    allScans: any[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedScan, setSelectedScan] = useState("latest");

  // Comparison state
  const [cmpScanA, setCmpScanA] = useState<string>("");
  const [cmpScanB, setCmpScanB] = useState<string>("");
  const [cmpData, setCmpData] = useState<any | null>(null);
  const [cmpLoading, setCmpLoading] = useState(false);
  const [cmpError, setCmpError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const activeScan = selectedScan === "latest"
    ? (data?.allScans?.[0]?.value ?? null)
    : selectedScan;

  const downloadFile = (type: "md" | "csv" | "json") => {
    if (!activeScan) return;
    const url = `/api/eval/report?scan=${encodeURIComponent(activeScan)}&type=${type}`;
    
    // Use fetch + blob for more reliable downloads in Chrome/Safari
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Ошибки при скачивании: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `${activeScan}_report.${type}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
      })
      .catch((err) => alert(`Не удалось скачать файл: ${err.message}`));
  };

  const exportPdf = () => {
    if (!activeScan) return;
    setPdfLoading(true);
    fetch(`/api/eval/export-html?scan=${encodeURIComponent(activeScan)}`)
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error((json as any).error || `HTTP ${res.status}`);
        }
        return res.text();
      })
      .then((html) => {
        // Open in new window for printing (like Red Team reports)
        const w = window.open("", "_blank");
        if (w) {
          w.document.write(html);
          w.document.close();
        }
      })
      .catch((err) => alert(`HTML export failed: ${err instanceof Error ? err.message : String(err)}`))
      .finally(() => setPdfLoading(false));
  };

  const runComparison = () => {
    if (!cmpScanA || !cmpScanB) return;
    setCmpLoading(true);
    setCmpError(null);
    setCmpData(null);
    fetch(`/api/eval/compare?scan1=${encodeURIComponent(cmpScanA)}&scan2=${encodeURIComponent(cmpScanB)}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "HTTP " + res.status);
        return json;
      })
      .then((json) => { setCmpData(json); setCmpLoading(false); })
      .catch((err) => { setCmpError(err.message); setCmpLoading(false); });
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
        // Если выбран "latest", автоматически ставим id самого свежего скана
        if (selectedScan === "latest" && json.allScans?.length > 0) {
          setSelectedScan(json.allScans[0].value);
        }
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
    const avgAR = arValues.length ? arValues.reduce((a: number, b: number) => a + b, 0) / arValues.length : 0;

    const faValues = metrics.filter(m => m.faithfulness_score !== null).map(m => m.faithfulness_score);
    const avgFA: number | null = faValues.length ? faValues.reduce((a: number, b: number) => a + b, 0) / faValues.length : null;

    const cpValues = metrics.filter(m => m.contextual_precision_score != null).map(m => m.contextual_precision_score);
    const avgCP: number | null = cpValues.length ? cpValues.reduce((a: number, b: number) => a + b, 0) / cpValues.length : null;

    const crValues = metrics.filter(m => m.contextual_recall_score != null).map(m => m.contextual_recall_score);
    const avgCR: number | null = crValues.length ? crValues.reduce((a: number, b: number) => a + b, 0) / crValues.length : null;

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
      <div className="flex items-center justify-center min-h-[40vh] text-[#222222]">
        <div className="animate-pulse flex flex-col items-center">
          <Activity className="w-16 h-16 mb-4 text-purple-500 animate-spin" />
          <h2 suppressHydrationWarning className="text-2xl font-bold tracking-tight">Загрузка RAG-метрик...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] bg-transparent text-[#222222] animate-in fade-in zoom-in duration-500">
        <div className="bg-white border border-[#e5e7eb] p-10 rounded-[32px] shadow-[rgba(0,0,0,0.08)_0px_4px_6px] max-w-xl text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Activity className="w-48 h-48 text-purple-500" />
          </div>
          <div className="relative z-10">
            <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Rocket className="w-10 h-10 text-purple-400" />
            </div>
            <h2 suppressHydrationWarning className="text-3xl font-extrabold tracking-tight mb-4 drop-shadow-sm">Оценка RAG пока пуста</h2>
            <p className="text-[#8e8e93] text-lg mb-8 leading-relaxed">
              В системе пока нет отчетов о качестве генерации.<br />Перейдите в API Runner, чтобы запустить свой первый тест.
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
      {/* Header + Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 no-print">
        <div>
          <h1
            suppressHydrationWarning
            className="text-5xl font-extrabold tracking-tight text-[#222222] drop-shadow-sm"
            style={{ fontFamily: "var(--font-outfit, Outfit)" }}
          >
            RAG Quality
          </h1>
          <p className="text-[#45515e] mt-2 text-lg font-medium opacity-80">
            Оценка релевантности и фактологии
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-end md:items-center gap-3 pt-2">
          {data?.allScans && data.allScans.length > 0 && (
            <div className="w-full md:w-[240px]">
              <Select value={selectedScan} onValueChange={(val) => val && setSelectedScan(val)}>
                <SelectTrigger className="bg-white border-[#e5e7eb] text-[#222222] shadow-sm hover:shadow-md transition-all rounded-xl h-11 px-4 font-medium text-sm">
                  <SelectValue placeholder="Последний скан" />
                </SelectTrigger>
                <SelectContent className="bg-white border-[#e5e7eb] text-[#222222] rounded-xl shadow-xl">
                  {data.allScans.map((scan: any) => (
                    <SelectItem key={scan.value} value={scan.value} className="rounded-md">{scan.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-[#e5e7eb] bg-white hover:bg-[#f2f3f5] text-[#222222] shadow-sm transition-all rounded-xl px-4 h-11 font-medium"
              onClick={() => downloadFile("md")}
            >
              <FileText className="w-4 h-4 mr-2" />
              Отчёт MD
            </Button>
            <Button
              variant="outline"
              className="border-[#e5e7eb] bg-white hover:bg-[#f2f3f5] text-[#222222] shadow-sm transition-all rounded-xl px-4 h-11 font-medium"
              onClick={() => downloadFile("csv")}
            >
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button
              variant="outline"
              className="border-[#e5e7eb] bg-white hover:bg-[#f2f3f5] text-[#222222] shadow-sm transition-all rounded-xl px-4 h-11 font-medium"
              onClick={() => downloadFile("json")}
            >
              <Download className="w-4 h-4 mr-2" />
              Логи
            </Button>
            <Button
              variant="default"
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all rounded-xl px-5 h-11 font-semibold disabled:opacity-50"
              onClick={exportPdf}
              disabled={pdfLoading || !activeScan}
            >
              <Printer className="w-4 h-4 mr-2" />
              {pdfLoading ? "…" : "Печать PDF"}
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6">
        <Card className="bg-white border border-[#e5e7eb] shadow-[rgba(0,0,0,0.08)_0px_4px_6px] rounded-2xl overflow-hidden relative group">
          <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold text-[#222222] drop-shadow-sm">Answer Relevancy</CardTitle>
            <LayoutGrid className="h-6 w-6 text-blue-400 drop-shadow-md" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-[#222222] tracking-tight drop-shadow-md">{(avgAR * 100).toFixed(1)}%</div>
            <p className="text-[15px] text-[#45515e] mt-3 font-medium">Релевантность ответов вопросу</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-[#e5e7eb] shadow-[rgba(0,0,0,0.08)_0px_4px_6px] rounded-2xl overflow-hidden relative group">
          <div className="absolute inset-0 bg-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold text-[#222222] drop-shadow-sm">Faithfulness</CardTitle>
            <ShieldCheck className="h-6 w-6 text-pink-400 drop-shadow-md" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-[#222222] tracking-tight drop-shadow-md">{avgFA !== null ? (avgFA * 100).toFixed(1) + "%" : "—"}</div>
            <p className="text-[15px] text-[#45515e] mt-3 font-medium">Обоснованность контекстом (RAG)</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-[#e5e7eb] shadow-[rgba(0,0,0,0.08)_0px_4px_6px] rounded-2xl overflow-hidden relative group">
          <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold text-[#222222] drop-shadow-sm">Ctx Precision</CardTitle>
            <LayoutGrid className="h-6 w-6 text-cyan-400 drop-shadow-md" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-[#222222] tracking-tight drop-shadow-md">{avgCP !== null ? (avgCP * 100).toFixed(1) + "%" : "—"}</div>
            <p className="text-[15px] text-[#45515e] mt-3 font-medium">Точность retrieved чанков</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-[#e5e7eb] shadow-[rgba(0,0,0,0.08)_0px_4px_6px] rounded-2xl overflow-hidden relative group">
          <div className="absolute inset-0 bg-violet-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold text-[#222222] drop-shadow-sm">Ctx Recall</CardTitle>
            <ShieldCheck className="h-6 w-6 text-violet-400 drop-shadow-md" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-[#222222] tracking-tight drop-shadow-md">{avgCR !== null ? (avgCR * 100).toFixed(1) + "%" : "—"}</div>
            <p className="text-[15px] text-[#45515e] mt-3 font-medium">Охват ожидаемого ответа</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-[#e5e7eb] shadow-[rgba(0,0,0,0.08)_0px_4px_6px] rounded-2xl overflow-hidden relative group">
          <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold text-[#222222] drop-shadow-sm">Успешно</CardTitle>
            <Activity className="h-6 w-6 text-emerald-400 drop-shadow-md" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-[#222222] tracking-tight drop-shadow-md">{passedQueries}</div>
            <p className="text-[15px] text-[#45515e] mt-3 font-medium">Пройдено по всем метрикам</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-[#e5e7eb] shadow-[rgba(0,0,0,0.08)_0px_4px_6px] rounded-2xl overflow-hidden relative group">
          <div className="absolute inset-0 bg-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold text-[#222222] drop-shadow-sm">Провалов</CardTitle>
            <AlertTriangle className="h-6 w-6 text-orange-400 drop-shadow-md" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-[#222222] tracking-tight drop-shadow-md">{totalQueries - passedQueries}</div>
            <p className="text-[15px] text-[#45515e] mt-3 font-medium">Вопросов с галлюцинациями</p>
          </CardContent>
        </Card>
      </div>

      {/* Inner tabs */}
      <Tabs defaultValue="overview" className="space-y-8">
        <TabsList className="bg-[#f2f3f5] shadow-inner border border-[#e5e7eb] p-2 rounded-lg gap-2 h-auto">
          <TabsTrigger value="overview" className="px-6 py-3 text-base rounded-md data-[state=active]:bg-white data-[state=active]:text-[#222222] data-[state=active]:shadow-[rgba(0,0,0,0.08)_0px_2px_4px] text-[#45515e] hover:text-[#222222] font-medium transition-all">Обзор метрик</TabsTrigger>
          <TabsTrigger value="categories" className="px-6 py-3 text-base rounded-md data-[state=active]:bg-white data-[state=active]:text-[#222222] data-[state=active]:shadow-[rgba(0,0,0,0.08)_0px_2px_4px] text-[#45515e] hover:text-[#222222] font-medium transition-all">Категории метрик</TabsTrigger>
          <TabsTrigger value="trend" className="px-6 py-3 text-base rounded-md data-[state=active]:bg-white data-[state=active]:text-[#222222] data-[state=active]:shadow-[rgba(0,0,0,0.08)_0px_2px_4px] text-[#45515e] hover:text-[#222222] font-medium transition-all">Тренд истории</TabsTrigger>
          <TabsTrigger value="comparison" className="px-6 py-3 text-base rounded-md data-[state=active]:bg-white data-[state=active]:text-[#222222] data-[state=active]:shadow-[rgba(0,0,0,0.08)_0px_2px_4px] text-[#45515e] hover:text-[#222222] font-medium transition-all">Сравнение сканов</TabsTrigger>
          <TabsTrigger value="logs" className="px-6 py-3 text-base rounded-md data-[state=active]:bg-white data-[state=active]:text-[#222222] data-[state=active]:shadow-[rgba(0,0,0,0.08)_0px_2px_4px] text-[#45515e] hover:text-[#222222] font-medium transition-all">Детали и логи</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <div className="bg-[#f2f3f5] rounded-[24px] border border-[#e5e7eb] p-8 shadow-[rgba(0,0,0,0.08)_0px_4px_6px]">
            <h3 className="text-2xl font-bold text-[#222222] mb-6">Общая статистика тестирования</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-white border-[#e5e7eb]">
                <CardHeader>
                  <CardTitle className="text-lg text-[#222222]">Сводка по метрикам</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-[#e5e7eb]">
                    <span className="text-[#45515e] font-medium">Всего вопросов:</span>
                    <span className="text-2xl font-bold text-[#222222]">{totalQueries}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-[#e5e7eb]">
                    <span className="text-[#45515e] font-medium">Успешно пройдено:</span>
                    <span className="text-2xl font-bold text-emerald-600">{passedQueries}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-[#e5e7eb]">
                    <span className="text-[#45515e] font-medium">Провалено:</span>
                    <span className="text-2xl font-bold text-orange-600">{totalQueries - passedQueries}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#45515e] font-medium">Общий процент успеха:</span>
                    <span className="text-2xl font-bold text-[#222222]">{totalQueries > 0 ? ((passedQueries / totalQueries) * 100).toFixed(1) : 0}%</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-[#e5e7eb]">
                <CardHeader>
                  <CardTitle className="text-lg text-[#222222]">Распределение по метрикам</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(() => {
                      const arPassed = data?.metrics.filter((m: any) => m.answer_relevancy_passed === true).length || 0;
                      const arFailed = data?.metrics.filter((m: any) => m.answer_relevancy_passed === false).length || 0;
                      const faPassed = data?.metrics.filter((m: any) => m.faithfulness_passed === true).length || 0;
                      const faFailed = data?.metrics.filter((m: any) => m.faithfulness_passed === false).length || 0;
                      return (
                        <>
                          <div className="flex justify-between items-center py-2 border-b border-[#e5e7eb]">
                            <span className="text-[#45515e] font-medium">AR прошло:</span>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-[#ecfdf5] text-[#059669]">{arPassed}</Badge>
                              <span className="text-[#8e8e93]">/</span>
                              <Badge className="bg-[#fef2f2] text-[#dc2626]">{arFailed}</Badge>
                            </div>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-[#e5e7eb]">
                            <span className="text-[#45515e] font-medium">FA прошло:</span>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-[#fdf2f8] text-[#be185d]">{faPassed}</Badge>
                              <span className="text-[#8e8e93]">/</span>
                              <Badge className="bg-[#fff7ed] text-[#c2410c]">{faFailed}</Badge>
                            </div>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-[#45515e] font-medium">Средний AR:</span>
                            <span className="text-lg font-semibold text-[#222222]">{(avgAR * 100).toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-[#45515e] font-medium">Средний FA:</span>
                            <span className="text-lg font-semibold text-[#222222]">{avgFA !== null ? (avgFA * 100).toFixed(1) + "%" : "—"}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Categories */}
        <TabsContent value="categories">
          <div className="bg-[#f2f3f5] rounded-[24px] border border-[#e5e7eb] p-8 shadow-[rgba(0,0,0,0.08)_0px_4px_6px]">
            <h3 className="text-2xl font-bold text-[#222222] mb-6">Описания метрик RAG Quality</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-white border-[#bfdbfe]">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <LayoutGrid className="w-5 h-5 text-blue-600" />
                    </div>
                    <CardTitle className="text-lg text-[#222222]">Answer Relevancy (AR)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-[#45515e] text-sm leading-relaxed"><strong>Что измеряет:</strong> Насколько ответ модели релевантен заданному вопросу.</p>
                  <p className="text-[#45515e] text-sm leading-relaxed"><strong>Как работает:</strong> Анализирует соответствие ответа теме и контексту вопроса, игнорируя лишнюю информацию.</p>
                  <p className="text-[#45515e] text-sm leading-relaxed"><strong>Хороший результат:</strong> {"> 80%"} — ответ точно отвечает на вопрос без отклонений.</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-[#fbcfe8]">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-pink-600" />
                    </div>
                    <CardTitle className="text-lg text-[#222222]">Faithfulness (FA)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-[#45515e] text-sm leading-relaxed"><strong>Что измеряет:</strong> Обоснованность ответа предоставленным контекстом (RAG).</p>
                  <p className="text-[#45515e] text-sm leading-relaxed"><strong>Как работает:</strong> Проверяет, что все утверждения в ответе подтверждаются документами из базы знаний.</p>
                  <p className="text-[#45515e] text-sm leading-relaxed"><strong>Хороший результат:</strong> {"> 90%"} — нет галлюцинаций, ответ основан на фактах.</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-[#a5f3fc]">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
                      <LayoutGrid className="w-5 h-5 text-cyan-600" />
                    </div>
                    <CardTitle className="text-lg text-[#222222]">Contextual Precision (CP)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-[#45515e] text-sm leading-relaxed"><strong>Что измеряет:</strong> Точность подобранных чанков из базы знаний.</p>
                  <p className="text-[#45515e] text-sm leading-relaxed"><strong>Как работает:</strong> Оценивает, насколько релевантные документы находятся в топе результатов поиска.</p>
                  <p className="text-[#45515e] text-sm leading-relaxed"><strong>Хороший результат:</strong> {"> 70%"} — система retrieval работает эффективно.</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-[#ddd6fe]">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-violet-600" />
                    </div>
                    <CardTitle className="text-lg text-[#222222]">Contextual Recall (CR)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-[#45515e] text-sm leading-relaxed"><strong>Что измеряет:</strong> Полнота охвата ожидаемого ответа найденным контекстом.</p>
                  <p className="text-[#45515e] text-sm leading-relaxed"><strong>Как работает:</strong> Проверяет, что все необходимые факты для ответа присутствуют в извлеченных документах.</p>
                  <p className="text-[#45515e] text-sm leading-relaxed"><strong>Хороший результат:</strong> {"> 75%"} — ничего важного не упущено при поиске.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Trend */}
        <TabsContent value="trend">
          <div className="bg-[#f2f3f5] rounded-[24px] border border-[#e5e7eb] p-8 shadow-[rgba(0,0,0,0.08)_0px_4px_6px]">
            <h3 className="text-2xl font-bold text-[#222222] mb-4">Тренд истории</h3>
            <p className="text-[#45515e] mb-6">График изменения метрик качества во времени.</p>
          </div>
        </TabsContent>

        {/* Comparison */}
        <TabsContent value="comparison">
          <div className="space-y-6">
            {/* Scan selectors */}
            <div className="bg-[#f2f3f5] rounded-[24px] border border-[#e5e7eb] p-6 shadow-[rgba(0,0,0,0.08)_0px_4px_6px]">
              <h3 className="text-2xl font-bold text-[#222222] mb-2 flex items-center gap-2">
                <GitCompare className="w-6 h-6 text-purple-400" /> Сравнение сканов
              </h3>
              <p className="text-[#45515e] mb-6 text-sm">Выберите два прогона — увидите дельту по каждой метрике и поперстроечное сравнение.</p>
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wide">Скан A (базовый)</label>
                  <Select value={cmpScanA} onValueChange={setCmpScanA}>
                    <SelectTrigger className="bg-white border-[#e5e7eb] text-[#222222] h-11 rounded-lg text-sm font-medium">
                      <SelectValue placeholder="Выберите скан A" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-[#e5e7eb] text-[#222222] rounded-lg shadow-xl">
                      {(data?.allScans ?? []).map((s: any) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wide">Скан B (новый)</label>
                  <Select value={cmpScanB} onValueChange={setCmpScanB}>
                    <SelectTrigger className="bg-white border-[#e5e7eb] text-[#222222] h-11 rounded-lg text-sm font-medium">
                      <SelectValue placeholder="Выберите скан B" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-[#e5e7eb] text-[#222222] rounded-lg shadow-xl">
                      {(data?.allScans ?? []).map((s: any) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={runComparison}
                  disabled={!cmpScanA || !cmpScanB || cmpLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-6 h-11 font-semibold shadow-md shadow-purple-600/20 transition-all"
                >
                  {cmpLoading ? <Activity className="w-4 h-4 animate-spin mr-2" /> : <GitCompare className="w-4 h-4 mr-2" />}
                  {cmpLoading ? "Сравниваем..." : "Сравнить"}
                </Button>
              </div>
            </div>

            {/* Error */}
            {cmpError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{cmpError}</div>
            )}

            {/* Results */}
            {cmpData && (() => {
              const { summary_a, summary_b, summary_delta, rows } = cmpData;
              const METRIC_LABELS: Record<string, string> = {
                answer_relevancy_score: "Answer Relevancy",
                faithfulness_score: "Faithfulness",
                contextual_precision_score: "Ctx Precision",
                contextual_recall_score: "Ctx Recall",
              };
              const METRIC_COLORS: Record<string, string> = {
                answer_relevancy_score: "text-blue-600",
                faithfulness_score: "text-pink-600",
                contextual_precision_score: "text-cyan-600",
                contextual_recall_score: "text-violet-600",
              };

              const DeltaBadge = ({ val }: { val: number | null }) => {
                if (val === null) return <span className="text-[#8e8e93] text-sm">—</span>;
                const pct = (val * 100).toFixed(1);
                if (Math.abs(val) < 0.005) return <span className="flex items-center gap-1 text-[#8e8e93] text-sm font-medium"><Minus className="w-3 h-3" />{pct}%</span>;
                if (val > 0) return <span className="flex items-center gap-1 text-emerald-600 text-sm font-semibold"><ArrowUp className="w-3 h-3" />+{pct}%</span>;
                return <span className="flex items-center gap-1 text-red-500 text-sm font-semibold"><ArrowDown className="w-3 h-3" />{pct}%</span>;
              };

              return (
                <div className="space-y-6">
                  {/* Summary table */}
                  <div className="bg-[#f2f3f5] rounded-[24px] border border-[#e5e7eb] p-6 shadow-[rgba(0,0,0,0.08)_0px_4px_6px] overflow-x-auto">
                    <h4 className="text-lg font-bold text-[#222222] mb-4">Сводка по метрикам</h4>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#e5e7eb]">
                          <th className="text-left py-2 pr-4 font-semibold text-[#8e8e93]">Метрика</th>
                          <th className="text-center py-2 px-4 font-semibold text-[#45515e]">Скан A</th>
                          <th className="text-center py-2 px-4 font-semibold text-[#45515e]">Скан B</th>
                          <th className="text-center py-2 px-4 font-semibold text-[#45515e]">Дельта</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(cmpData.score_keys as string[]).map((key) => {
                          const va: number | null = summary_a.avg[key];
                          const vb: number | null = summary_b.avg[key];
                          const vd: number | null = summary_delta[key];
                          return (
                            <tr key={key} className="border-b border-[#e5e7eb] last:border-0">
                              <td className={`py-3 pr-4 font-semibold ${METRIC_COLORS[key] ?? "text-[#222222]"}`}>{METRIC_LABELS[key] ?? key}</td>
                              <td className="py-3 px-4 text-center font-mono text-[#222222]">{va !== null ? (va * 100).toFixed(1) + "%" : "—"}</td>
                              <td className="py-3 px-4 text-center font-mono text-[#222222]">{vb !== null ? (vb * 100).toFixed(1) + "%" : "—"}</td>
                              <td className="py-3 px-4 text-center"><DeltaBadge val={vd} /></td>
                            </tr>
                          );
                        })}
                        <tr className="bg-white/60">
                          <td className="py-3 pr-4 font-semibold text-[#222222]">Пройдено</td>
                          <td className="py-3 px-4 text-center font-semibold text-[#222222]">{summary_a.passed}/{summary_a.total}</td>
                          <td className="py-3 px-4 text-center font-semibold text-[#222222]">{summary_b.passed}/{summary_b.total}</td>
                          <td className="py-3 px-4 text-center">
                            <DeltaBadge val={summary_a.total > 0 ? (summary_b.passed / summary_b.total) - (summary_a.passed / summary_a.total) : null} />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Per-row diff */}
                  <div className="bg-[#f2f3f5] rounded-[24px] border border-[#e5e7eb] p-6 shadow-[rgba(0,0,0,0.08)_0px_4px_6px]">
                    <h4 className="text-lg font-bold text-[#222222] mb-4">Поперстроечное сравнение</h4>
                    <div className="space-y-3">
                      {(rows as any[]).map((row, idx) => {
                        const hasDelta = Object.values(row.delta as Record<string, number | null>).some(
                          (v) => v !== null && Math.abs(v as number) >= 0.005
                        );
                        const improved = Object.values(row.delta as Record<string, number | null>).filter(
                          (v) => v !== null && (v as number) > 0.005
                        ).length;
                        const degraded = Object.values(row.delta as Record<string, number | null>).filter(
                          (v) => v !== null && (v as number) < -0.005
                        ).length;
                        const borderColor = degraded > 0 ? "border-red-200" : improved > 0 ? "border-emerald-200" : "border-[#e5e7eb]";
                        const bgColor = degraded > 0 ? "bg-red-50" : improved > 0 ? "bg-emerald-50/50" : "bg-white";
                        return (
                          <div key={idx} className={`${bgColor} ${borderColor} border rounded-xl p-4`}>
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Badge variant="outline" className="bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe] font-bold text-xs shrink-0">{row.id}</Badge>
                                <p className="text-sm font-medium text-[#222222] truncate">{row.query}</p>
                              </div>
                              {!hasDelta && <Badge variant="outline" className="text-[#8e8e93] border-[#e5e7eb] text-xs shrink-0">без изменений</Badge>}
                            </div>
                            <div className="flex flex-wrap gap-3">
                              {(cmpData.score_keys as string[]).map((key) => {
                                const va: number | null = row.scores_a[key];
                                const vb: number | null = row.scores_b[key];
                                const vd: number | null = row.delta[key];
                                if (va === null && vb === null) return null;
                                return (
                                  <div key={key} className="flex items-center gap-1.5 text-xs bg-white/80 rounded-lg px-2 py-1 border border-[#e5e7eb]">
                                    <span className={`font-semibold ${METRIC_COLORS[key] ?? ""}`}>{(METRIC_LABELS[key] ?? key).replace(" ", "\u00A0")}</span>
                                    <span className="text-[#8e8e93]">{va !== null ? (va * 100).toFixed(0) + "%" : "—"}</span>
                                    <span className="text-[#8e8e93]">→</span>
                                    <span className="text-[#222222] font-medium">{vb !== null ? (vb * 100).toFixed(0) + "%" : "—"}</span>
                                    <DeltaBadge val={vd} />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </TabsContent>

        {/* Logs */}
        <TabsContent value="logs" className="mt-4">
          <div className="bg-[#f2f3f5] rounded-[24px] border border-[#e5e7eb] p-6 shadow-[rgba(0,0,0,0.08)_0px_4px_6px]">
            <h2 suppressHydrationWarning className="text-2xl font-bold text-[#222222] flex items-center gap-3 drop-shadow-sm mb-6">
              <FileText className="w-6 h-6 text-purple-400" /> Детальные ответы модели
            </h2>

            <Accordion type="multiple" className="w-full space-y-4">
              {data?.metrics.map((m: any, idx: number) => {
                const isFail = m.answer_relevancy_passed === false || m.faithfulness_passed === false;
                return (
                  <AccordionItem value={"item-" + idx} key={idx} className={"border transition-all duration-300 shadow-sm hover:shadow-md " + (isFail ? "border-red-200 bg-red-50" : "border-[#e5e7eb] bg-white") + " rounded-2xl px-6"}>
                    <AccordionTrigger className="hover:no-underline py-6 px-2 text-[#222222] hover:text-[#45515e] transition-colors">
                      <div className="flex items-center justify-between w-full pr-4 text-left">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe] font-bold px-3 py-1 text-sm">{m.id || `TC-${String(idx + 1).padStart(3, "0")}`}</Badge>
                            <p className="font-bold text-lg text-[#222222] drop-shadow-sm leading-tight">{m.user_query}</p>
                          </div>
                          <div className="flex gap-2">
                            {m.category && <Badge variant="outline" className="bg-[#f2f3f5] text-[#45515e] font-medium border-[#e5e7eb] px-2 py-0.5 text-sm">{m.category}</Badge>}
                            {m.intent && <Badge variant="outline" className="bg-[#f2f3f5] text-[#45515e] font-medium border-[#e5e7eb] px-2 py-0.5 text-sm">{m.intent}</Badge>}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {m.answer_relevancy_score !== null && (
                            <Badge className={"w-20 justify-center " + (m.answer_relevancy_passed ? "bg-[#ecfdf5] text-[#059669]" : "bg-[#fef2f2] text-[#dc2626]")}>AR: {(m.answer_relevancy_score * 100).toFixed(0)}%</Badge>
                          )}
                          {m.faithfulness_score !== null && (
                            <Badge className={"w-20 justify-center " + (m.faithfulness_passed ? "bg-[#fdf2f8] text-[#be185d]" : "bg-[#fff7ed] text-[#c2410c]")}>FA: {(m.faithfulness_score * 100).toFixed(0)}%</Badge>
                          )}
                          {m.faithfulness_score === null && (
                            <Badge variant="outline" className="w-20 justify-center border-[#e5e7eb] text-[#8e8e93]">FA: N/A</Badge>
                          )}
                          {m.contextual_precision_score != null ? (
                            <Badge className={"w-20 justify-center " + (m.contextual_precision_passed ? "bg-[#ecfeff] text-[#0e7490]" : "bg-[#fef2f2] text-[#dc2626]")}>CP: {(m.contextual_precision_score * 100).toFixed(0)}%</Badge>
                          ) : (
                            <Badge variant="outline" className="w-20 justify-center border-[#e5e7eb] text-[#8e8e93]">CP: N/A</Badge>
                          )}
                          {m.contextual_recall_score != null ? (
                            <Badge className={"w-20 justify-center " + (m.contextual_recall_passed ? "bg-[#f5f3ff] text-[#6d28d9]" : "bg-[#fef2f2] text-[#dc2626]")}>CR: {(m.contextual_recall_score * 100).toFixed(0)}%</Badge>
                          ) : (
                            <Badge variant="outline" className="w-20 justify-center border-[#e5e7eb] text-[#8e8e93]">CR: N/A</Badge>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-6 space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <h4 suppressHydrationWarning className="text-sm font-medium text-[#8e8e93]">Фактический ответ (Actual)</h4>
                          <div className="bg-[#f2f3f5] p-4 rounded-md text-[#45515e] text-sm border border-[#e5e7eb]">{m.actual_answer}</div>
                        </div>
                        {m.expected_answer && (
                          <div className="space-y-2">
                            <h4 suppressHydrationWarning className="text-sm font-medium text-[#8e8e93]">Ожидаемый ответ (Expected)</h4>
                            <div className="bg-[#f2f3f5] p-4 rounded-md text-[#45515e] text-sm border border-[#e5e7eb]">{m.expected_answer}</div>
                          </div>
                        )}
                      </div>
                      <div className="space-y-3 pt-4 border-t border-[#e5e7eb]">
                        {m.answer_relevancy_reason && (
                          <div className="text-sm bg-[#eff6ff] border border-[#bfdbfe] p-3 rounded-md text-[#1d4ed8]">
                            <span className="font-semibold text-[#2563eb] mr-2">Судья AR:</span>{m.answer_relevancy_reason}
                          </div>
                        )}
                        {m.faithfulness_reason && (
                          <div className="text-sm bg-[#fdf2f8] border border-[#fbcfe8] p-3 rounded-md text-[#be185d]">
                            <span className="font-semibold text-[#db2777] mr-2">Судья FA:</span>{m.faithfulness_reason}
                          </div>
                        )}
                        {m.contextual_precision_reason && (
                          <div className="text-sm bg-[#ecfeff] border border-[#a5f3fc] p-3 rounded-md text-[#0e7490]">
                            <span className="font-semibold text-[#0891b2] mr-2">Судья CP:</span>{m.contextual_precision_reason}
                          </div>
                        )}
                        {m.contextual_recall_reason && (
                          <div className="text-sm bg-[#f5f3ff] border border-[#ddd6fe] p-3 rounded-md text-[#6d28d9]">
                            <span className="font-semibold text-[#7c3aed] mr-2">Судья CR:</span>{m.contextual_recall_reason}
                          </div>
                        )}
                      </div>
                      {m.retrieval_context && m.retrieval_context.length > 0 && (
                        <div className="space-y-2 pt-4">
                          <h4 suppressHydrationWarning className="text-base font-semibold text-[#222222] drop-shadow-sm">Контекст из BZ (Retrieval Context)</h4>
                          <div className="space-y-3">
                            {m.retrieval_context.map((ctx: string, cIdx: number) => (
                              <div key={cIdx} className="bg-[#f2f3f5] border border-[#e5e7eb] p-4 rounded-xl text-[15px] font-medium text-[#222222] font-mono shadow-inner">
                                <span className="text-cyan-400 font-bold mr-2">[{cIdx + 1}]</span>
                                {ctx.length > 350 ? ctx.substring(0, 350) + "..." : ctx}
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
        </TabsContent>
      </Tabs>

    </div>
  );
}
