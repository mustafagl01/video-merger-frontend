"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type MergeResponse = { download_url: string };

type UiStatus = "idle" | "uploading" | "submitting" | "processing" | "ready" | "error";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api.mgllabs.uk";

function extractDownloadId(downloadUrl: string): string | null {
  const match = downloadUrl.match(/\/download\/([^/?#]+)/);
  return match?.[1] ?? null;
}

async function uploadMusicFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch("https://file.io", {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error("Music upload failed.");
  }

  const data = (await response.json()) as { success?: boolean; link?: string };
  if (!data.success || !data.link) {
    throw new Error("Music upload did not return a valid URL.");
  }
  return data.link;
}

export default function Page() {
  const [driveLink, setDriveLink] = useState("");
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UiStatus>("idle");
  const [message, setMessage] = useState("Paste a public Google Drive folder link to begin.");
  const [downloadBlobUrl, setDownloadBlobUrl] = useState<string | null>(null);
  const [downloadFilename, setDownloadFilename] = useState("merged_video.mp4");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);

  const canSubmit = useMemo(() => {
    return driveLink.trim().length > 0 && (status === "idle" || status === "error" || status === "ready");
  }, [driveLink, status]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
      if (downloadBlobUrl) {
        URL.revokeObjectURL(downloadBlobUrl);
      }
    };
  }, [downloadBlobUrl]);

  const startPolling = (url: string) => {
    const downloadId = extractDownloadId(url);
    if (!downloadId) {
      setStatus("error");
      setMessage("Invalid download URL from API.");
      return;
    }

    setStatus("processing");
    setMessage("Processing video... checking every 3 seconds.");

    timerRef.current = window.setInterval(async () => {
      try {
        const pollResp = await fetch(`${API_BASE}/download/${downloadId}`);
        if (pollResp.status === 404) {
          return;
        }

        if (!pollResp.ok) {
          throw new Error(`Download check failed (${pollResp.status})`);
        }

        const blob = await pollResp.blob();
        if (blob.size === 0) {
          return;
        }

        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const contentDisposition = pollResp.headers.get("content-disposition");
        const filenameMatch = contentDisposition?.match(/filename="?([^\"]+)"?/i);
        if (filenameMatch?.[1]) {
          setDownloadFilename(filenameMatch[1]);
        }

        const objectUrl = URL.createObjectURL(blob);
        if (downloadBlobUrl) {
          URL.revokeObjectURL(downloadBlobUrl);
        }
        setDownloadBlobUrl(objectUrl);
        setStatus("ready");
        setMessage("Video merge complete. Download is ready.");
      } catch (err) {
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Unexpected error while polling.");
      }
    }, 3000);
  };

  const onSubmit = async () => {
    try {
      if (!canSubmit) return;

      setDownloadUrl(null);
      if (downloadBlobUrl) {
        URL.revokeObjectURL(downloadBlobUrl);
        setDownloadBlobUrl(null);
      }

      let musicUrl: string | undefined;
      if (musicFile) {
        setStatus("uploading");
        setMessage("Uploading music file...");
        musicUrl = await uploadMusicFile(musicFile);
      }

      setStatus("submitting");
      setMessage("Submitting merge request...");

      const response = await fetch(`${API_BASE}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drive_link: driveLink.trim(),
          ...(musicUrl ? { music_url: musicUrl } : {}),
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Merge request failed (${response.status})`);
      }

      const data = (await response.json()) as MergeResponse;
      if (!data.download_url) {
        throw new Error("API did not return download_url.");
      }

      setDownloadUrl(data.download_url);
      startPolling(data.download_url);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unexpected error.");
    }
  };

  const statusLabel: Record<UiStatus, string> = {
    idle: "Idle",
    uploading: "Uploading Music",
    submitting: "Submitting",
    processing: "Processing",
    ready: "Complete",
    error: "Error",
  };

  return (
    <main className="min-h-screen px-4 py-10 md:px-6">
      <section className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-800/80 bg-panel/75 p-6 shadow-glow backdrop-blur md:p-8">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">Video Merger API</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-100">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-400">Merge clips from a public Drive folder and optionally mix background music.</p>
        </header>

        <div className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Google Drive Public Folder Link</span>
            <input
              type="url"
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 outline-none ring-cyan-400/60 transition focus:ring"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Optional Background Music (MP3)</span>
            <input
              type="file"
              accept="audio/mpeg,.mp3"
              onChange={(e) => setMusicFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-xl border border-dashed border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-950 hover:file:bg-cyan-400"
            />
          </label>

          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            className="w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Merge Videos
          </button>
        </div>

        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-300">Status</p>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200">{statusLabel[status]}</span>
          </div>

          <p className="mt-3 text-sm text-slate-400">{message}</p>

          {(status === "uploading" || status === "submitting" || status === "processing") && (
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-cyan-400" />
            </div>
          )}

          {downloadUrl && status !== "ready" && <p className="mt-3 break-all text-xs text-slate-500">{downloadUrl}</p>}

          {status === "ready" && downloadBlobUrl && (
            <a
              href={downloadBlobUrl}
              download={downloadFilename}
              className="mt-4 inline-flex rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              Download Merged Video
            </a>
          )}
        </div>
      </section>
    </main>
  );
}

