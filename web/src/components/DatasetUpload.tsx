"use client";

import { useState, useCallback } from 'react';

interface UploadResponse {
    success: boolean;
    fileName?: string;
    filePath?: string;
    size?: number;
    preview?: any[];
    message?: string;
    error?: string;
}

interface DatasetUploadProps {
    onUploadSuccess?: (filePath: string) => void;
}

export default function DatasetUpload({ onUploadSuccess }: DatasetUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const uploadFile = async (file: File) => {
        setIsUploading(true);
        setUploadResult(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/datasets/upload', {
                method: 'POST',
                body: formData,
            });

            const data: UploadResponse = await response.json();

            if (response.ok && data.success) {
                setUploadResult(data);
                if (onUploadSuccess && data.filePath) {
                    onUploadSuccess(data.filePath);
                }
            } else {
                setUploadResult({ success: false, error: data.error || 'Upload failed' });
            }
        } catch (error: any) {
            setUploadResult({ success: false, error: error.message || 'Network error' });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            uploadFile(files[0]);
        }
    }, []);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            uploadFile(files[0]);
        }
    }, []);

    return (
        <div className="space-y-4">
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                    relative border-2 border-dashed rounded-xl p-8 text-center transition-all
                    ${isDragging
                        ? 'border-purple-500 bg-purple-500/10 scale-[1.02]'
                        : 'border-white/20 bg-white/5 hover:border-purple-500/50 hover:bg-white/10'
                    }
                    ${isUploading ? 'opacity-50 pointer-events-none' : ''}
                `}
            >
                <input
                    type="file"
                    id="dataset-upload"
                    accept=".csv,.jsonl"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isUploading}
                />

                {isUploading ? (
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                        <p className="text-white/80 font-medium">Uploading dataset...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center">
                            <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>

                        <div>
                            <p className="text-lg font-semibold text-white mb-1">
                                Drop your dataset here
                            </p>
                            <p className="text-sm text-white/60">
                                or{' '}
                                <label htmlFor="dataset-upload" className="text-purple-400 hover:text-purple-300 cursor-pointer underline">
                                    browse files
                                </label>
                            </p>
                        </div>

                        <div className="text-xs text-white/40 space-y-1">
                            <p>Supported formats: CSV, JSONL</p>
                            <p>Maximum file size: 50MB</p>
                        </div>
                    </div>
                )}
            </div>

            {uploadResult && (
                <div className={`
                    rounded-lg p-4 border
                    ${uploadResult.success
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-red-500/10 border-red-500/30'
                    }
                `}>
                    {uploadResult.success ? (
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <div className="flex-1">
                                    <p className="font-semibold text-green-300">{uploadResult.message}</p>
                                    <div className="mt-2 text-sm text-white/70 space-y-1">
                                        <p><span className="text-white/50">File:</span> {uploadResult.fileName}</p>
                                        <p><span className="text-white/50">Size:</span> {(uploadResult.size! / 1024).toFixed(2)} KB</p>
                                        <p><span className="text-white/50">Path:</span> <code className="text-purple-300">{uploadResult.filePath}</code></p>
                                    </div>
                                </div>
                            </div>

                            {uploadResult.preview && uploadResult.preview.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-white/10">
                                    <p className="text-sm font-semibold text-white/80 mb-2">Preview (first {uploadResult.preview.length} rows):</p>
                                    <pre className="bg-black/30 rounded p-3 text-xs text-white/60 overflow-x-auto max-h-40 overflow-y-auto">
                                        {uploadResult.preview.map((row, i) => (
                                            <div key={i} className="mb-1">
                                                {typeof row === 'string' ? row : JSON.stringify(row, null, 2)}
                                            </div>
                                        ))}
                                    </pre>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <div>
                                <p className="font-semibold text-red-300">Upload failed</p>
                                <p className="text-sm text-white/70 mt-1">{uploadResult.error}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
