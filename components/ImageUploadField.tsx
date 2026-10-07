"use client";

import React, { useRef, useState } from "react";
import {
  Image as ImageIcon,
  Upload,
  X,
  Loader2,
  Link as LinkIcon,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const BUCKET = "question-images";
const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

interface Props {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  /** Default mode when the field first appears */
  defaultMode?: "upload" | "url";
  /** Optional header label override (defaults to the question-diagram label) */
  label?: string;
  /** Optional footer hint override */
  hint?: string;
}

export default function ImageUploadField({
  value,
  onChange,
  disabled,
  defaultMode = "upload",
  label,
  hint,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"upload" | "url">(defaultMode);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState(false);

  const [urlDraft, setUrlDraft] = useState(value);
  const [urlStatus, setUrlStatus] = useState<"idle" | "checking" | "ok" | "bad">("idle");
  const [previousValue, setPreviousValue] = useState(value);

  if (value !== previousValue) {
    setPreviousValue(value);
    setUrlDraft(value);
    setPreviewError(false);
    setUrlStatus("idle");
  }

  const isSupabaseImage = value.includes(`/storage/v1/object/public/${BUCKET}/`);
  const displayMode = isSupabaseImage ? "upload" : mode;

  const handleFile = async (file: File) => {
    setError("");
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("PNG · JPG · WEBP · GIF images විතරයි support කරන්නේ.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File size ${MAX_SIZE_MB}MB ට වඩා අඩු විය යුතුයි.`);
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const filePath = `diagrams/${fileName}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (upErr) throw upErr;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      onChange(data.publicUrl);
    } catch (err) {
      setError("Upload failed: " + (err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const validateUrl = (url: string): Promise<boolean> =>
    new Promise((resolve) => {
      if (!/^https?:\/\//i.test(url)) return resolve(false);
      const img = new Image();
      const timer = setTimeout(() => resolve(false), 6000);
      img.onload = () => {
        clearTimeout(timer);
        resolve(true);
      };
      img.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };
      img.src = url;
    });

  const handleUrlApply = async () => {
    const trimmed = urlDraft.trim();
    setError("");

    if (!trimmed) {
      onChange("");
      setUrlStatus("idle");
      return;
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      setError("URL එක http:// හෝ https:// වලින් පටන් ගන්න ඕනේ.");
      setUrlStatus("bad");
      return;
    }

    setUrlStatus("checking");
    const ok = await validateUrl(trimmed);

    if (!ok) {
      setError("මෙම URL එකෙන් image එකක් load කරන්න බෑ. Link එක check කරන්න.");
      setUrlStatus("bad");
      return;
    }

    setUrlStatus("ok");
    onChange(trimmed);
  };

  const handleDelete = async () => {
    if (!value) return;
    if (!confirm("මෙම image එක ඉවත් කරන්නද?")) return;

    const match = value.match(
      new RegExp(`/storage/v1/object/public/${BUCKET}/(.+)$`),
    );
    if (match) {
      await supabase.storage.from(BUCKET).remove([match[1]]);
    }
    onChange("");
    setUrlDraft("");
    setUrlStatus("idle");
    setPreviewError(false);
  };

  const headerLabel = label ?? "රූපසටහන (Diagram - Optional)";
  const hintText =
    hint ?? "* රූපය සියලු භාෂාවන්ට පොදුයි — එකම රූපය හැම භාෂාවටම පෙන්වයි.";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase">
          <ImageIcon className="w-4 h-4 text-gray-500" />
          {headerLabel}
        </label>

        <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
          <button
            type="button"
            onClick={() => setMode("upload")}
            disabled={disabled || uploading}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition flex items-center gap-1 ${
              mode === "upload"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Upload className="w-3 h-3" />
            Upload
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            disabled={disabled || uploading}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition flex items-center gap-1 ${
              mode === "url"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <LinkIcon className="w-3 h-3" />
            URL
          </button>
        </div>
      </div>

      {displayMode === "upload" && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />

          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add("border-blue-400", "bg-blue-50/40");
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove("border-blue-400", "bg-blue-50/40");
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("border-blue-400", "bg-blue-50/40");
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFile(f);
            }}
            className="w-full p-5 border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50/30 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-blue-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-xs font-semibold">Upload වෙමින්...</span>
              </>
            ) : (
              <>
                <Upload className="w-6 h-6" />
                <span className="text-xs font-semibold">
                  Click කරන්න හෝ Image එකක් Drag & Drop කරන්න
                </span>
                <span className="text-[10px] text-gray-400">
                  PNG · JPG · WEBP · GIF · Max {MAX_SIZE_MB}MB
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {displayMode === "url" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="url"
                placeholder="https://example.com/diagram.png"
                value={urlDraft}
                onChange={(e) => {
                  setUrlDraft(e.target.value);
                  setUrlStatus("idle");
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleUrlApply();
                  }
                }}
                disabled={disabled}
                className={`w-full pl-9 pr-3 py-3 bg-gray-50 border rounded-xl font-medium text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition ${
                  urlStatus === "bad"
                    ? "border-red-400"
                    : urlStatus === "ok"
                      ? "border-emerald-400"
                      : "border-gray-300"
                }`}
              />
            </div>

            <button
              type="button"
              disabled={disabled || urlStatus === "checking"}
              onClick={() => void handleUrlApply()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-60 shrink-0"
            >
              {urlStatus === "checking" ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Check
                </>
              ) : urlStatus === "ok" ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Applied
                </>
              ) : (
                "Apply URL"
              )}
            </button>
          </div>

          <p className="text-[11px] text-gray-500">
            * Publicly accessible image URL එකක් paste කරන්න. Google Drive shareable links
            වැඩ කරන්නේ නෑ — direct image URL එකක් use කරන්න.
          </p>
        </div>
      )}

      {error && (
        <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {value && (
        <div className="relative p-2.5 bg-gray-50 rounded-xl border border-gray-200">
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={disabled}
            className="absolute top-2.5 right-2.5 p-1.5 bg-white border border-gray-200 rounded-lg text-red-500 hover:bg-red-50 shadow-sm z-10 disabled:opacity-60"
            title="Remove image"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-1.5 mb-1.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span className="text-[10px] font-bold text-emerald-700 uppercase">
              Preview
            </span>
          </div>

          {previewError ? (
            <div className="p-6 flex flex-col items-center gap-2 text-center">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              <p className="text-[11px] font-semibold text-amber-700">
                Image එක load කරන්න බෑ. URL එක check කරන්න.
              </p>
              <button
                type="button"
                onClick={() => setPreviewError(false)}
                className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Diagram preview"
              className="max-h-48 rounded-lg object-contain mx-auto bg-white"
              onError={() => setPreviewError(true)}
            />
          )}
        </div>
      )}

      <p className="text-[11px] text-gray-500">{hintText}</p>
    </div>
  );
}