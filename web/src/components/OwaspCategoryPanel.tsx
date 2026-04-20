"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SEVERITY_BADGE, OWASPCategory } from "@/lib/owasp";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface OwaspCategoryPanelProps {
  sortedCats: Array<{ cat: OWASPCategory; asr: number }>;
}

export function OwaspCategoryPanel({ sortedCats }: OwaspCategoryPanelProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const toggleCategory = (id: string) => {
    setExpandedCategory(expandedCategory === id ? null : id);
  };

  return (
    <div className="bg-[#f2f3f5] rounded-[24px] border border-[#e5e7eb] p-3 shadow-[rgba(0,0,0,0.08)_0px_4px_6px] h-full">
      <Card className="h-full border-0 bg-transparent shadow-none">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-[#222222] drop-shadow-sm flex items-center gap-2">
            Статус по категориям
            <Info className="w-5 h-5 text-[#8e8e93]" />
          </CardTitle>
          <CardDescription className="text-[#45515e] text-base font-medium">
            Сводка наихудших показателей (ASR) по каждой категории OWASP LLM Top 10.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedCats.map((item, i) => (
              <Collapsible
                key={i}
                open={expandedCategory === item.cat.id}
                onOpenChange={() => toggleCategory(item.cat.id)}
              >
                <CollapsibleTrigger asChild>
                  <div
                    className="flex items-center justify-between p-5 rounded-xl bg-white border border-[#e5e7eb] hover:bg-[#f9fafb] transition-all cursor-pointer shadow-sm hover:shadow-md group"
                  >
                    <div className="flex items-center gap-5 flex-1">
                      <span className="text-3xl drop-shadow-md">
                        {SEVERITY_BADGE[item.cat.severity] || "⚪"}
                      </span>
                      <div className="flex-1">
                        <p className="font-bold text-lg text-[#222222] drop-shadow-sm">
                          [{item.cat.id}] {item.cat.name}
                        </p>
                        <div className="flex gap-3 mt-2 divide-x divide-[#e5e7eb]">
                          <span className="text-sm font-semibold text-[#dc2626]">
                            Взломов: {(item.asr * 100).toFixed(0)}%
                          </span>
                          <span className="text-sm font-semibold text-emerald-500 pl-3">
                            Защита: {((1 - item.asr) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    {expandedCategory === item.cat.id ? (
                      <ChevronUp className="w-6 h-6 text-[#8e8e93] group-hover:text-[#222222] transition-colors" />
                    ) : (
                      <ChevronDown className="w-6 h-6 text-[#8e8e93] group-hover:text-[#222222] transition-colors" />
                    )}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="bg-white border border-[#e5e7eb] rounded-xl p-5 space-y-4 shadow-sm">
                    <div>
                      <h4 className="text-sm font-bold text-[#222222] mb-2 uppercase tracking-wide">
                        Описание:
                      </h4>
                      <p className="text-[#45515e] text-sm leading-relaxed">
                        {item.cat.description}
                      </p>
                    </div>
                    <div className="border-t border-[#e5e7eb] pt-4">
                      <h4 className="text-sm font-bold text-[#222222] mb-2 uppercase tracking-wide">
                        Рекомендации по устранению:
                      </h4>
                      <p className="text-[#45515e] text-sm leading-relaxed">
                        {item.cat.remediation}
                      </p>
                    </div>
                    <div className="border-t border-[#e5e7eb] pt-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <span className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wide">
                            Критичность:
                          </span>
                          <p className="text-sm font-bold text-[#222222] mt-1">
                            {item.cat.severity}
                          </p>
                        </div>
                        <div className="flex-1">
                          <span className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wide">
                            OWASP ID:
                          </span>
                          <p className="text-sm font-bold text-[#222222] mt-1">
                            {item.cat.id}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
