"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Play, Activity, Database, Braces, Link2, ExternalLink, Loader2, Key, Shield, BarChart3 } from "lucide-react";

export default function RunnerPage() {
    const [activeTab, setActiveTab] = useState<string>("eval");
    const [datasets, setDatasets] = useState<{name: string, path: string}[]>([]);
    const [datasetPath, setDatasetPath] = useState<string>("");

    // Общие поля API контракта
    const [url, setUrl] = useState("http://localhost:8000/api/v1/eval/rag");
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

    useEffect(() => {
        fetch("/api/datasets").then(res => res.json()).then(data => {
            if (data.datasets && data.datasets.length > 0) {
                setDatasets(data.datasets);
                setDatasetPath(data.datasets[0].path);
            }
        });
    }, []);

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

    const inputClasses = "flex h-10 w-full rounded-md border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all";
    const textareaClasses = "flex w-full rounded-md border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all font-mono min-h-[120px]";
    const labelClasses = "text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block flex items-center gap-2";

    return (
        <div className="w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-sm flex items-center gap-3">
                    <Activity className="w-8 h-8 text-cyan-400" />
                    API Runner
                </h1>
                <p className="text-white/60 mt-2 text-lg font-medium">Унифицированный запуск RAG Evaluation и Red Teaming через API контракт</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column - API Contract (общие поля) */}
                <div className="lg:col-span-8 space-y-6">
                    
                    <Card className="bg-white/5 border border-white/10 backdrop-blur-[40px] shadow-2xl rounded-2xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Link2 className="w-32 h-32 text-cyan-500" />
                        </div>
                        <CardHeader>
                            <CardTitle className="text-xl font-bold tracking-tight text-white/90 drop-shadow-md flex justify-between items-center z-10">
                                <span>Конфигурация запроса (API Contract)</span>
                                <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30">Network</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 z-10 relative">
                            <div className="flex gap-4">
                                <div className="w-32">
                                    <label className={labelClasses}>Method</label>
                                    <Select value={method} onValueChange={setMethod}>
                                        <SelectTrigger className="bg-slate-950/50 border border-white/10 text-white font-bold h-10 w-full focus:ring-purple-500/50">
                                            <SelectValue placeholder="Method" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-white/10 text-white font-bold">
                                            <SelectItem value="POST" className="text-emerald-400">POST</SelectItem>
                                            <SelectItem value="GET" className="text-blue-400">GET</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex-1">
                                    <label className={labelClasses}>Эндпоинт (URL)</label>
                                    <input 
                                        type="text" 
                                        className={inputClasses} 
                                        value={url} 
                                        onChange={e => setUrl(e.target.value)}
                                        placeholder="https://api.example.com/v1/rag"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                    <p className="text-[11px] text-white/40 mt-2">Доступные переменные: {`{{user_query}}`}, {`{{category}}`}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/5 border border-white/10 backdrop-blur-[40px] shadow-2xl rounded-2xl overflow-hidden relative">
                        <CardHeader>
                            <CardTitle className="text-xl font-bold tracking-tight text-white/90 drop-shadow-md z-10 flex justify-between items-center">
                                <span>Маппинг ответа (Extractors)</span>
                                <Badge variant="outline" className="bg-pink-500/10 text-pink-400 border-pink-500/30">Parsing</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 z-10 relative">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <div className="lg:col-span-4 space-y-6">
                    <Card className="bg-gradient-to-b from-purple-900/20 to-slate-900/40 border border-purple-500/20 backdrop-blur-[40px] shadow-2xl rounded-2xl overflow-hidden relative">
                        <CardHeader>
                            <CardTitle className="text-xl font-bold tracking-tight text-white/90 drop-shadow-md z-10">Режим работы</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 z-10 relative">
                            <Tabs value={activeTab} onValueChange={setActiveTab}>
                                <TabsList className="w-full bg-slate-950/50 border border-white/10">
                                    <TabsTrigger value="eval" className="flex-1 gap-2">
                                        <BarChart3 className="w-4 h-4" />
                                        Evaluate RAG
                                    </TabsTrigger>
                                    <TabsTrigger value="redteam" className="flex-1 gap-2">
                                        <Shield className="w-4 h-4" />
                                        Red Teaming
                                    </TabsTrigger>
                                </TabsList>

                                {/* Evaluate RAG Settings */}
                                <TabsContent value="eval" className="space-y-6 mt-6">
                                    <div>
                                        <label className={labelClasses}><Database className="w-4 h-4 text-emerald-400" /> Выбор датасета</label>
                                        <Select value={datasetPath} onValueChange={setDatasetPath}>
                                            <SelectTrigger className="bg-slate-950/50 border border-white/10 text-white h-10 w-full focus:ring-purple-500/50 text-sm">
                                                <SelectValue placeholder="Загрузка..." />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-900 border-white/10 text-white">
                                                {datasets.map(d => (
                                                    <SelectItem key={d.path} value={d.path}>{d.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
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
                                        <p className="text-[11px] text-white/40 mt-1">Определено в eval/config/targets.yaml</p>
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
                                        <div className="grid grid-cols-2 gap-3 mt-2">
                                            {(["AR", "FA", "CP", "CR"] as const).map(m => (
                                                <label key={m} className="flex items-center gap-2 text-sm text-white/80 select-none cursor-pointer p-2 rounded-lg border border-white/5 bg-slate-950/30 hover:bg-slate-950/60 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-white/20 text-purple-500 focus:ring-purple-500/50"
                                                        checked={metrics[m]}
                                                        onChange={e => setMetrics({...metrics, [m]: e.target.checked})}
                                                    />
                                                    <span className="font-medium">{m === "AR" ? "Answer Rel (AR)" : m === "FA" ? "Faithfulness (FA)" : m === "CP" ? "Ctx Precision (CP)" : "Ctx Recall (CR)"}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* Red Teaming Settings */}
                                <TabsContent value="redteam" className="space-y-6 mt-6">
                                    <div>
                                        <label className={labelClasses}>ID Модели-судьи (Judge Preset)</label>
                                        <input
                                            type="text"
                                            className={inputClasses}
                                            value={redteamJudge}
                                            onChange={e => setRedteamJudge(e.target.value)}
                                            placeholder="gpt-4o-mini"
                                        />
                                        <p className="text-[11px] text-white/40 mt-1">Пресеты: gpt-4o-mini, gemini-flash, haiku, llama3-70b</p>
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
                                        <p className="text-[11px] text-white/40 mt-1">Количество симуляций атак на каждую уязвимость</p>
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
                                        <p className="text-[11px] text-white/40 mt-1">Attack Success Rate выше порога = FAIL</p>
                                    </div>
                                </TabsContent>
                            </Tabs>

                            <div className="pt-4 border-t border-white/10">
                                <button
                                    onClick={handleRun}
                                    disabled={status === 'loading'}
                                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-sm"
                                >
                                    {status === 'loading' ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Play className="w-5 h-5" />
                                    )}
                                    {activeTab === "eval" ? "Запустить Evaluation" : "Запустить Red Team"}
                                </button>
                            </div>

                            {status === "error" && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium">
                                    Ошибка: {message}
                                </div>
                            )}

                            {status === "success" && (
                                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium">
                                    {message}
                                    <div className="mt-2 flex items-center gap-1 text-emerald-300 text-xs">
                                        <ExternalLink className="w-3 h-3" /> Проверьте логи или страницу результатов через пару минут
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
