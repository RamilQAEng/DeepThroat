"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import EvalDeepEvalTab from "@/components/EvalDeepEvalTab";
import EvalRagasTab from "@/components/EvalRagasTab";
import { BarChart2, FlaskConical } from "lucide-react";

export default function EvalDashboard() {
  return (
    <div className="w-full space-y-8">

      {/* Page header */}
      <div>
        <h1
          suppressHydrationWarning
          className="text-5xl font-extrabold tracking-tight text-[#222222] drop-shadow-sm"
          style={{ fontFamily: "var(--font-outfit, Outfit)" }}
        >
          RAG Quality
        </h1>
        <p className="text-[#45515e] mt-3 text-lg font-medium">
          Оценка релевантности и фактологии
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="deepeval" className="w-full">
        <TabsList
          className="mb-8 bg-[#f2f3f5] border border-[#e5e7eb] rounded-xl p-1 h-auto w-fit"
        >
          <TabsTrigger
            value="deepeval"
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg
              text-[#45515e] data-active:bg-white data-active:text-[#222222]
              data-active:shadow-[rgba(0,0,0,0.08)_0px_2px_4px] transition-all"
          >
            <BarChart2 className="w-4 h-4" />
            DeepEval
          </TabsTrigger>
          <TabsTrigger
            value="ragas"
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg
              text-[#45515e] data-active:bg-white data-active:text-[#222222]
              data-active:shadow-[rgba(0,0,0,0.08)_0px_2px_4px] transition-all"
          >
            <FlaskConical className="w-4 h-4" />
            RAGAS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deepeval">
          <EvalDeepEvalTab />
        </TabsContent>

        <TabsContent value="ragas">
          <EvalRagasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
