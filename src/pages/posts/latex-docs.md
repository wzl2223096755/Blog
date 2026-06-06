---
title: "用 LaTeX 写技术文档：从入门到实践"
date: "2026.02.05"
tags: ["LaTeX", "文档写作", "排版"]
description: "从模板选择到排版技巧的 LaTeX 实践总结，适合技术写作初学者。"
readingTime: "预计阅读 12 分钟"
layout: ../../layouts/PostLayout.astro
---

在技术写作领域，选择正确的工具往往比写作本身更能影响最终成果的质量。LaTeX 作为一个存在了四十多年的排版系统，至今仍然是学术界和工程界的首选。这篇文章将带你从零搭建 LaTeX 写作环境，并分享一些实践中积累的技巧。

## 为什么选择 LaTeX？

很多开发者初次接触文档写作时，会自然而然地选择 Word 或 Markdown。这两种工具各有优势，但在面对大型技术文档时，它们的局限性就显现出来了。

Word 的优势在于所见即所得（WYSIWYG），但当你需要维护一个包含数十个章节、上百张图表、数千条引用的技术手册时，手动调整编号、格式和交叉引用会变成一场噩梦。Markdown 虽然轻量且版本控制友好，但在复杂排版需求面前力不从心——表格不够灵活，数学公式支持有限，图片排版也难以精细控制。

LaTeX 的核心理念与它们截然不同：**内容与样式分离**。你只需要专注于写作内容，排版交给 LaTeX 引擎处理。这意味着：

- **自动化编号**：章节、公式、图表、引用全部自动编号，无需人工维护
- **一致的排版**：整篇文档的字体、间距、页眉页脚风格统一
- **纯文本源文件**：天然适合 Git 版本控制，协作 diff 一目了然
- **图灵完备**：你可以在文档中定义宏、写循环、条件判断，生成复杂内容

> 一句话总结：如果你写过上百页的技术文档，就会理解为什么 LaTeX 爱好者会说"Word 是打字机，LaTeX 是排版系统"。

## 环境搭建

### 本地方案：TeX Live

TeX Live 是跨平台的 LaTeX 发行版，包含所有核心宏包和工具链。安装命令因系统而异：

```bash
# macOS (Homebrew)
brew install --cask mactex

# Ubuntu / Debian
sudo apt install texlive-full

# Windows
# 从 https://tug.org/texlive 下载 install-tl-windows.exe
```

完整安装约 5-8 GB，如果你空间有限，可以选择 `texlive-base` 或 `texlive-latex-extra` 等精简方案。安装完成后，用 `pdflatex` 或 `xelatex` 编译即可。

### 在线方案：Overleaf

