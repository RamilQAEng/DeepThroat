"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, LayoutGrid, AlertTriangle, ShieldCheck, FileText, Download, Rocket, Printer } from "lucide-react";
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

  const activeScan = selectedScan === "latest"
    ? (data?.allScans?.[0]?.value ?? null)
    : selectedScan;

  const downloadFile = (type: "md" | "csv" | "json") => {
    if (!activeScan) return;
    const url = `/api/eval/report?scan=${encodeURIComponent(activeScan)}&type=${type}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `rag_quality_${activeScan}.${type}`;
    a.click();
  };

  const openPdfReport = () => {
    if (typeof window === "undefined") return;
    window.print();
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

      {/* Scan selector + actions */}
      <div className="flex flex-col md:flex-row items-end md:items-center gap-3 no-print">
        {data?.allScans && data.allScans.length > 0 && (
          <div className="w-full md:w-[280px]">
            <Select value={selectedScan} onValueChange={(val) => val && setSelectedScan(val)}>
              <SelectTrigger className="bg-white border-[#e5e7eb] text-[#222222] shadow-[rgba(0,0,0,0.08)_0px_2px_4px] hover:shadow-[rgba(0,0,0,0.12)_0px_4px_8px] transition-all rounded-lg h-11 px-4 font-medium text-sm">
                <SelectValue placeholder="Выберите скан" />
              </SelectTrigger>
              <SelectContent className="bg-white border-[#e5e7eb] text-[#222222] rounded-lg shadow-xl">
                {data.allScans.map((scan: any) => (
                  <SelectItem key={scan.value} value={scan.value} className="rounded-md">{scan.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-[#e5e7eb] bg-white hover:bg-[#f2f3f5] text-[#222222] shadow-[rgba(0,0,0,0.08)_0px_2px_4px] hover:shadow-[rgba(0,0,0,0.12)_0px_4px_8px] transition-all duration-200 rounded-lg px-5 py-2.5 font-medium"
            onClick={() => downloadFile("md")}
          >
            <FileText className="w-4 h-4 mr-2" />
            Отчёт MD
          </Button>
          <Button
            variant="outline"
            className="border-[#e5e7eb] bg-white hover:bg-[#f2f3f5] text-[#222222] shadow-[rgba(0,0,0,0.08)_0px_2px_4px] hover:shadow-[rgba(0,0,0,0.12)_0px_4px_8px] transition-all duration-200 rounded-lg px-5 py-2.5 font-medium"
            onClick={() => downloadFile("csv")}
          >
            <Download className="w-4 h-4 mr-2" />
            CSV метрики
          </Button>
          <Button
            variant="outline"
            className="border-[#e5e7eb] bg-white hover:bg-[#f2f3f5] text-[#222222] shadow-[rgba(0,0,0,0.08)_0px_2px_4px] hover:shadow-[rgba(0,0,0,0.12)_0px_4px_8px] transition-all duration-200 rounded-lg px-5 py-2.5 font-medium"
            onClick={() => downloadFile("json")}
          >
            <Download className="w-4 h-4 mr-2" />
            Логи JSON
          </Button>
          <Button
            variant="default"
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 transition-all duration-200 rounded-lg px-5 py-2.5 font-semibold"
            onClick={openPdfReport}
          >
            <Printer className="w-4 h-4 mr-2" />
            Печать PDF
          </Button>
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
          <div className="bg-[#f2f3f5] rounded-[24px] border border-[#e5e7eb] p-8 shadow-[rgba(0,0,0,0.08)_0px_4px_6px]">
            <h3 className="text-2xl font-bold text-[#222222] mb-4">Сравнение сканов</h3>
            <p className="text-[#45515e] mb-6">Сравнение метрик между разными прогонами тестирования.</p>
          </div>
        </TabsContent>

        {/* Logs */}
        <TabsContent value="logs" className="mt-4">
          <div className="bg-[#f2f3f5] rounded-[24px] border border-[#e5e7eb] p-6 shadow-[rgba(0,0,0,0.08)_0px_4px_6px]">
            <h2 suppressHydrationWarning className="text-2xl font-bold text-[#222222] flex items-center gap-3 drop-shadow-sm mb-6">
              <FileText className="w-6 h-6 text-purple-400" /> Детальные ответы модели
            </h2>

            <Accordion className="w-full space-y-4">
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
