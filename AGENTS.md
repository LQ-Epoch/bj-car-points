# AGENTS.md

## 发布流程（本项目）

硬性要求：**每次 build 没问题，必须直接推送到 main，并立即部署到 Cloudflare。**

每次功能改动后，按下面顺序执行：

1. **Build 校验**
   - 命令：`npm run build`
   - 要求：构建成功（允许 Next.js 的 TypeScript 推荐版本 warning）

2. **推送到 main**
   - 命令：
     - `git add .`
     - `git commit -m "<你的提交说明>"`
     - `git push origin main`

3. **部署到 Cloudflare Pages**
   - 命令：
     - `npx wrangler pages deploy out --project-name bj-car-points --branch main`

## 说明

- 本项目使用 Next.js 静态导出（`output: "export"`），部署目录是 `out/`。
- 若 Cloudflare API 临时报错（如 503），可直接重试部署命令。
- 线上固定地址：`https://bj-car-points.pages.dev`
