"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SEVERITY_BADGE } from '@/lib/owasp';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LogsTable({ data }: { data: any[] }) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const toggleRow = (index: number) => {
    setExpandedRow(expandedRow === index ? null : index);
  };

  if (!data || data.length === 0) return null;

  return (
    <div className="bg-transparent border-0 shadow-none w-full">
      <div className="mb-6">
        <h2 suppressHydrationWarning className="text-2xl font-bold text-white drop-shadow-sm">Логи атак и уязвимостей</h2>
        <p className="text-white/70 text-base mt-2">Детальный отчет по каждому протестированному вектору атак.</p>
      </div>
      <div>
        <div className="rounded-2xl border border-white/10 hidden md:block overflow-x-auto bg-white/5 backdrop-blur-xl">
          <Table className="w-full relative">
            <TableHeader className="bg-black/20">
              <TableRow className="border-white/10 hover:bg-white/5">
                <TableHead className="text-white/80 font-bold">Критичность</TableHead>
                <TableHead className="text-white/80 font-bold">OWASP ID</TableHead>
                <TableHead className="text-white/80 font-bold">Уязвимость</TableHead>
                <TableHead className="text-white/80 font-bold">Метод атаки</TableHead>
                <TableHead className="text-white/80 font-bold">Взлом (ASR)</TableHead>
                <TableHead className="text-right text-white/80 font-bold">Детали</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, index) => {
                const asr = row.asr || 0;
                const convs = typeof row.conversations === 'string' ? JSON.parse(row.conversations || "[]") : (row.conversations || []);
                const hasConvs = convs.length > 0;

                return (
                  <React.Fragment key={index}>
                    <TableRow className={`border-white/5 transition-colors cursor-pointer group ${expandedRow === index ? 'bg-white/10' : 'hover:bg-white/5'}`} onClick={() => toggleRow(index)}>
                      <TableCell>
                        <Badge variant="outline" className={`${asr > 0.2 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-white/80'} py-1`}>
                           {SEVERITY_BADGE[row.severity] || "⚪"} {row.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-white/60 font-semibold">{row.owasp_id}</TableCell>
                      <TableCell className="font-bold text-white drop-shadow-sm">{row.vulnerability}</TableCell>
                      <TableCell className="text-white/70 font-medium">{row.attack_type}</TableCell>
                      <TableCell>
                        <span className={`text-lg font-bold ${asr > 0 ? (asr > 0.2 ? 'text-red-400' : 'text-orange-400') : 'text-emerald-400'}`}>
                          {(asr * 100).toFixed(1)}%
                        </span>
                        <span className="text-white/40 text-xs ml-2 font-bold">({row.failed}/{row.total})</span>
                      </TableCell>
                      <TableCell className="text-right">
                        {hasConvs && (
                          <Button variant="ghost" size="sm" className="text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                            {expandedRow === index ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    
                    {expandedRow === index && hasConvs && (
                      <TableRow className="bg-black/20 border-white/5">
                         <TableCell colSpan={6} className="p-0 max-w-[100vw] sm:max-w-none">
                            <div className="p-6 space-y-6 border-l-2 border-cyan-400 m-2 rounded-r-2xl bg-white/[0.02]">
                              <h4 suppressHydrationWarning className="text-base font-bold text-white/90 drop-shadow-sm">Доказательная база (Диалоги):</h4>
                              {convs.slice(0, 3).map((conv: any, i: number) => {
                                const isHacked = conv.score === 0 && !conv.error; // score=0=UNSAFE, score=1=SAFE
                                return (
                                  <div key={i} className="text-[15px] space-y-4 bg-black/40 p-5 rounded-xl border border-white/10 shadow-inner">
                                     <div className="break-words whitespace-pre-wrap"><span className="text-cyan-400/80 font-bold mr-2">Атака (промпт):</span> <span className="text-white/90 font-medium">{conv.input}</span></div>
                                     <div className="break-words whitespace-pre-wrap"><span className="text-emerald-400/80 font-bold mr-2">Ответ модели:</span> <span className="text-white/80">{conv.output}</span></div>
                                     <div className="flex items-center gap-3 pt-2">
                                        <span className="text-white/50 font-bold text-sm">Вердикт судьи: </span> 
                                        {isHacked ? (
                                           <Badge variant="destructive" className="bg-red-500/20 text-red-300 border-red-500/30 text-xs py-1">ВЗЛОМАНА (ОПАСНО)</Badge>
                                        ) : (
                                           <Badge variant="default" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs py-1">ЗАЩИЩЕНА (БЕЗОПАСНО)</Badge>
                                        )}
                                     </div>
                                  </div>
                                )
                              })}
                              {convs.length > 3 && (
                                <div className="text-sm font-bold text-white/40 italic pl-1">Показаны первые 3 диалога из {convs.length}</div>
                              )}
                            </div>
                         </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
