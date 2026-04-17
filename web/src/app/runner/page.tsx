"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Play, Activity, Database, Braces, Link2, ExternalLink, Loader2, Key, Shield, BarChart3 } from "lucide-react";
import DatasetUpload from "@/components/DatasetUpload";

export default function RunnerPage() {
    const [activeTab, setActiveTab] = useState<string>("eval");
    const [datasets, setDatasets] = useState<{ name: string, path: string }[]>([]);
    const [datasetPath, setDatasetPath] = useState<string>("");

    // Общие поля API контракта
    const [url, setUrl] = useState("https://assist.dev.mglk.ru/api/v1/eval/rag");
    const [method, setMethod] = useState("POST");
    const [headersStr, setHeadersStr] = useState("{\n  \"Content-Type\": \"application/json\"\n}");
    const [bodyStr, setBodyStr] = useState("{\n  \"question\": \"{{user_query}}\",\n  \"category\": \"{{category}}\"\n}");
    const [extractAnswer, setExtractAnswer] = useState("answer");
    const [extractChunks, setExtractChunks] = useState("retrieved_chunks");

    // Настройки для Eval
    const [limit, setLimit] = useState<string>("");
    const [evalJudge, setEvalJudge] = useState("gpt4o-mini-or");
    const [metrics, setMetrics] = useState({
        AR: true,
        FA: true,
        CP: true,
        CR: true
    });

    // Настройки для RedTeam
    const [attacksPerVuln, setAttacksPerVuln] = useState<string>("1");
    const [threshold, setThreshold] = useState<string>("0.20");
    const [redteamJudge, setRedteamJudge] = useState("gpt-4o-mini");

    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const loadDatasets = () => {
        fetch("/api/datasets").then(res => res.json()).then(data => {
            if (data.datasets && data.datasets.length > 0) {
                setDatasets(data.datasets);
                setDatasetPath(data.datasets[0].path);
            }
        });
    };

    useEffect(() => {
        loadDatasets();
    }, []);

    const handleUploadSuccess = (filePath: string) => {
        loadDatasets(); // Перезагружаем список датасетов
        setDatasetPath(filePath); // Автоматически выбираем новозагруженный датасет
    };

    const handleRun = async () => {
        try {
            setStatus("loading");
            setMessage("");

            let parsedHeaders = {};
            try {
                parsedHeaders = JSON.parse(headersStr);
            } catch (e) {
                throw new Error("Invalid Headers JSON");
            }

            let parsedBody = {};
            try {
                parsedBody = JSON.parse(bodyStr);
            } catch (e) {
                throw new Error("Invalid Body JSON");
            }

            // Формируем API контракт (общий для обеих вкладок)
            const apiContract = {
                url,
                method,
                headers: parsedHeaders,
                body: parsedBody,
                extractors: {
                    answer: extractAnswer,
                    chunks: extractChunks
                }
            };

            let endpoint = "";
            let payload: any = { api_contract: apiContract };

            if (activeTab === "eval") {
                // Evaluate RAG
                endpoint = "/api/runner";
                payload.dataset_path = datasetPath;
                payload.judge = evalJudge;
                payload.limit = limit ? parseInt(limit) : undefined;
                payload.api_contract.metrics = Object.keys(metrics).filter(k => metrics[k as keyof typeof metrics]);
            } else {
                // Red Teaming
                endpoint = "/api/runner/redteam";
                payload.judge = redteamJudge;
                payload.attacks_per_vulnerability = attacksPerVuln ? parseInt(attacksPerVuln) : 1;
                payload.threshold = threshold ? parseFloat(threshold) : 0.20;
            }

            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Execution failed");
            }

            setStatus("success");
            setMessage(`${activeTab === "eval" ? "RAG Evaluation" : "Red Team"} Pipeline started successfully. Job ID: ${data.job_id}`);

        } catch (e: any) {
            setStatus("error");
            setMessage(e.message);
        }
    };

    const inputClasses = "flex h-9 w-full rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#222222] placeholder:text-[#8e8e93] focus:outline-none focus:ring-2 focus:ring-[#1456f0]/30 focus:border-[#1456f0] transition-all";
    const textareaClasses = "flex w-full rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#222222] placeholder:text-[#8e8e93] focus:outline-none focus:ring-2 focus:ring-[#1456f0]/30 focus:border-[#1456f0] transition-all font-mono min-h-[100px] resize-none";
    const labelClasses = "text-xs font-semibold text-[#45515e] uppercase tracking-wider mb-2 flex items-center gap-2";

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
                {/* Left Column - API Contract (общие поля) */}
                <div className="lg:col-span-8 space-y-5">

                    <Card className="bg-white border border-[#e5e7eb] shadow-[rgba(0,0,0,0.08)_0px_4px_6px] rounded-xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Link2 className="w-24 h-24 text-[#1456f0]" />
                        </div>
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg font-bold tracking-tight text-[#222222] flex justify-between items-center z-10">
                                <span className="flex items-center gap-2">
                                    Конфигурация запроса
                                </span>
                                <Badge variant="outline" className="bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe] px-2 py-0.5 text-xs">Network</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 z-10 relative">
                            <div className="flex gap-4">
                                <div className="w-32">
                                    <label className={labelClasses}>Method</label>
                                    <Select value={method} onValueChange={(v) => v && setMethod(v)}>
                                        <SelectTrigger className="bg-white border border-[#e5e7eb] text-[#222222] h-9 w-full focus:ring-[#1456f0]/30 rounded-md">
                                            <SelectValue placeholder="Method" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white border-[#e5e7eb] text-[#222222]">
                                            <SelectItem value="POST">POST</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex-1">
                                    <label className={labelClasses}>Endpoint (URL)</label>
                                    <input
                                        type="text"
                                        className={inputClasses}
                                        value={url}
                                        onChange={e => setUrl(e.target.value)}
                                        placeholder="https://api.example.com/v1/rag"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClasses}><Key className="w-4 h-4 text-purple-400" /> Headers (JSON)</label>
                                    <textarea
                                        className={textareaClasses}
                                        value={headersStr}
                                        onChange={e => setHeadersStr(e.target.value)}
                                        spellCheck={false}
                                    />
                                </div>
                                <div>
                                    <label className={labelClasses}><Braces className="w-4 h-4 text-pink-400" /> Body Payload (JSON)</label>
                                    <textarea
                                        className={textareaClasses}
                                        value={bodyStr}
                                        onChange={e => setBodyStr(e.target.value)}
                                        spellCheck={false}
                                    />
                                    <p className="text-xs text-[#8e8e93] mt-2">Доступные переменные: {`{{user_query}}`}, {`{{category}}`}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white border border-[#e5e7eb] shadow-[rgba(0,0,0,0.08)_0px_4px_6px] rounded-xl overflow-hidden relative">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg font-bold tracking-tight text-[#222222] z-10 flex justify-between items-center">
                                <span className="flex items-center gap-2">
                                    Маппинг ответа
                                </span>
                                <Badge variant="outline" className="bg-[#fdf2f8] text-[#be185d] border-[#fbcfe8] px-2 py-0.5 text-xs">Parsing</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 z-10 relative">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClasses}>Путь до основного ответа (Answer Path)</label>
                                    <input
                                        type="text"
                                        className={inputClasses}
                                        value={extractAnswer}
                                        onChange={e => setExtractAnswer(e.target.value)}
                                        placeholder="data.answer"
                                    />
                                </div>
                                <div>
                                    <label className={labelClasses}>Путь до найденных чанков (Chunks Path)</label>
                                    <input
                                        type="text"
                                        className={inputClasses}
                                        value={extractChunks}
                                        onChange={e => setExtractChunks(e.target.value)}
                                        placeholder="data.retrieved_chunks"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Tabs with specific settings */}
                <div className="lg:col-span-4 space-y-5">
                    <Card className="bg-white border border-[#e5e7eb] shadow-[rgba(0,0,0,0.08)_0px_4px_6px] rounded-xl overflow-hidden relative">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg font-bold tracking-tight text-[#222222] z-10 flex items-center gap-2">
                                Режим работы
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5 z-10 relative">
                            <Tabs value={activeTab} onValueChange={setActiveTab}>
                                <TabsList className="w-full bg-[#f2f3f5] border border-[#e5e7eb] p-1 rounded-md">
                                    <TabsTrigger value="eval" className="flex-1 gap-1.5 text-sm">
                                        <BarChart3 className="w-3.5 h-3.5" />
                                        Evaluate RAG
                                    </TabsTrigger>
                                    <TabsTrigger value="redteam" className="flex-1 gap-1.5 text-sm">
                                        <Shield className="w-3.5 h-3.5" />
                                        Red Teaming
                                    </TabsTrigger>
                                </TabsList>

                                {/* Evaluate RAG Settings */}
                                <TabsContent value="eval" className="space-y-4 mt-4">
                                    <div className="space-y-3">
                                        <div>
                                            <label className={labelClasses}><Database className="w-3.5 h-3.5 text-emerald-400" /> Загрузить новый датасет</label>
                                            <DatasetUpload onUploadSuccess={handleUploadSuccess} />
                                        </div>

                                        <div className="relative py-1">
                                            <div className="absolute inset-0 flex items-center">
                                                <div className="w-full border-t border-[#e5e7eb]"></div>
                                            </div>
                                            <div className="relative flex justify-center text-xs">
                                                <span className="bg-white px-3 py-1 text-[#8e8e93] rounded-full text-[10px]">или выберите существующий</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className={labelClasses}><Database className="w-3.5 h-3.5 text-emerald-400" /> Выбор датасета</label>
                                            <Select value={datasetPath} onValueChange={(v) => v && setDatasetPath(v)}>
                                                <SelectTrigger className="bg-white border border-[#e5e7eb] text-[#222222] h-9 w-full focus:ring-[#1456f0]/30 text-sm rounded-md">
                                                    <SelectValue placeholder="Загрузка..." />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white border-[#e5e7eb] text-[#222222]">
                                                    {datasets.map(d => (
                                                        <SelectItem key={d.path} value={d.path}>{d.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelClasses}>ID Модели-судьи (Judge Target)</label>
                                        <input
                                            type="text"
                                            className={inputClasses}
                                            value={evalJudge}
                                            onChange={e => setEvalJudge(e.target.value)}
                                            placeholder="gpt4o-mini-or"
                                        />
                                        <p className="text-xs text-[#8e8e93] mt-1">Определено в eval/config/targets.yaml</p>
                                    </div>

                                    <div>
                                        <label className={labelClasses}>Ограничение (Limit)</label>
                                        <input
                                            type="number"
                                            className={inputClasses}
                                            value={limit}
                                            onChange={e => setLimit(e.target.value)}
                                            placeholder="Например, 5 (оставить пустым для всего)"
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClasses}>Что вычислять (Метрики)</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(["AR", "FA", "CP", "CR"] as const).map(m => (
                                                <label key={m} className="flex items-center gap-2 text-sm text-[#222222] select-none cursor-pointer p-2 rounded-md border border-[#e5e7eb] bg-white hover:bg-[#f2f3f5] hover:border-[#d1d5db] transition-all">
                                                    <input
                                                        type="checkbox"
                                                        className="w-3.5 h-3.5 rounded border-[#e5e7eb] text-purple-500 focus:ring-purple-500/50"
                                                        checked={metrics[m]}
                                                        onChange={e => setMetrics({ ...metrics, [m]: e.target.checked })}
                                                    />
                                                    <span className="font-medium text-xs">{m === "AR" ? "Answer Rel" : m === "FA" ? "Faithfulness" : m === "CP" ? "Ctx Precision" : "Ctx Recall"}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* Red Teaming Settings */}
                                <TabsContent value="redteam" className="space-y-4 mt-4">
                                    <div>
                                        <label className={labelClasses}>ID Модели-судьи (Judge Preset)</label>
                                        <input
                                            type="text"
                                            className={inputClasses}
                                            value={redteamJudge}
                                            onChange={e => setRedteamJudge(e.target.value)}
                                            placeholder="gpt-4o-mini"
                                        />
                                        <p className="text-xs text-[#8e8e93] mt-1">Пресеты: gpt-4o-mini, gemini-flash, haiku, llama3-70b</p>
                                    </div>

                                    <div>
                                        <label className={labelClasses}>Атак на тип уязвимости (Attacks per Vuln)</label>
                                        <input
                                            type="number"
                                            className={inputClasses}
                                            value={attacksPerVuln}
                                            onChange={e => setAttacksPerVuln(e.target.value)}
                                            placeholder="1"
                                            min="1"
                                        />
                                        <p className="text-xs text-[#8e8e93] mt-1">Количество симуляций атак на каждую уязвимость</p>
                                    </div>

                                    <div>
                                        <label className={labelClasses}>Порог успеха атаки (ASR Threshold)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className={inputClasses}
                                            value={threshold}
                                            onChange={e => setThreshold(e.target.value)}
                                            placeholder="0.20"
                                            min="0"
                                            max="1"
                                        />
                                        <p className="text-xs text-[#8e8e93] mt-1">Attack Success Rate выше порога = FAIL</p>
                                    </div>
                                </TabsContent>
                            </Tabs>

                            <div className="pt-4 border-t border-[#e5e7eb]">
                                <button
                                    onClick={handleRun}
                                    disabled={status === 'loading'}
                                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-bold py-2.5 px-4 rounded-lg shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-sm"
                                >
                                    {status === 'loading' ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Play className="w-4 h-4" />
                                    )}
                                    {activeTab === "eval" ? "Запустить Evaluation" : "Запустить Red Team"}
                                </button>
                            </div>

                            {status === "error" && (
                                <div className="p-3 rounded-lg bg-[#fef2f2] border border-red-200 text-[#dc2626] text-sm font-medium">
                                    <span className="font-bold">Ошибка:</span> {message}
                                </div>
                            )}

                            {status === "success" && (
                                <div className="p-3 rounded-lg bg-[#ecfdf5] border border-emerald-200 text-[#059669] text-sm font-medium space-y-1">
                                    <p>{message}</p>
                                    <div className="flex items-center gap-1.5 text-[#059669] text-xs">
                                        <ExternalLink className="w-3 h-3" />
                                        <span>Проверьте логи или страницу результатов через пару минут</span>
                                    </div>
                                </div>
                            )}

                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
