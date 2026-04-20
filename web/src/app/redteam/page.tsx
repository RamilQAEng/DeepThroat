"use client";

import { useEffect, useState, useMemo } from "react";
import { OverallPassratePie, AsrByOwaspBar, PassrateTrendLine } from "@/components/DashboardCharts";
import { LogsTable } from "@/components/LogsTable";
import { ComparisonTab } from "@/components/ComparisonTab";
import { ExportActions } from "@/components/ExportActions";
import { OwaspCategoryPanel } from "@/components/OwaspCategoryPanel";
import { OwaspInfoDialog } from "@/components/OwaspInfoDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getOwaspCategory, OWASPCategory, SEVERITY_WEIGHTS, SEVERITY_BADGE } from "@/lib/owasp";
import { Activity, ShieldCheck, Bug, AlertTriangle, ArrowRight, ShieldAlert, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const [data, setData] = useState<{
    scanData: any[];
    metadata: any;
    historyTrend: any[];
    allScans: any[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedScan, setSelectedScan] = useState("latest");

  const runScan = async () => {
    if (confirm("Вы уверены, что хотите запустить новый скан? Это может занять несколько минут.")) {
        setRunning(true);
        try {
            const res = await fetch('/api/run', { method: 'POST' });
            if (!res.ok) throw new Error("Ошибка запуска");
            const out = await res.json();
            alert(`Скан завершен! Код: ${out.code}`);
            window.location.reload(); // reload to fetch new latest.parquet
        } catch(e: any) {
            alert("Ошибка выполнения: " + e.message);
        } finally {
            setRunning(false);
        }
    }
  };

  useEffect(() => {
    setLoading(true);
    fetch(`/api/data?scanFile=${selectedScan}`)
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

  const { securityScore, totalTests, totalFailed, overallAsr, sortedCats } = useMemo(() => {
    if (!data || !data.scanData || data.scanData.length === 0) {
      return { securityScore: 0, totalTests: 0, totalFailed: 0, overallAsr: 0, sortedCats: [] };
    }

    const { scanData } = data;

    // Aggregates
    const tests = scanData.reduce((acc, curr) => acc + Number(curr.total), 0);
    const failed = scanData.reduce((acc, curr) => acc + Number(curr.failed), 0);
    const asr = tests > 0 ? failed / tests : 0;

    // Security Score
    let scoreNum = 0;
    let weightSum = 0;
    scanData.forEach((row) => {
        const cat = getOwaspCategory(row.vulnerability);
        const weight = SEVERITY_WEIGHTS[cat.severity] || 0.1;
        const passRate = 1.0 - (row.asr || 0);
        scoreNum += passRate * weight;
        weightSum += weight;
    });
    const sScore = weightSum > 0 ? Math.round((scoreNum / weightSum) * 100) : 0;

    // Categories
    const catMap: Record<string, { cat: OWASPCategory, asr: number }> = {};
    scanData.forEach(row => {
      const cat = getOwaspCategory(row.vulnerability);
      if (!catMap[cat.id] || row.asr > catMap[cat.id].asr) {
        catMap[cat.id] = { cat, asr: row.asr };
      }
    });

    const sortedCats = Object.values(catMap).sort((a,b) => b.asr - a.asr);

    return { securityScore: sScore, totalTests: tests, totalFailed: failed, overallAsr: asr, sortedCats };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white text-[#222222]">
        <div className="animate-pulse flex flex-col items-center">
          <ShieldAlert className="w-16 h-16 mb-4 text-emerald-500 animate-bounce" />
          <h2 suppressHydrationWarning className="text-2xl font-bold tracking-tight">Загрузка аналитики...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] bg-transparent text-[#222222] animate-in fade-in zoom-in duration-500">
        <div className="bg-white border border-[#e5e7eb] p-10 rounded-[32px] shadow-[rgba(0,0,0,0.08)_0px_4px_6px] max-w-xl text-center relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-10">
               <ShieldCheck className="w-48 h-48 text-emerald-500" />
           </div>
           <div className="relative z-10">
             <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                 <Zap className="w-10 h-10 text-emerald-400" />
             </div>
             <h2 suppressHydrationWarning className="text-3xl font-extrabold tracking-tight mb-4 drop-shadow-sm">Добро пожаловать в DeepThroath</h2>
             <p className="text-[#8e8e93] text-lg mb-8 leading-relaxed">
               Кажется, у вас еще нет завершенных прогонов Red Teaming.<br/>Запустите тестирование атак, чтобы увидеть аналитику безопасности.
             </p>
             <Button onClick={runScan} disabled={running} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 px-8 py-6 text-lg w-full rounded-2xl">
                {running ? <Loader2 className="w-6 h-6 mr-3 animate-spin" /> : <ShieldCheck className="w-6 h-6 mr-3" />}
                {running ? "Выполнение симуляции..." : "Запустить первый скан"}
             </Button>
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
            <h1 suppressHydrationWarning className="text-5xl font-extrabold tracking-tight text-[#222222] drop-shadow-sm" style={{ fontFamily: "var(--font-outfit, Outfit)" }}>
              DeepThroath
            </h1>
            <p className="text-[#45515e] mt-3 text-lg font-medium">Аналитика безопасности LLM</p>
            <div className="mt-3">
              <OwaspInfoDialog />
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-end md:items-center gap-3 no-print">
            {data?.allScans && data.allScans.length > 0 && (
              <div className="w-full md:w-[220px]">
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

            <ExportActions data={data} />

            <Button
              onClick={runScan}
              disabled={running}
              className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 hover:shadow-xl hover:shadow-indigo-600/30 transition-all duration-200 rounded-lg px-5 py-2.5 h-11 font-semibold whitespace-nowrap"
            >
               {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
               {running ? "Выполнение..." : "Запустить Скан"}
            </Button>
          </div>
        </div>

        {/* Action Bar / Meta */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#f2f3f5] p-5 rounded-2xl border border-[#e5e7eb] flex items-center justify-between shadow-[rgba(0,0,0,0.08)_0px_4px_6px]">
             <span className="text-[#222222] text-base font-semibold drop-shadow-sm">Модель</span>
             <Badge variant="outline" className="text-[#2563eb] border-cyan-400/30 font-semibold py-1.5 px-3 bg-[#eff6ff] text-sm drop-shadow-sm">{data?.metadata?.model_version || 'N/A'}</Badge>
          </div>
          <div className="bg-[#f2f3f5] p-5 rounded-2xl border border-[#e5e7eb] flex items-center justify-between shadow-[rgba(0,0,0,0.08)_0px_4px_6px]">
             <span className="text-[#222222] text-base font-semibold drop-shadow-sm">Судья</span>
             <Badge variant="outline" className="text-[#059669] border-emerald-400/30 font-semibold py-1.5 px-3 bg-[#ecfdf5] text-sm drop-shadow-sm">{data?.metadata?.judge_version || 'N/A'}</Badge>
          </div>
          <div className="bg-[#f2f3f5] p-5 rounded-2xl border border-[#e5e7eb] flex items-center justify-between shadow-[rgba(0,0,0,0.08)_0px_4px_6px]">
             <span className="text-[#222222] text-base font-semibold drop-shadow-sm">Дата</span>
             <Badge variant="outline" className="text-[#7c3aed] border-purple-400/30 font-semibold py-1.5 px-3 bg-[#f5f3ff] text-sm drop-shadow-sm">{data?.metadata?.timestamp?.substring(0, 16).replace('T', ' ') || 'N/A'}</Badge>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-[#f2f3f5] border border-[#e5e7eb] shadow-[rgba(0,0,0,0.08)_0px_4px_6px] rounded-2xl overflow-hidden relative group">
            <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold text-[#222222] drop-shadow-sm">Security Score</CardTitle>
              <ShieldCheck className="h-6 w-6 text-emerald-400 drop-shadow-md" />
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-bold text-[#222222] tracking-tight drop-shadow-md">{securityScore}<span className="text-2xl text-[#8e8e93] font-medium tracking-normal">/100</span></div>
              <p className="text-[15px] text-[#45515e] mt-3 font-medium">Комплексная оценка защищенности</p>
            </CardContent>
          </Card>

          <Card className="bg-[#f2f3f5] border border-[#e5e7eb] shadow-[rgba(0,0,0,0.08)_0px_4px_6px] rounded-2xl overflow-hidden relative group">
            <div className="absolute inset-0 bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold text-[#222222] drop-shadow-sm">Общий ASR</CardTitle>
              <AlertTriangle className="h-6 w-6 text-red-400 drop-shadow-md" />
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-bold text-[#222222] tracking-tight drop-shadow-md">{(overallAsr * 100).toFixed(1)}%</div>
              <p className="text-[15px] text-[#45515e] mt-3 font-medium">Доля успешных атак на систему</p>
            </CardContent>
          </Card>

          <Card className="bg-[#f2f3f5] border border-[#e5e7eb] shadow-[rgba(0,0,0,0.08)_0px_4px_6px] rounded-2xl overflow-hidden relative group">
            <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold text-[#222222] drop-shadow-sm">Всего тестов</CardTitle>
              <Activity className="h-6 w-6 text-blue-400 drop-shadow-md" />
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-bold text-[#222222] tracking-tight drop-shadow-md">{totalTests}</div>
              <p className="text-[15px] text-[#45515e] mt-3 font-medium">Симуляций атак (Red Team)</p>
            </CardContent>
          </Card>

          <Card className="bg-[#f2f3f5] border border-[#e5e7eb] shadow-[rgba(0,0,0,0.08)_0px_4px_6px] rounded-2xl overflow-hidden relative group">
            <div className="absolute inset-0 bg-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold text-[#222222] drop-shadow-sm">Взломано</CardTitle>
              <Bug className="h-6 w-6 text-orange-400 drop-shadow-md" />
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-bold text-[#222222] tracking-tight drop-shadow-md">{totalFailed}</div>
              <p className="text-[15px] text-[#45515e] mt-3 font-medium">Количество успешных пробитий</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs Container */}
        <Tabs defaultValue="overview" className="space-y-8">
            <TabsList className="bg-[#f2f3f5] shadow-inner border border-[#e5e7eb] p-2 rounded-lg gap-2 h-auto">
               <TabsTrigger value="overview" className="px-6 py-3 text-base rounded-md data-[state=active]:bg-white data-[state=active]:text-[#222222] data-[state=active]:shadow-[rgba(0,0,0,0.08)_0px_2px_4px] data-[state=active]:shadow-lg text-[#45515e] hover:text-[#222222] font-medium drop-shadow-sm transition-all">Введение/Обзор</TabsTrigger>
               <TabsTrigger value="owasp" className="px-6 py-3 text-base rounded-md data-[state=active]:bg-white data-[state=active]:text-[#222222] data-[state=active]:shadow-[rgba(0,0,0,0.08)_0px_2px_4px] data-[state=active]:shadow-lg text-[#45515e] hover:text-[#222222] font-medium drop-shadow-sm transition-all">Безопасность по OWASP</TabsTrigger>
               <TabsTrigger value="trend" className="px-6 py-3 text-base rounded-md data-[state=active]:bg-white data-[state=active]:text-[#222222] data-[state=active]:shadow-[rgba(0,0,0,0.08)_0px_2px_4px] data-[state=active]:shadow-lg text-[#45515e] hover:text-[#222222] font-medium drop-shadow-sm transition-all">Тренд Истории</TabsTrigger>
               <TabsTrigger value="comparison" className="px-6 py-3 text-base rounded-md data-[state=active]:bg-white data-[state=active]:text-[#222222] data-[state=active]:shadow-[rgba(0,0,0,0.08)_0px_2px_4px] data-[state=active]:shadow-lg text-[#45515e] hover:text-[#222222] font-medium drop-shadow-sm transition-all">Сравнение Сканов</TabsTrigger>
               <TabsTrigger value="logs" className="px-6 py-3 text-base rounded-md data-[state=active]:bg-white data-[state=active]:text-[#222222] data-[state=active]:shadow-[rgba(0,0,0,0.08)_0px_2px_4px] data-[state=active]:shadow-lg text-[#45515e] hover:text-[#222222] font-medium drop-shadow-sm transition-all">Логи и Детали</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
                  <div className="lg:col-span-1">
                     <div className="bg-[#f2f3f5] rounded-[24px] border border-[#e5e7eb] p-3 shadow-[rgba(0,0,0,0.08)_0px_4px_6px]">
                        <OverallPassratePie df={data?.scanData || []} />
                     </div>
                  </div>
                  <div className="lg:col-span-1">
                    <OwaspCategoryPanel sortedCats={sortedCats} />
                  </div>
              </div>
            </TabsContent>

            <TabsContent value="owasp" className="mt-4">
              <div className="bg-[#f2f3f5] rounded-[24px] border border-[#e5e7eb] p-3 shadow-[rgba(0,0,0,0.08)_0px_4px_6px]">
                  <AsrByOwaspBar df={data?.scanData || []} />
              </div>
            </TabsContent>

            <TabsContent value="trend" className="mt-4">
              <div className="bg-[#f2f3f5] rounded-[24px] border border-[#e5e7eb] p-3 shadow-[rgba(0,0,0,0.08)_0px_4px_6px]">
                 <PassrateTrendLine history={data?.historyTrend || []} />
              </div>
            </TabsContent>

            <TabsContent value="comparison" className="mt-4">
               <div className="bg-[#f2f3f5] rounded-[24px] border border-[#e5e7eb] p-8 shadow-[rgba(0,0,0,0.08)_0px_4px_6px]">
                 <ComparisonTab allScans={data?.allScans || []} />
               </div>
            </TabsContent>

            <TabsContent value="logs" className="mt-4">
               <div className="bg-[#f2f3f5] rounded-[24px] border border-[#e5e7eb] p-6 shadow-[rgba(0,0,0,0.08)_0px_4px_6px]">
                  <LogsTable data={data?.scanData || []} />
               </div>
            </TabsContent>

        </Tabs>
      </div>
  );
}
