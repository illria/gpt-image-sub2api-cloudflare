import {
  Download,
  Eraser,
  ImagePlus,
  KeyRound,
  Loader2,
  PanelLeft,
  RefreshCcw,
  Settings2,
  Sparkles,
  Upload,
  Wand2,
  X
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type Mode = "generate" | "edit";

type GeneratedImage = {
  id: string;
  src: string;
  prompt: string;
  model: string;
  size: string;
  createdAt: string;
};

type ServerConfig = {
  ok: boolean;
  model: string;
  serverConfigured: boolean;
  allowClientConfig: boolean;
};

const STORAGE_KEY = "gpt-image-gallery-settings";
const SAMPLE_PROMPTS = [
  "一张高质量二次元角色图片，真实光影，细节丰富，电影感构图，清晰焦点，柔和背景",
  "深夜桌面工作区，一位蓝发二次元少女坐在电竞椅上吃薯片，双显示器，暗色房间，真实摄影感光影",
  "樱花街道上的可爱粉发角色，低角度手机摄影感，春天阳光，浅景深，精致细节",
  "海边阳光下的角色插画，清澈蓝色海水，漂浮泳圈，夏日氛围，超高细节"
];

const SIZE_OPTIONS = ["1024x1024", "1024x1536", "1536x1024", "auto"];
const QUALITY_OPTIONS = ["auto", "low", "medium", "high"];
const FORMAT_OPTIONS = ["png", "jpeg", "webp"];
const BACKGROUND_OPTIONS = ["auto", "opaque", "transparent"];

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readSavedSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function download(src: string, filename: string) {
  const link = document.createElement("a");
  link.href = src;
  link.download = filename;
  link.rel = "noreferrer";
  link.click();
}

export default function App() {
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-image-2");
  const [mode, setMode] = useState<Mode>("generate");
  const [prompt, setPrompt] = useState(SAMPLE_PROMPTS[0]);
  const [size, setSize] = useState("1024x1536");
  const [quality, setQuality] = useState("auto");
  const [count, setCount] = useState(1);
  const [format, setFormat] = useState("png");
  const [background, setBackground] = useState("auto");
  const [compression, setCompression] = useState(100);
  const [useClientConfig, setUseClientConfig] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [lastRaw, setLastRaw] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const saved = readSavedSettings();
    if (saved) {
      setBaseUrl(saved.baseUrl || "");
      setApiKey(saved.apiKey || "");
      setModel(saved.model || "gpt-image-2");
      setSize(saved.size || "1024x1536");
      setQuality(saved.quality || "auto");
      setFormat(saved.format || "png");
      setBackground(saved.background || "auto");
      setCompression(saved.compression ?? 100);
      setUseClientConfig(Boolean(saved.useClientConfig));
    }

    fetch("/api/config")
      .then((res) => res.json())
      .then((data: ServerConfig) => {
        setConfig(data);
        if (data.model) setModel((current) => current || data.model);
        if (!data.allowClientConfig) setUseClientConfig(false);
      })
      .catch(() => {
        setConfig({ ok: false, model: "gpt-image-2", serverConfigured: false, allowClientConfig: true });
        setUseClientConfig(true);
      });
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        baseUrl,
        apiKey,
        model,
        size,
        quality,
        format,
        background,
        compression,
        useClientConfig
      })
    );
  }, [baseUrl, apiKey, model, size, quality, format, background, compression, useClientConfig]);

  useEffect(() => {
    if (!file) {
      setFilePreview(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const canUseClient = config?.allowClientConfig ?? true;
  const usingServer = !useClientConfig;

  const canSubmit = useMemo(() => {
    if (loading || !prompt.trim()) return false;
    if (mode === "edit" && !file) return false;
    if (useClientConfig && (!baseUrl.trim() || !apiKey.trim())) return false;
    if (!useClientConfig && config && !config.serverConfigured) return false;
    return true;
  }, [apiKey, baseUrl, config, file, loading, mode, prompt, useClientConfig]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setFile(selected);
  }

  async function submit() {
    setLoading(true);
    setError("");
    setLastRaw("");

    try {
      const form = new FormData();
      form.set("prompt", prompt);
      form.set("mode", mode);
      form.set("model", model || "gpt-image-2");
      form.set("size", size);
      form.set("quality", quality);
      form.set("n", String(count));
      form.set("output_format", format);
      form.set("background", background);
      form.set("output_compression", String(compression));

      if (useClientConfig) {
        form.set("baseUrl", baseUrl);
        form.set("apiKey", apiKey);
      }

      if (mode === "edit" && file) {
        form.set("image", file);
      }

      const response = await fetch("/api/image", {
        method: "POST",
        body: form
      });
      const data = await response.json();
      setLastRaw(JSON.stringify(data, null, 2));

      if (!response.ok) {
        throw new Error(data?.error || "生成失败，请检查配置。 ");
      }

      const nextImages: GeneratedImage[] = (data.images || []).map((src: string) => ({
        id: uid(),
        src,
        prompt,
        model: data.model || model,
        size,
        createdAt: new Date().toLocaleString()
      }));

      if (!nextImages.length) {
        throw new Error("上游没有返回图片。请查看 Debug 输出。 ");
      }

      setImages((current) => [...nextImages, ...current]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setLoading(false);
    }
  }

  function clearUpload() {
    setFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function randomPrompt() {
    const next = SAMPLE_PROMPTS[Math.floor(Math.random() * SAMPLE_PROMPTS.length)];
    setPrompt(next);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-black text-zinc-100 selection:bg-sky-400/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,.22),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(99,102,241,.14),transparent_24%),linear-gradient(180deg,rgba(255,255,255,.04),transparent_28%)]" />
      <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-[390px_1fr]">
        <aside className={`${sidebarOpen ? "block" : "hidden"} z-10 border-r border-white/10 bg-zinc-950/95 p-5 backdrop-blur lg:block`}>
          <header className="mb-5 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-xl border border-sky-400/30 bg-sky-400/10 shadow-glow">
                  <Sparkles className="h-5 w-5 text-sky-300" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold tracking-tight">GPT Image</h1>
                  <p className="text-xs text-zinc-500">sub2api · Cloudflare Pages</p>
                </div>
              </div>
            </div>
            <button
              className="rounded-xl border border-white/10 p-2 text-zinc-400 hover:bg-white/5 hover:text-white lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="关闭侧栏"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <section className="mb-4 rounded-2xl border border-white/10 bg-white/[.03] p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <KeyRound className="h-4 w-4" />
                API 配置
              </div>
              <span className={`rounded-full px-2 py-1 text-[11px] ${usingServer ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-200"}`}>
                {usingServer ? "Server Key" : "Client Key"}
              </span>
            </div>

            <div className="mb-3 grid grid-cols-2 rounded-xl bg-black p-1 text-xs">
              <button
                onClick={() => setUseClientConfig(false)}
                disabled={!config?.serverConfigured}
                className={`rounded-lg px-3 py-2 transition ${!useClientConfig ? "bg-white text-black" : "text-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"}`}
              >
                服务器环境变量
              </button>
              <button
                onClick={() => setUseClientConfig(true)}
                disabled={!canUseClient}
                className={`rounded-lg px-3 py-2 transition ${useClientConfig ? "bg-white text-black" : "text-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"}`}
              >
                前端填写
              </button>
            </div>

            {useClientConfig ? (
              <div className="space-y-3">
                <Field label="Base URL">
                  <input
                    className="input"
                    value={baseUrl}
                    onChange={(event) => setBaseUrl(event.target.value)}
                    placeholder="https://your-sub2api.example.com/v1"
                  />
                </Field>
                <Field label="API Key">
                  <input
                    className="input"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    type="password"
                    placeholder="sk-..."
                  />
                </Field>
              </div>
            ) : (
              <p className="rounded-xl border border-emerald-400/10 bg-emerald-400/[.06] p-3 text-xs leading-relaxed text-emerald-100/80">
                正在使用 Cloudflare Pages 的环境变量。真实 Key 不会进入浏览器源码。
              </p>
            )}
          </section>

          <section className="mb-4 grid grid-cols-2 rounded-2xl bg-zinc-900/80 p-1 text-sm">
            <button
              onClick={() => setMode("generate")}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 transition ${mode === "generate" ? "bg-white text-black" : "text-zinc-400 hover:text-white"}`}
            >
              <Wand2 className="h-4 w-4" />
              生成
            </button>
            <button
              onClick={() => setMode("edit")}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 transition ${mode === "edit" ? "bg-white text-black" : "text-zinc-400 hover:text-white"}`}
            >
              <ImagePlus className="h-4 w-4" />
              编辑
            </button>
          </section>

          <section className="space-y-4">
            <Field label="模型">
              <input className="input" value={model} onChange={(event) => setModel(event.target.value)} />
            </Field>

            <Field label="提示词">
              <div className="relative">
                <textarea
                  className="input min-h-36 resize-none pr-11 leading-relaxed"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="描述你想生成的图片..."
                />
                <button
                  className="absolute bottom-3 right-3 rounded-lg border border-white/10 bg-black/50 p-2 text-zinc-400 hover:text-white"
                  onClick={randomPrompt}
                  title="随机示例"
                  type="button"
                >
                  <RefreshCcw className="h-4 w-4" />
                </button>
              </div>
            </Field>

            {mode === "edit" && (
              <Field label="参考图片">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                {filePreview ? (
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
                    <img src={filePreview} className="max-h-48 w-full object-cover" alt="上传预览" />
                    <div className="flex items-center justify-between gap-3 p-3">
                      <p className="truncate text-xs text-zinc-400">{file?.name}</p>
                      <button className="rounded-lg bg-white/10 px-2 py-1 text-xs text-zinc-200 hover:bg-white/15" onClick={clearUpload}>
                        移除
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[.03] p-6 text-center transition hover:border-sky-400/50 hover:bg-sky-400/[.04]"
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                  >
                    <Upload className="mb-2 h-5 w-5 text-zinc-400" />
                    <span className="text-sm text-zinc-300">点击上传图片</span>
                    <span className="mt-1 text-xs text-zinc-600">PNG / JPG / WEBP</span>
                  </button>
                )}
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Select label="尺寸" value={size} onChange={setSize} options={SIZE_OPTIONS} />
              <Select label="质量" value={quality} onChange={setQuality} options={QUALITY_OPTIONS} />
              <Select label="数量" value={String(count)} onChange={(value) => setCount(Number(value))} options={["1", "2", "4", "8"]} />
              <Select label="格式" value={format} onChange={setFormat} options={FORMAT_OPTIONS} />
              <Select label="背景" value={background} onChange={setBackground} options={BACKGROUND_OPTIONS} />
              <Field label="压缩">
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  value={compression}
                  onChange={(event) => setCompression(Number(event.target.value))}
                  disabled={format === "png"}
                />
              </Field>
            </div>

            {error && <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>}

            <button
              onClick={submit}
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "生成中..." : mode === "edit" ? "开始编辑" : "生成图片"}
            </button>
          </section>
        </aside>

        <section className="relative z-0 min-w-0 p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                className="rounded-2xl border border-white/10 bg-zinc-950/80 p-3 text-zinc-300 hover:bg-white/5 lg:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="打开侧栏"
              >
                <PanelLeft className="h-5 w-5" />
              </button>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Gallery</h2>
                <p className="text-sm text-zinc-500">{images.length} 张输出 · 暗色瀑布流预览</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="rounded-full border border-white/10 bg-zinc-950/80 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5"
                onClick={() => setImages([])}
              >
                清空
              </button>
              <a
                className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs text-sky-200 hover:bg-sky-400/15"
                href="https://dash.cloudflare.com/?to=/:account/pages/new"
                target="_blank"
                rel="noreferrer"
              >
                Cloudflare Pages
              </a>
            </div>
          </div>

          {images.length === 0 ? (
            <EmptyState loading={loading} />
          ) : (
            <div className="columns-1 gap-4 sm:columns-2 xl:columns-3 2xl:columns-4">
              {images.map((image, index) => (
                <article
                  className="group mb-4 break-inside-avoid overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/80 shadow-2xl shadow-black/40"
                  key={image.id}
                >
                  <img src={image.src} alt={image.prompt} className="w-full bg-zinc-900 object-cover" loading="lazy" />
                  <div className="space-y-3 p-3">
                    <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
                      <span>#{images.length - index}</span>
                      <span>{image.model} · {image.size}</span>
                    </div>
                    <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400">{image.prompt}</p>
                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs text-zinc-200 hover:bg-white/15"
                        onClick={() => navigator.clipboard.writeText(image.src)}
                      >
                        复制 URL
                      </button>
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-medium text-black hover:bg-zinc-200"
                        onClick={() => download(image.src, `gpt-image-${image.id}.${format}`)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        下载
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {lastRaw && (
            <details className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80 text-xs text-zinc-400">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-zinc-300">
                <Settings2 className="h-4 w-4" /> Debug response
              </summary>
              <pre className="max-h-80 overflow-auto border-t border-white/10 p-4">{lastRaw}</pre>
            </details>
          )}
        </section>
      </div>
    </main>
  );
}

function EmptyState({ loading }: { loading: boolean }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center rounded-[2rem] border border-white/10 bg-zinc-950/60 bg-soft-grid bg-[size:36px_36px] p-8 text-center shadow-2xl shadow-black/40">
      <div className="max-w-sm">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl border border-white/10 bg-white/[.04] shadow-glow">
          {loading ? <Loader2 className="h-7 w-7 animate-spin text-sky-300" /> : <Eraser className="h-7 w-7 text-zinc-400" />}
        </div>
        <h3 className="text-lg font-medium text-zinc-100">图片会显示在这里</h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          左侧填写提示词和参数，调用 sub2api 的 gpt-image-2，输出后自动插入瀑布流顶部。
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <Field label={label}>
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </Field>
  );
}
