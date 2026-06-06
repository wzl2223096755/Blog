---
title: "Next.js App Router 深入浅出"
published: 2026-05-15
tags: ["Next.js", "React", "服务端组件"]
category: "技术笔记"
description: "App Router 的核心概念与架构，从路由设计到服务端组件的全面解析。"
readingTime: "预计阅读 10 分钟"
---

Next.js 的 App Router 是一次彻底的路由革命。它不只是换了个文件组织方式，而是从根本上改变了我们构建 React 应用的方式——从客户端渲染走向服务端优先。

## 为什么 App Router 是一个大版本更新？

Pages Router（即传统的 `/pages` 目录模式）从 Next.js 诞生起就陪伴着我们。它的模型很直观：文件即路由，每个页面对应一个 React 组件。但随着 React 生态的进化，这种模式逐渐暴露了瓶颈。

App Router 的诞生带来了三个核心变化：

- **服务端组件（RSC）**：组件默认在服务端渲染，减少客户端 JS 体积
- **嵌套布局**：通过 `layout.js` 实现真正的布局复用，而非手工嵌套
- **流式渲染**：结合 `loading.js` 和 `Suspense`，实现按需加载

## App Router 的核心概念

### 文件约定

App Router 使用一套约定式文件命名体系，每个特殊的文件名对应特定的 UI 行为：

```
app/
├── layout.js         # 共享布局（包裹子页面）
├── page.js           # 页面内容
├── loading.js        # 加载态 UI
├── error.js          # 错误边界
├── not-found.js      # 404 页面
├── global-error.js   # 根级错误处理
└── route.js          # API 路由（替代 pages/api）
```

### 布局嵌套

布局是 App Router 最实用的设计之一。每个文件夹可以有一个 `layout.js`，它自动包裹当前路径下的所有页面：

```
app/
├── layout.js           # 全局布局（导航栏 + 页脚）
└── dashboard/
    ├── layout.js       # 仪表盘布局（侧边栏）
    └── settings/
        └── page.js     # 同时继承两个布局
```

这种机制意味着你不再需要手工组合布局组件，Next.js 会自动为你构建布局树。更重要的是，布局在导航时**不会重新渲染**，只更新子页面内容。

## 服务端组件 vs 客户端组件

App Router 中，**所有组件默认是服务端组件**。这意味着：

- 你可以直接在组件中使用 `async/await` 获取数据
- 数据库查询、文件读取等操作在服务端安全执行
- 减少发送到客户端的 JS 体积

当你需要使用 `useState`、`useEffect`、事件处理等交互功能时，在文件顶部声明：

```js
"use client";

import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

> 关键思路：只在需要交互的地方使用客户端组件，其余保持服务端组件。你的应用体积会大幅减小，性能自然提升。

## 数据获取：服务端是起点

App Router 推荐的服务端数据获取方式直截了当：

```js
// app/posts/page.js — 这是一个服务端组件
async function getPosts() {
  const res = await fetch("https://api.example.com/posts");
  return res.json();
}

export default async function PostsPage() {
  const posts = await getPosts();
  return (
    <ul>
      {posts.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

配合 `loading.js` 和 `error.js`，你可以轻松实现流式加载和错误处理，而不需要手动管理 loading/error 状态。

## 路由组与并行路由

App Router 还提供了更高级的路由模式：

- **路由组（Route Groups）**：通过 `(groupName)` 文件夹组织路由而不影响 URL 路径
- **并行路由（Parallel Routes）**：通过 `@slot` 实现同一布局内多独立区域渲染
- **拦截路由（Intercepting Routes）**：通过 `(.)` 前缀实现模态框等模式

## 从 Pages Router 迁移建议

如果你的项目还在使用 Pages Router，不必急于全量迁移。应用策略：

- 新功能直接使用 App Router
- Pages Router 和 App Router 可以共存
- 先迁移布局（layout），再逐步迁移页面
- 注意 `getServerSideProps` → 直接 `async` 组件
- 注意 `getStaticProps` → `generateStaticParams`

## 总结

App Router 不是花哨的营销噱头，它是 React 全栈框架发展的必然方向。服务端组件 + 嵌套布局 + 流式渲染的组合，让开发者能够以更直观的方式构建高性能 Web 应用。如果你是 Next.js 新手，直接学 App Router 就好；如果已经在用 Pages Router，逐步迁移即可。

**参考资源：**

- [Next.js 官方文档 - App Router](https://nextjs.org/docs/app)
- [React 官方 - Server Components](https://react.dev/reference/rsc/server-components)
