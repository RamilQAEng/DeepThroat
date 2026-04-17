"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ComparisonTab({ allScans }: { allScans: {label: string, value: string}[] }) {
  const [scanA, setScanA] = useState<string>(allScans[1]?.value || allScans[0]?.value);
  const [scanB, setScanB] = useState<string>(allScans[0]?.value);
  const [dataA, setDataA] = useState<any[] | null>(null);
  const [dataB, setDataB] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!scanA || !scanB) return;
    setLoading(true);

    Promise.all([
      fetch("/api/data?scanFile=" + scanA).then(r => r.json()),
      fetch("/api/data?scanFile=" + scanB).then(r => r.json())
    ])
    .then(([resA, resB]) => {
      setDataA(resA.scanData || []);
      setDataB(resB.scanData || []);
      setLoading(false);
    })
    .catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [scanA, scanB]);

  if (allScans.length < 2) {
      return (
          <Card className="bg-white border-[#e5e7eb] text-center py-12">
             <CardContent>
                 <p className="text-[#8e8e93]">Для сравнения нужно минимум 2 скана. Запустите ещё один скан и вернитесь.</p>
             </CardContent>
          </Card>
      );
  }

  // Calculate Deltas
  const rows: any[] = [];
  let improvedCount = 0;
  let worsenedCount = 0;
  let unchangedCount = 0;

  if (dataA && dataB) {
      const mapA: Record<string, number> = {};
      dataA.forEach(r => mapA[r.vulnerability] = r.asr);

      const mapB: Record<string, number> = {};
      dataB.forEach(r => mapB[r.vulnerability] = r.asr);

      const allVulns = Array.from(new Set([...Object.keys(mapA), ...Object.keys(mapB)])).sort();

      allVulns.forEach(v => {
          const asrA = mapA[v] !== undefined ? mapA[v] : null;
          const asrB = mapB[v] !== undefined ? mapB[v] : null;

          let delta = null;
          let trend = "";
          let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "outline";

          if (asrA !== null && asrB !== null) {
              delta = asrB - asrA;
              if (delta < -0.01) {
                  trend = "✅ Улучшилось";
                  improvedCount++;
                  badgeVariant = "default";
              } else if (delta > 0.01) {
                  trend = "🔴 Ухудшилось";
                  worsenedCount++;
                  badgeVariant = "destructive";
              } else {
                  trend = "➡️ Без изменений";
                  unchangedCount++;
                  badgeVariant = "secondary";
              }
          } else if (asrA === null) {
              trend = "🆕 Новый тест";
              badgeVariant = "outline";
          } else {
              trend = "➖ Отсутствует в B";
              badgeVariant = "outline";
          }

          rows.push({
              vulnerability: v,
              asrA,
              asrB,
              delta,
              trend,
              badgeVariant
          });
      });
  }

  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row gap-6">
           <div className="flex-1 space-y-2">
               <label className="text-sm font-medium text-[#45515e]">Скан A (базовый)</label>
               <Select value={scanA} onValueChange={(val) => val && setScanA(val)}>
                 <SelectTrigger className="bg-white border-[#e5e7eb] text-[#222222]">
                   <SelectValue placeholder="Выберите базовый скан" />
                 </SelectTrigger>
                 <SelectContent className="bg-white border-[#e5e7eb] text-[#222222]">
                   {allScans.map(scan => (
                     <SelectItem key={scan.value} value={scan.value}>{scan.label}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
           </div>

           <div className="flex-1 space-y-2">
               <label className="text-sm font-medium text-[#45515e]">Скан B (новый)</label>
               <Select value={scanB} onValueChange={(val) => val && setScanB(val)}>
                 <SelectTrigger className="bg-white border-[#e5e7eb] border-l-[#1456f0] text-[#222222]">
                   <SelectValue placeholder="Выберите новый скан" />
                 </SelectTrigger>
                 <SelectContent className="bg-white border-[#e5e7eb] text-[#222222]">
                   {allScans.map(scan => (
                     <SelectItem key={scan.value} value={scan.value}>{scan.label}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
           </div>
       </div>

       {loading && <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#8e8e93]" /></div>}

       {!loading && dataA && dataB && (
         <>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-white border-[#d1fae5]">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[#059669] text-sm font-medium">Улучшилось</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-[#222222]">{improvedCount}</div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-[#fecaca]">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[#dc2626] text-sm font-medium">Ухудшилось</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-[#222222]">{worsenedCount}</div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-[#e5e7eb]">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[#8e8e93] text-sm font-medium">Без изменений</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-[#222222]">{unchangedCount}</div>
                    </CardContent>
                </Card>
             </div>

             <div className="rounded-md border border-[#e5e7eb]">
                  <Table>
                    <TableHeader className="bg-[#f2f3f5]">
                      <TableRow className="border-[#e5e7eb]">
                        <TableHead className="text-[#45515e] font-bold">Уязвимость</TableHead>
                        <TableHead className="text-[#45515e] font-bold">ASR (Скан A)</TableHead>
                        <TableHead className="text-[#45515e] font-bold">ASR (Скан B)</TableHead>
                        <TableHead className="text-[#45515e] font-bold">Δ Разница</TableHead>
                        <TableHead className="text-[#45515e] font-bold">Итог</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row, i) => (
                             <TableRow key={i} className="border-[#e5e7eb] hover:bg-[#f9fafb]">
                                <TableCell className="font-medium text-[#222222]">{row.vulnerability}</TableCell>
                                <TableCell className="text-[#8e8e93]">{row.asrA !== null ? (row.asrA * 100).toFixed(1) + "%" : "—"}</TableCell>
                                <TableCell className="text-[#222222] font-semibold">{row.asrB !== null ? (row.asrB * 100).toFixed(1) + "%" : "—"}</TableCell>
                                <TableCell className={row.delta !== null ? (row.delta > 0 ? 'text-[#dc2626]' : (row.delta < 0 ? 'text-[#059669]' : 'text-[#8e8e93]')) : 'text-[#8e8e93]'}>
                                    {row.delta !== null ? (row.delta > 0 ? "+" : "") + (row.delta * 100).toFixed(1) + "%" : "—"}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={row.badgeVariant as any} className={row.badgeVariant === "default" ? "bg-[#ecfdf5] text-[#059669] border-[#a7f3d0] hover:bg-[#d1fae5]" : (row.badgeVariant === "destructive" ? "bg-[#fef2f2] text-[#dc2626] border-[#fecaca]" : "")}>{row.trend}</Badge>
                                </TableCell>
                             </TableRow>
                        ))}
                    </TableBody>
                  </Table>
             </div>
         </>
       )}
    </div>
  );
}
