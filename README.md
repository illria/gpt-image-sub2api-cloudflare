# GPT Image Gallery · sub2api · Cloudflare Pages

一个和你截图类似的暗色 GPT Image 前端：左侧参数面板，右侧瀑布流 Gallery，通过 Cloudflare Pages Functions 调用你的 sub2api 中转站，默认模型为 `gpt-image-2`。

![UI idea](./public/preview-note.svg)

## 功能

- 暗色控制台 UI，接近 Midjourney/Gallery 工作台风格
- 生成 / 编辑两种模式
- 支持 Base URL、API Key、模型、尺寸、质量、数量、格式、背景、压缩参数
- 右侧瀑布流 Gallery，生成结果自动插入顶部
- 支持下载图片、复制图片 URL/Data URL
- 支持 Cloudflare Pages Functions 代理上游，生产环境不暴露 API Key
- 支持本地调试时在前端填写 sub2api Key

## 技术栈

- React + Vite + TypeScript
- Tailwind CSS
- Cloudflare Pages Functions
- sub2api / OpenAI-compatible Images API

## 快速开始

```bash
npm install
npm run dev
```

前端开发服务器默认是 Vite。若要本地模拟 Cloudflare Pages Functions：

```bash
cp .env.example .dev.vars
npm run pages:dev
```

`.dev.vars` 示例：

```env
SUB2API_BASE_URL=https://your-sub2api.example.com/v1
SUB2API_API_KEY=sk-your-key
SUB2API_MODEL=gpt-image-2
ALLOW_CLIENT_CONFIG=true
```

## Cloudflare Pages 一键部署思路

推荐使用 Pages，因为它可以直接连接 GitHub，并且 `functions/api/image.ts` 会自动作为后端 API 运行。

1. 把本项目 push 到 GitHub。
2. 打开 Cloudflare Dashboard → Workers & Pages → Pages → Create project → Connect to Git。
3. 选择你的 GitHub 仓库。
4. Framework preset 选择 `React (Vite)`，或者手动填写：
   - Build command: `npm run build`
   - Build output directory: `dist`
5. Environment variables 添加：
   - `SUB2API_BASE_URL`：你的 sub2api 地址，例如 `https://xxx.example.com/v1`
   - `SUB2API_API_KEY`：你的 sub2api key
   - `SUB2API_MODEL`：`gpt-image-2`
   - `ALLOW_CLIENT_CONFIG`：建议生产环境填 `false`
6. Deploy。

Cloudflare Pages 入口：<https://dash.cloudflare.com/?to=/:account/pages/new>

## 推送到 GitHub

已有空仓库时：

```bash
chmod +x scripts/push-github.sh
./scripts/push-github.sh your-github-name/gpt-image-gallery
```

还没有仓库，但本机装了 GitHub CLI 时：

```bash
chmod +x scripts/create-and-push-github.sh
./scripts/create-and-push-github.sh your-github-name/gpt-image-gallery private
```

`private` 可以改成 `public`。

## API 路由

### `GET /api/config`

返回服务端配置状态，不返回密钥。

### `POST /api/image`

前端以 `FormData` 调用。服务端会根据是否上传了 `image` 自动选择：

- 纯文本生成：`/v1/images/generations`
- 上传图片编辑：`/v1/images/edits`

常用字段：

```txt
prompt
mode=generate|edit
model=gpt-image-2
size=1024x1024|1024x1536|1536x1024|auto
quality=auto|low|medium|high
n=1|2|4|8
output_format=png|jpeg|webp
background=auto|opaque|transparent
output_compression=0..100
```

## 生产建议

- 生产环境不要启用 `ALLOW_CLIENT_CONFIG=true`，避免用户把 Key 传到浏览器端输入框。
- 如果 sub2api 返回 `model_not_found`，需要在 sub2api 后台把 `gpt-image-2` 映射到你上游实际可用的图片模型。
- 如果生成大图或一次生成 8 张，Cloudflare/上游可能遇到请求体或响应体限制，建议先用 `n=1` 测试。


## 可选：GitHub Actions 自动部署

仓库里已经包含 `.github/workflows/cloudflare-pages.yml`。如果你不想使用 Cloudflare Dashboard 的 Git 集成，也可以在 GitHub 仓库 Secrets 里添加：

```txt
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_PAGES_PROJECT_NAME
```

之后 push 到 `main` 或手动运行 workflow 即可部署。

## 手动部署命令

```bash
npm install
npm run build
npx wrangler pages deploy dist
```

## 目录结构

```txt
gpt-image-sub2api-cloudflare/
  functions/
    api/
      config.ts
      image.ts
  src/
    App.tsx
    index.css
    main.tsx
  public/
    _headers
  scripts/
    push-github.sh
    create-and-push-github.sh
  wrangler.toml
  package.json
```

## License

MIT
