---
layout: post
title: "Code Server: Using vscode via Web Browsers"
date: 2019-11-10 14:05
category: 
author: Insu Jang
tags: [electron, linux]
summary: 
---

![vscode in safari and app](/assets/images/191110/vscode.png)
*vscode running as a standalone app (lower right), and vscode frontend UI running in Safari web browser (upper left). Their looks are nearly identical except for menu, etc.*

# Visual Studio Code

[Visual Studio Code](https://code.visualstudio.com), implemented and managed by Microsoft, is one of the best open-source code editors over the world.
I'am using this too for almost every works; programming codes, writing Markdowns, writing Latex, etc. With tremendous number of plugins, its functionality is nearly limitless.

Visual Studio Code is based on ***[Electron](https://electronjs.org)***.
Thanks to the architecture of Electron-based apps, vscode is now able to run on web browsers (specifically, its frontend user interface parts).

# Electron

[Electron](https://electronjs.org) is a library for building cross-platform desktop apps, by using **HTML, CSS, and Javascript**. Electron uses Chromium and Node.js to package codes into an app for Windows, Linux, and macOS. 

Electron uses two different types of processes:
- Main process: runs `main` script that can display a GUI by creating web pages.
- Renderer process: each web page that is created by the `main` script is rendered by a renderer process.

Electron uses Chromium's multi-process architecture to divide roles of the processes. Normally, web pages are isolated in a sandboxed environment, but Electron provides [several methods](https://electronjs.org/docs/faq#how-to-share-data-between-web-pages) for communication, such as the IPC system, or [the remote module](https://electronjs.org/docs/api/remote) for RPC style communication.

Simplay, the Elctron application architecture looks like this:

![electron application architecture](/assets/images/191110/electron-architecture.png){: .center-image width="800px"}
*Electron application architecture.*

# code-server

> **Disclaimer**: Below are my personal thought and may not same with how actually it works.

code-server modifies the Electron architecture (especially the main process), to make it as a HTTP host server, instead of directly rendering app UI using Chromium v8 rendering engine in the machine.

![code-server architecture](/assets/images/191110/code-server-architecture.png){: .center-image}

the main process in Electron architecture renders UI through Chromium's rendering engine (Blink, in my guess) to render UIs.
Instead of rendering pages in the machine where the main process is running, code-server **modifies the main process** that now waits HTTP requests for these app pages. When users access to it via their web browsers, the main process sends web pages (vscode's app page!) through HTTP, so users can see vscode interface via the web browsers.

# Why is it useful?

Microsoft recently introducced [vscode remote development](https://code.visualstudio.com/docs/remote/remote-overview) feature.

![remote development architecture](https://code.visualstudio.com/assets/docs/remote/remote-overview/architecture.png)
*vscode remote development overview.*

While this drastically improves remote server development, the main disadvantage of this is that local OS still needs to be able to run vscode.

As iPad introduced iPadOS and Samsung introduced Samsung Dex, the boundary between tablets and laptops are dimming, however, its architectural and OS difference are still not able to provide PC-like environment in software development.

`code-server` is definitely another step forward to evloution of software development tools; you can build your code anywhere, anytime with any devices; laptops, tablets, and even phones.

# How about [Visual Studio Online](https://visualstudio.microsoft.com/services/visual-studio-online/)?

![vscode online](https://visualstudio.microsoft.com/wp-content/uploads/2019/11/visual-studio-online-hero.png)

Microsoft further improves Visual Studio Code, now released vscode online, fully cloud-powered online development environment; similarly to code-server, we can access IDE via browser.
As it is in alpha phase, it should be incubated more right now. It should be further integrated into Visual Studio Code than code-server later.

# References

- [Electron Application Architecture](https://electronjs.org/docs/tutorial/application-architecture)
- [Electron을 이용한 Annotation tool 개발기 (Korean)](https://linewalks.com/archives/6240)
- [Natural Language Processing Systems (referenced Electron architecture image)](https://www.paulprae.com/natural-language-processing-systems/)
- [Electron: 4 things to watch out for before you dive in](https://medium.com/@vishaldwivedi13/electron-things-to-watch-out-for-before-you-dive-in-e1c23f77f38f)