"use client";

import { useEffect, useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Activity, ExternalLink } from "lucide-react";
import { useJobPolling } from "@/hooks/useJobPolling";
import { JobProgressBar } from "@/components/JobProgressBar";

// Новые компоненты после рефакторинга
import { ApiContractConfig } from "@/components/runner/ApiContractConfig";
import { EvalConfigPanel } from "@/components/runner/EvalConfigPanel";
import { RedTeamConfigPanel } from "@/components/runner/RedTeamConfigPanel";
import { RunnerModeSelector } from "@/components/runner/RunnerModeSelector";

export default function RunnerPage() {
    const [activeTab, setActiveTab] = useState<string>("eval");
    const [datasets, setDatasets] = useState<{ name: string, path: string }[]>([]);
    const [datasetPath, setDatasetPath] = useState<string>("");
    const [judges, setJudges] = useState<{ name: string; model: string; provider: string }[]>([]);

    // Общие поля API контракта
    const [url, setUrl] = useState("http://localhost:8000/api/v1/eval/rag");
    const [method, setMethod] = useState("POST");
    const [headersStr, setHeadersStr] = useState("{\n  \"Content-Type\": \"application/json\"\n}");
    const [bodyStr, setBodyStr] = useState("{\n  \"question\": \"{{user_query}}\",\n  \"category\": \"{{category}}\"\n}");
    const [extractAnswer, setExtractAnswer] = useState("answer");
    const [extractChunks, setExtractChunks] = useState("retrieved_chunks");

    // Настройки для Eval
    const [limit, setLimit] = useState<string>("");
    const [evalJudge, setEvalJudge] = useState("DeepSeek V3.2");
    const [workers, setWorkers] = useState<string>("1");
    const [metrics, setMetrics] = useState({ AR: true, FA: true, CP: true, CR: true });
    const [thresholds, setThresholds] = useState({ AR: "0.80", FA: "0.90", CP: "0.70", CR: "0.75" });

    // Настройки для RedTeam
    const [attacksPerVuln, setAttacksPerVuln] = useState<string>("1");
    const [threshold, setThreshold] = useState<string>("0.20");
    const [redteamJudge, setRedteamJudge] = useState("gpt-4o-mini");

    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);

    // Polling для отслеживания прогресса
    const { status: jobStatus, isPolling } = useJobPolling({
        jobId: currentJobId,
        enabled: currentJobId !== null,
        interval: 2000,
        onComplete: (finalStatus) => {
            setStatus("success");
            setMessage(`Задача завершена! Результаты: ${finalStatus.results_path}`);
            setCurrentJobId(null);
        },
        onError: (error) => {
            setStatus("error");
            setMessage(`Ошибка выполнения: ${error}`);
            setCurrentJobId(null);
        },
    });

    const loadDatasets = () => {
        fetch("/api/datasets").then(res => res.json()).then(data => {
            if (data.datasets && data.datasets.length > 0) {
                setDatasets(data.datasets);
                setDatasetPath(data.datasets[0].path);
            }
        });
    };

    const loadJudges = () => {
        fetch("/api/eval/judges").then(res => res.json()).then(data => {
            if (data.judges && data.judges.length > 0) {
                setJudges(data.judges);
                if (!data.judges.find((j: { name: string }) => j.name === evalJudge)) {
                    setEvalJudge(data.judges[0].name);
                }
            }
        });
    };

    useEffect(() => {
        loadDatasets();
        loadJudges();
    }, []);

    const handleUploadSuccess = (filePath: string) => {
        loadDatasets();
        setDatasetPath(filePath);
    };

    const handleRun = async () => {
        try {
            setStatus("loading");
            setMessage("");

            let parsedHeaders = {};
            try { parsedHeaders = JSON.parse(headersStr); } catch (e) { throw new Error("Invalid Headers JSON"); }
            let parsedBody = {};
            try { parsedBody = JSON.parse(bodyStr); } catch (e) { throw new Error("Invalid Body JSON"); }

            const apiContract: any = {
                url, method, headers: parsedHeaders, body: parsedBody,
                extractors: { answer: extractAnswer, chunks: extractChunks }
            };

            let endpoint = "";
            let payload: any = { api_contract: apiContract };

            if (activeTab === "eval") {
                endpoint = "/api/runner";
                payload.dataset = datasetPath;
                payload.model = evalJudge;
                payload.n_samples = limit ? parseInt(limit) : undefined;
                payload.workers = workers ? parseInt(workers) : 1;
                payload.metrics = Object.keys(metrics).filter(k => {
                    const map: Record<string, string> = { AR: "answer_relevancy", FA: "faithfulness", CP: "contextual_precision", CR: "contextual_recall" };
                    return metrics[k as keyof typeof metrics];
                }).map(k => {
                    const map: Record<string, string> = { AR: "answer_relevancy", FA: "faithfulness", CP: "contextual_precision", CR: "contextual_recall" };
                    return map[k];
                });
                payload.thresholds = {};
                Object.keys(metrics).forEach(k => {
                    if (metrics[k as keyof typeof metrics]) {
                        payload.thresholds[k] = parseFloat(thresholds[k as keyof typeof thresholds]);
                    }
                });
            } else {
                endpoint = "/api/runner/redteam";
                payload.target = redteamJudge;
                payload.num_attacks = attacksPerVuln ? parseInt(attacksPerVuln) : 10;
                payload.threshold = threshold ? parseFloat(threshold) : 0.20;
            }

            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Execution failed");

            setCurrentJobId(data.job_id);
            setStatus("loading");
            setMessage(`Запущена задача ${activeTab === "eval" ? "RAG Evaluation" : "Red Team"}. Job ID: ${data.job_id}`);

        } catch (e: any) {
            setStatus("error");
            setMessage(e.message);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 suppressHydrationWarning className="text-3xl font-extrabold tracking-tight text-[#222222] drop-shadow-sm flex items-center gap-3" style={{ fontFamily: "var(--font-outfit, Outfit)" }}>
                    <Activity className="w-7 h-7 text-[#1456f0]" />
                    API Runner
                </h1>
                <p className="text-[#8e8e93] mt-2 text-base font-medium">Унифицированный запуск RAG Evaluation и Red Teaming через API контракт</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column - Configurations */}
                <div className="lg:col-span-8 space-y-5">
                    <ApiContractConfig
                        method={method} setMethod={setMethod}
                        url={url} setUrl={setUrl}
                        headersStr={headersStr} setHeadersStr={setHeadersStr}
                        bodyStr={bodyStr} setBodyStr={setBodyStr}
                        extractAnswer={extractAnswer} setExtractAnswer={setExtractAnswer}
                        extractChunks={extractChunks} setExtractChunks={setExtractChunks}
                    />

                    {activeTab === "eval" ? (
                        <EvalConfigPanel
                            judges={judges} evalJudge={evalJudge} setEvalJudge={setEvalJudge}
                            limit={limit} setLimit={setLimit}
                            workers={workers} setWorkers={setWorkers}
                            metrics={metrics} setMetrics={setMetrics}
                            thresholds={thresholds} setThresholds={setThresholds}
                        />
                    ) : (
                        <RedTeamConfigPanel
                            redteamJudge={redteamJudge} setRedteamJudge={setRedteamJudge}
                            attacksPerVuln={attacksPerVuln} setAttacksPerVuln={setAttacksPerVuln}
                            threshold={threshold} setThreshold={setThreshold}
                        />
                    )}
                </div>

                {/* Right Column - Status & Mode Selector */}
                <div className="lg:col-span-4 space-y-5">
                    <RunnerModeSelector
                        activeTab={activeTab} setActiveTab={setActiveTab}
                        datasetPath={datasetPath} setDatasetPath={setDatasetPath}
                        datasets={datasets} handleUploadSuccess={handleUploadSuccess}
                        handleRun={handleRun} status={status}
                    />

                    {/* Job Status Messages */}
                    <div className="space-y-3">
                        {(isPolling || jobStatus) && (
                            <JobProgressBar status={jobStatus} isPolling={isPolling} />
                        )}

                        {status === "error" && (
                            <div className="p-3 rounded-lg bg-[#fef2f2] border border-red-200 text-[#dc2626] text-sm font-medium">
                                <span className="font-bold">Ошибка:</span> {message}
                            </div>
                        )}

                        {status === "success" && !isPolling && (
                            <div className="p-3 rounded-lg bg-[#ecfdf5] border border-emerald-200 text-[#059669] text-sm font-medium space-y-1">
                                <p>{message}</p>
                                <div className="flex items-center gap-1.5 text-[#059669] text-xs">
                                    <ExternalLink className="w-3 h-3" />
                                    <span>Результаты скоро появятся в разделе Analytics</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
