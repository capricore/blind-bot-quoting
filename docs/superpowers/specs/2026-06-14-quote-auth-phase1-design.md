# 子项目 2+3 · Phase 1 — quote 登录/注册 + 按邮箱关联（设计）

> 日期：2026-06-14 · 作者：Yan Yan（与 Claude 协作）
> 范围：sub-projects 2（登录/注册页）+ 3（跨系统开通/关联）的**第一期**。
> 上游决策：架构选 **B**（quote 自建独立身份），auth + 数据走 **Supabase**（quote 自己的项目，白标干净）。

## 1. 范围

**做（phase 1）**
- quote 服务接入 **Supabase Auth**：**Continue with Google** + **邮箱/密码** 注册登录。
- Supabase(Postgres) 建一张 **`profiles`** 表（应用层用户资料 + 与 blind-bot 的关联标记）。
- 首次登录时：建 profile；拿 email 调 blind-bot `GET {BLINDBOT_API_URL}/lookup-api-key?email=` —— **同邮箱 → 标记已关联**；不同邮箱 → 独立账号。
- 白标登录页（quote 品牌，无 BlindBot 痕迹）。

**明确推迟**
- **"Continue with BlindBot"**（需要 blind-bot server 加对外身份/profile 接口 + 解决按钮命名与白标冲突）→ phase 2。
- 把现有 **quotes / orders 从 SQLite 迁到 Postgres** → 紧接其后的一步（phase 1b）。phase 1 期间业务数据仍在 SQLite，auth/profiles 在 Supabase（过渡态，可接受）。
- quote 应用整体改名/换 logo（白标横切线，任务 6）。

## 2. 关键技术决策（★ = 想请你点头）

| # | 决策 | 说明 |
|---|---|---|
| D1 | 架构 B + Supabase（auth+数据） | 已定 |
| D2 | phase 1：Google + 邮箱登录、`profiles` 表、邮箱关联；其余推迟 | 见范围 |
| D3 | Google 用 **`signInWithOAuth` 重定向流**（不用 GSI 按钮流） | 更简单稳；依赖已配的 Supabase callback + Site URL。需要一个 `/auth/callback` 路由收 code |
| D4 ★ | **会话用 `@supabase/ssr`（cookie）**，让服务端组件也能读登录态 | quote 大量用服务端组件，cookie 方案集成更顺；比 blind-bot 的"客户端 localStorage"更适合这里 |
| D5 ★ | 关联**只存非机密标记**（`blindbot_linked_at` + 匹配到的标识），**不存 blind-bot 的 api_key** | `lookup-api-key` 会返回 apiKey，但把它落到 quote 库里等于散布凭据；phase 1 只记"存在匹配"。等以后真要替用户调 blind-bot 时再设计 |
| D6 ★ | phase 1 **不强制任何页面登录**（登录页可用、能注册/关联即可） | 把 quotes/orders 挂到用户名下、做路由保护，留到数据迁 Postgres 时一起 |

## 3. 数据：`profiles` 表（Supabase / Postgres）

```sql
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  company       text,
  -- 与 blind-bot 的关联（仅非机密标记，不存 api_key）
  blindbot_linked_at timestamptz,
  blindbot_email     text,
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
```

> profile 的创建 + blind-bot 关联在**服务端**做（需要调 blind-bot），不用 DB 触发器。

## 4. 改动点（quote 仓库）

- 依赖：`@supabase/supabase-js` + `@supabase/ssr`。
- `lib/supabase/client.ts`（浏览器端 client）、`lib/supabase/server.ts`（服务端 client，读 cookie）。
- `app/login/page.tsx` —— 白标登录/注册页：Continue with Google（`signInWithOAuth`）+ 邮箱/密码（`signUp` / `signInWithPassword`）。
- `app/auth/callback/route.ts` —— OAuth 回调，交换 code、写 session cookie。
- `app/api/auth/sync/route.ts`（或登录后调用）—— upsert profile + 调 blind-bot `lookup-api-key` 写关联标记。
- env：已在 `.env.local`（`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`NEXT_PUBLIC_GOOGLE_CLIENT_ID`、`BLINDBOT_API_URL`）。
- 本地：quote dev server 跑在 **3001**（避开 blind-bot 3000，且与 Google origin / Supabase Site URL 一致）。

## 5. 验收（phase 1）

1. 开 `/login` → **Continue with Google** 能登入；登录弹窗显示 **quote 品牌**（非 BlindBot）。
2. **邮箱注册 + 登录**可用。
3. 首次登录后 Supabase `profiles` 多一行；若该 email 在 blind-bot 存在 client → 该行 `blindbot_linked_at` 有值。
4. quote 页面**无任何 BlindBot 字样**。
5. 现有 quotes/orders 流程（SQLite）不受影响。

## 6. 待确认 / 开放项
- O1：D4/D5/D6 三个 ★ 取舍请确认。
- O2：登录后默认落地到哪个页面（Dashboard？）。
- O3：blind-bot server 的 `lookup-api-key` 是否允许从 quote 服务端跨域调用（CORS / 是否需要 secret）——build 时验证。