对于不想折腾环境或需要协作的场景，[Overleaf](https://www.overleaf.com) 是最佳选择。它提供：

- 浏览器内编辑 + 实时预览
- 多人协作（类似 Google Docs 的体验）
- 丰富的模板库（论文、简历、书籍、演示文稿）
- Git 集成，方便本地备份

我个人推荐的方式是：本地用 VS Code + LaTeX Workshop 插件编写，Overleaf 用于协作评审。VS Code 的智能补全、代码片段和 Git 集成让写作体验大幅提升。

## 文档结构入门

一个标准的 LaTeX 文档分为导言区（Preamble）和正文区。以下是中文技术文档的典型框架：

```latex
% 导言区
\documentclass[UTF8]{ctexart}

% 宏包引用
\usepackage{amsmath, amssymb}   % 数学公式
\usepackage{graphicx}           % 图片
\usepackage{booktabs}           % 三线表
\usepackage{listings}           % 代码展示

% 标题信息
\title{基于深度学习的图像分割技术综述}
\author{王忠亮}
\date{\today}

\begin{document}

\maketitle
\tableofcontents

% 正文区
\section{引言}
...

\section{相关工作}
...

\section{实验分析}
...

\bibliographystyle{plain}
\bibliography{references}

\end{document}
```

## 数学公式

这是 LaTeX 最强大的领域之一。行内公式用 `$...$`，独立公式用 `\[ ... \]`：

```latex
% 行内公式
欧拉公式 $e^{i\pi} + 1 = 0$ 被誉为最美公式。

% 独立公式
\[
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
\]

% 多行公式（align 环境）
\begin{align}
E &= mc^2 \\
\nabla \times \mathbf{B} &= \mu_0 \mathbf{J} + \mu_0\varepsilon_0 \frac{\partial \mathbf{E}}{\partial t}
\end{align}
```

`amsmath` 宏包提供了几乎所有需要的数学环境：`align` 用于多行对齐，`cases` 用于分段函数，`matrix` 用于矩阵。对开发者来说，掌握 10 个左右的数学环境就能覆盖 90% 的公式需求。

## 表格与图片

### 三线表

学术表格推荐使用 `booktabs` 宏包的三线表风格，简洁专业：

```latex
\begin{table}[htbp]
  \centering
  \caption{不同模型的性能对比}
  \begin{tabular}{lccc}
    \toprule
    模型 & 准确率 & 参数量 & 推理时间 \\
    \midrule
    ResNet-50 & 76.1% & 25.6M & 12ms \\
    ResNet-101 & 77.3% & 44.5M & 19ms \\
    ViT-B/16 & 78.0% & 86.6M & 25ms \\
    \bottomrule
  \end{tabular}
\end{table}
```

### 插图

```latex
\begin{figure}[htbp]
  \centering
  \includegraphics[width=0.8\textwidth]{figures/architecture.pdf}
  \caption{模型整体架构图}
  \label{fig:architecture}
\end{figure}
```

使用 `\label` 和 `\ref` 实现交叉引用，LaTeX 会自动维护编号，你只需要写 `如图~\ref{fig:architecture} 所示` 即可。

## 参考文献管理

BibTeX 是 LaTeX 生态中最经典的参考文献管理方案。你需要一个 `.bib` 文件存放所有引用条目：

```bibtex
@article{goodfellow2014gan,
  title     = {Generative Adversarial Nets},
  author    = {Goodfellow, Ian and Pouget-Abadie, Jean and Mirza, Mehdi and others},
  journal   = {Advances in Neural Information Processing Systems},
  year      = {2014},
  volume    = {27}
}

@book{knuth1984tex,
  title     = {The TeXbook},
  author    = {Knuth, Donald Ervin},
  year      = {1984},
  publisher = {Addison-Wesley}
}

@inproceedings{vaswani2017attention,
  title     = {Attention Is All You Need},
  author    = {Vaswani, Ashish and Shazeer, Noam and Parmar, Niki and others},
  booktitle = {Advances in Neural Information Processing Systems},
  year      = {2017}
}
```

在文档中通过 `\cite{goodfellow2014gan}` 引用，LaTeX 会自动生成参考文献列表。配合 `natbib` 或 `biblatex` 宏包，还可以定制引用格式（数字标号、作者-年份等）。

> 技巧提示：在 Overleaf 中可以直接搜索 DOI 自动生成 BibTeX 条目，也可以使用 JabRef（桌面）或 Zotero + Better BibTeX 插件管理你的文献库。

## 中文支持与 ctex 宏包

对于中文技术文档，`ctex` 宏包是标配。它提供了：

- **中文排版支持**：自动处理中英文混排、标点压缩、行距调整
- **中文字体配置**：内置宋体（\songti）、黑体（\heiti）、楷体（\kaishu）等
- **文档类适配**：`ctexart`（文章）、`ctexrep`（报告）、`ctexbook`（书籍）、`ctexbeamer`（演示）
- **中文目录与标题**：自动将 "Contents" 变为 "目录"，"Abstract" 变为 "摘要"

使用方式很简单，将 `\documentclass{article}` 替换为 `\documentclass[UTF8]{ctexart}` 即可。编译时推荐使用 `xelatex` 而不是 `pdflatex`，以更好地支持 Unicode 和中文字体。

## 开发者专属宏包

如果你的文档需要大量展示代码，以下两个宏包必不可少：

### listings — 轻量代码展示

```latex
\usepackage{listings}
\lstset{
  language=Python,
  basicstyle=\ttfamily\small,
  keywordstyle=\color{blue},
  commentstyle=\color{gray},
  numbers=left,
  frame=single,
  breaklines=true
}

\begin{lstlisting}
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)
\end{lstlisting}
```

### minted — 高级语法高亮

`minted` 基于 Pygments 引擎，提供更强大的语法高亮支持。使用前需安装 Pygments：`pip install Pygments`，编译时加 `--shell-escape` 参数：

```latex
\usepackage{minted}
\begin{minted}{python}
import numpy as np
x = np.linspace(0, 10, 100)
y = np.sin(x)
print(f"Max value: {y.max():.3f}")
\end{minted}
```

`minted` 支持数百种编程语言，高亮效果比 `listings` 精致得多。不过由于依赖外部工具，配置稍复杂。简单的代码片段用 `listings`，复杂的项目代码推荐 `minted`。

其他对开发者有用的宏包还包括：

- **algorithm2e**：伪代码和算法排版
- **glossaries**：术语表与缩写词管理
- **hyperref**：PDF 超链接、书签和元数据
- **cleveref**：智能交叉引用（自动加上"图""表""式"等前缀）
- **tikz**：直接在 LaTeX 中绘制矢量图形

## 工作流建议

最后分享几条实践中的经验：

- **模块化组织**：将章节拆分成独立 `.tex` 文件，用 `\input` 或 `\include` 引入，方便多人协作和大文档复用
- **版本控制**：不要提交编译产物（`.aux`、`.log`、`.pdf`），在 `.gitignore` 中排除它们
- **持续编译**：使用 `latexmk` 自动跟踪依赖并增量编译，省去手工多次编译的烦恼
- **模板复用**：维护一个自己的 LaTeX 模板仓库，从论文到技术手册统一风格

## 总结

LaTeX 的学习曲线确实比 Word 陡峭，但它的回报同样丰厚。一旦适应了"内容与样式分离"的思维模式，你会发现写技术文档变成了一件极其愉悦的事——你关心逻辑，LaTeX 关心美观。对于需要频繁产出高质量技术文档的开发者来说，这一投入的性价比很高。

如果本文让你对 LaTeX 产生了兴趣，推荐从 Overleaf 的[官方文档](https://www.overleaf.com/learn)开始，或者直接打开一个模板写一篇小文档试试。写得越多，掌握越深。

**参考资源：**

- [Overleaf 官方文档 - Learn LaTeX](https://www.overleaf.com/learn)
- [TeX Live 官方网站](https://tug.org/texlive/)
- [CTAN - ctex 宏包](https://ctan.org/pkg/ctex)
- [LaTeX 源码仓库（GitHub）](https://github.com/latex3/latex2e)
