"use client";

import React, { useState } from 'react';
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
        <h2 suppressHydrationWarning className="text-2xl font-bold text-[#222222]" style={{ fontFamily: "var(--font-outfit, Outfit)" }}>Логи атак и уязвимостей</h2>
        <p className="text-[#45515e] text-base mt-2">Детальный отчет по каждому протестированному вектору атак.</p>
      </div>
      <div>
        <div className="rounded-2xl border border-[#e5e7eb] hidden md:block overflow-x-auto bg-white">
          <Table className="w-full relative">
            <TableHeader className="bg-[#f2f3f5]">
              <TableRow className="border-[#e5e7eb] hover:bg-[#f2f3f5]">
                <TableHead className="text-[#45515e] font-bold">Критичность</TableHead>
                <TableHead className="text-[#45515e] font-bold">OWASP ID</TableHead>
                <TableHead className="text-[#45515e] font-bold">Уязвимость</TableHead>
                <TableHead className="text-[#45515e] font-bold">Метод атаки</TableHead>
                <TableHead className="text-[#45515e] font-bold">Взлом (ASR)</TableHead>
                <TableHead className="text-right text-[#45515e] font-bold">Детали</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, index) => {
                const asr = row.asr || 0;
                const convs = typeof row.conversations === 'string' ? JSON.parse(row.conversations || "[]") : (row.conversations || []);
                const hasConvs = convs.length > 0;

                return (
                  <React.Fragment key={index}>
                    <TableRow
                      className={`border-[#e5e7eb] transition-colors cursor-pointer group ${expandedRow === index ? 'bg-[#f2f3f5]' : 'hover:bg-[#f9fafb]'}`}
                      onClick={() => toggleRow(index)}
                    >
                      <TableCell>
                        <Badge variant="outline" className={`${asr > 0.2 ? 'bg-[#fef2f2] border-[#fecaca] text-[#dc2626]' : 'bg-[#f2f3f5] border-[#e5e7eb] text-[#45515e]'} py-1`}>
                           {SEVERITY_BADGE[row.severity] || "⚪"} {row.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[#8e8e93] font-semibold">{row.owasp_id}</TableCell>
                      <TableCell className="font-bold text-[#222222]">{row.vulnerability}</TableCell>
                      <TableCell className="text-[#45515e] font-medium">{row.attack_type}</TableCell>
                      <TableCell>
                        <span className={`text-lg font-bold ${asr > 0 ? (asr > 0.2 ? 'text-[#dc2626]' : 'text-[#d97706]') : 'text-[#059669]'}`}>
                          {(asr * 100).toFixed(1)}%
                        </span>
                        <span className="text-[#8e8e93] text-xs ml-2 font-bold">({row.failed}/{row.total})</span>
                      </TableCell>
                      <TableCell className="text-right">
                        {hasConvs && (
                          <Button variant="ghost" size="sm" className="text-[#8e8e93] hover:text-[#222222] hover:bg-[#f2f3f5] transition-colors">
                            {expandedRow === index ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>

                    {expandedRow === index && hasConvs && (
                      <TableRow className="bg-[#f9fafb] border-[#e5e7eb]">
                         <TableCell colSpan={6} className="p-0 max-w-[100vw] sm:max-w-none">
                            <div className="p-6 space-y-6 border-l-2 border-[#1456f0] m-2 rounded-r-2xl bg-white">
                              <h4 suppressHydrationWarning className="text-base font-bold text-[#222222]">Доказательная база (Диалоги):</h4>
                              {convs.slice(0, 3).map((conv: any, i: number) => {
                                const isHacked = conv.score === 0 && !conv.error;
                                return (
                                  <div key={i} className="text-[15px] space-y-4 bg-[#f2f3f5] p-5 rounded-xl border border-[#e5e7eb]">
                                     <div className="break-words whitespace-pre-wrap"><span className="text-[#1456f0] font-bold mr-2">Атака (промпт):</span> <span className="text-[#222222] font-medium">{conv.input}</span></div>
                                     <div className="break-words whitespace-pre-wrap"><span className="text-[#059669] font-bold mr-2">Ответ модели:</span> <span className="text-[#45515e]">{conv.output}</span></div>
                                     <div className="flex items-center gap-3 pt-2">
                                        <span className="text-[#8e8e93] font-bold text-sm">Вердикт судьи: </span>
                                        {isHacked ? (
                                           <Badge variant="outline" className="bg-[#fef2f2] text-[#dc2626] border-[#fecaca] text-xs py-1">ВЗЛОМАНА (ОПАСНО)</Badge>
                                        ) : (
                                           <Badge variant="outline" className="bg-[#ecfdf5] text-[#059669] border-[#a7f3d0] text-xs py-1">ЗАЩИЩЕНА (БЕЗОПАСНО)</Badge>
                                        )}
                                     </div>
                                  </div>
                                )
                              })}
                              {convs.length > 3 && (
                                <div className="text-sm font-bold text-[#8e8e93] italic pl-1">Показаны первые 3 диалога из {convs.length}</div>
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
