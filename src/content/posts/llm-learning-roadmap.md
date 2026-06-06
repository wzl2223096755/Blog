---
title: "LLM 入门学习路线：从零开始的实践记录"
published: 2026-06-05
tags: ["LLM", "AI", "LangChain", "入门学习"]
category: "学习笔记"
description: "从零开始的 LLM 入门路线，含精选资源与实战记录。"
---

这篇文章记录我从零开始入门 LLM（大语言模型）的学习路线和实践过程，包括精选的学习资源、环境搭建经验和实战练习记录。

## 为什么学 LLM？

不是跟风。而是意识到：LLM 正在改变软件的形态。从 ChatBot 到 Agent，从 RAG 到 Function Calling，这些不是概念游戏 — 它们是新一代应用的基础设施。所以决定系统性地入门，而不是东一榔头西一棒槌地看碎片文章。

## 学习资源清单

经过筛选，以下是我认为最值得投入时间的资源：

### 精选仓库

| 仓库 | 说明 | 状态 |
|------|------|------|
| [Shubhamsaboo/awesome-llm-apps](https://github.com/Shubhamsaboo/awesome-llm-apps) | Agent、RAG、Voice AI 实战项目集 | ✅ 已下载 |
| [microsoft/generative-ai-for-beginners](https://github.com/microsoft/generative-ai-for-beginners) | 微软 18 课入门，有中文版 | 📌 已下载 |
| [mlabonne/llm-course](https://github.com/mlabonne/llm-course) | 社区公认最好的 LLM 学习路线 | 📌 待看 |
| [openai/openai-cookbook](https://github.com/openai/openai-cookbook) | OpenAI 官方代码示例 | 📌 待看 |
| [punkpeye/awesome-ai-agents](https://github.com/punkpeye/awesome-ai-agents) | AI Agent 大全，找灵感用 | 📌 待看 |

## 环境搭建

我的开发环境如下：

- **Python**：3.12.9（虚拟环境 venv）
- **框架**：LangChain
- **模型**：DeepSeek API
- **项目目录**：`~/langchain-demo/`

搭建过程很顺利。Python 虚拟环境用 venv 创建，然后 pip install langchain 就行。DeepSeek 的 API key 放到 .env 文件里，用 python-dotenv 加载。这是基本但干净的项目结构。

## 练习记录

### 1. hello_langchain.py — 第一个 LangChain 脚本

最简单的调用：通过 LangChain 的 ChatOpenAI 接口（设置 base_url 指向 DeepSeek API）完成一次对话。验证了环境的联通性，也确认了 DeepSeek 模型的响应质量。

### 2. test_gen.py — 测试用例自动生成器

这是第一个有实际价值的练习。写了一个脚本：

- 输入：接口描述（API endpoint、参数、返回格式）
- 输出：测试用例（正常情况、边界值、异常输入）
- 用 LangChain 的 PromptTemplate 做模板化提示词

让它生成一个简单的 REST API 测试用例，效果不错。核心就是一个好的 prompt + 模型的理解能力。

### 3. LangChain vs 裸 API — Agent 循环对比

为了理解 LangChain 到底封装了什么，做了一个对比实验：

- **裸 API**：自己维护对话历史，手动拼接系统提示和用户消息，处理 token 计数
- **LangChain**：用 ChatMessageHistory 管理上下文，PromptTemplate 做模板，输出解析器处理回复

结论：LangChain 的价值在于抽象了通用模式（对话管理、模板、工具调用），但理解底层机制后，小项目用裸 API 更灵活。

### 4. rag_demo.py — 最小 RAG 演示

RAG（检索增强生成）是目前 LLM 应用最热门的模式之一。做一个最简单的版本：

- 用一个小文档库作为知识源
- 用户提问后，先把问题向量化，检索最相关的文档片段
- 把检索到的片段作为上下文注入 prompt，让模型基于这些信息回答

这个练习让我理解了 RAG 的核心链路：**文档 → 分块 → 向量化 → 存储 → 检索 → 注入 → 生成**。LangChain 在这条链路上提供了不错的工具封装。

## 我的学习策略

不求多，求准。不求全记，求用得上的能调。

- 遇到一个问题 → 去找对应的工具/文章 → 动手实现 → 提取能复用的模式
- 不追求看完所有课程，追求能上手做东西
- 用日记把学到的记下来，需要的时候能搜到就行

## 下一步计划

- 系统学习微软 generative-ai-for-beginners 课程
- 深入 Agent 方向：工具调用、多 Agent 协作
- 做一个有点实际价值的项目

## 总结

LLM 入门并不神秘。搭环境、调 API、写 demo，和学任何新技术没什么两样。真正有价值的是动手做东西的时候踩的坑和想通的事 — 那些才是自己的。
