---
layout: post
title: "Using Jekyll with Atom Editor"
date: "2017-04-01 09:55:05 +0900"
tags: [jekyll]
---

![atom](https://github-atom-io-herokuapp-com.global.ssl.fastly.net/assets/logo@2x-a922b71bfaf4cdc1dcf7a5ea29b92a91.png){: .center-image}

![](https://github-atom-io-herokuapp-com.global.ssl.fastly.net/assets/screenshot-main@2x-f5f56d18fa8896b3d987d24fc903d03f.png){: width="860px", height="390px",}

[Atom](https://atom.io/) is a modern, approachable text editor.  
Until the last year, I had used Sublime Text for a text editor. However, after I saw some post examining Atom, I switched to it.  
It is as modern as Sublime Text, and plugins are much much more powerful, I think.

I am using Markdown (Especially, Markdown Preview), Latex, Git, and Jekyll package on Atom. Here are some default shortcuts that I want to remember.

\*\* Note: I have to look what is provided by [kramdown syntax](https://kramdown.gettalong.org/syntax.html), because Github Pages only supports kramdown and makrdown engines are slightly different from each other.



#### [Markdown Preview Enhanced](https://atom.io/packages/markdown-preview-enhanced)
It shows Markdown result in real time. Not perfectly suitable to Jekyll, but still good to see it roughly.
- Toggle Preview: <kbd>Shift</kbd> + <kbd>Control</kbd> + <kbd>M</kbd>, or <kbd>&#8679;</kbd> + <kbd>&#8984;</kbd> + <kbd>M</kbd>
- Insert Image (Image Helper): <kbd>Shift</kbd> + <kbd>Control</kbd> + <kbd>I</kbd>, or <kbd>&#8679;</kbd> + <kbd>&#8984;</kbd> + <kbd>I</kbd>  
This is an awesome feature, because it was hard to organize images in Markdown (except those in the web). However, Image Helper automatically copies the image to specified location (In my case, set `/assets/images`)
![atom_markdown_image_helper](/assets/images/atom_markdown_image_helper.png){: width="601px"}

### [Latex](https://atom.io/packages/latex)
With pdfview plugin, I can see a compiled result right after clicking the build shortcut.
- Build: <kbd>Control</kbd> + <kbd>Alt</kbd> + <kbd>B</kbd>
- Clean: <kbd>Control</kbd> + <kbd>Alt</kbd> + <kbd>C</kbd>

### [Git Plus](https://atom.io/packages/git-plus)
Using this plugin, I no longer have to use Github desktop, manually committing and pushing modified files in a separate window.  
There are too many shortcuts, it would be better to use a menu.
- Menu: <kbd>Shift</kbd> + <kbd>Command</kbd> + <kbd>H</kbd>  
We can add, add and commit, add and commit and push, etc.

### [Jekyll](https://atom.io/packages/jekyll)
At the first time, I committed and pushed to see a change, which was really burdensome. I had no choice but to install Jekyll in a local machine, and run a local server temporarily to see the change. After seeing the result, I can push it only if it is good.
- New Post: <kbd>Option</kbd> + <kbd>Command</kbd> + <kbd>J</kbd>
It creates a default template (Jekyll format).
- Toggle Server: <kbd>Shift</kbd> + <kbd>Option</kbd> + <kbd>T</kbd>  
It starts or stops the local server. Whenever I hit the save shortcut (<kbd>&#8984;</kbd> + <kbd>S</kbd>), it automatically re-build my blog and I can see it in a web browser (`localhost:3000`).
![jekyll_plugin](/assets/images/jekyll_plugin.png){: height="100px"}

#### Reference
- Atom: [https://atom.io/](https://atom.io/)
- MacOS command unicode: [http://tech.karbassi.com/2009/05/27/command-option-shift-symbols-in-unicode/](http://tech.karbassi.com/2009/05/27/command-option-shift-symbols-in-unicode/)
