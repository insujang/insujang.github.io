---
layout: post
title: "Managing Github Pages blog with VScode and Jekyll"
date: 2019-09-28 14:31
category: 
author: "Insu Jang"
tags: [jekyll]
summary: 
---

In recent days, I barely managed my blog after graduation. Switching my most favorite code editor from Atom to VScode also makes it hard, since there is no plugins such like [Jekyll Atom](https://atom.io/packages/jekyll). It provides an integrated Jekyll commands, and several tools for post management. There is a plugin named [Jekyll Snippets](https://marketplace.visualstudio.com/items?itemName=ginfuru.vscode-jekyll-snippets) in VScode marketplace, , but I don't think it is not comparable to Atom's plugin.

As I do not want to use several editors, I kept looking for a way to manage my blog with VScode, and I found a reasonable one: using [VScode insider](https://code.visualstudio.com/insiders/), [Docker Jekyll](https://hub.docker.com/r/jekyll/jekyll/) and [jekyll-post plugin](https://marketplace.visualstudio.com/items?itemName=rohgarg.jekyll-post).

Each has the following advantages:

- VScode insider: you can access files in a remote session through SSH. My laptop is also able to run Docker, however, I prefer to put all works in the server, so that I can access them without checking out files into local computers.

![vscode_insiders](/assets/images/190928/vscode_insiders.png){:  width="300px"}
*Those files are stored in my server.*

- Docker Jekyll: A main advantage of using Docker is that dependent packages are isolated, so each applications can be modulized as standalone. By using [Docker Jekyll](https://hub.docker.com/r/jekyll/jekyll/), we do not have to take care of any dependencies: just one command is enough to run it.

```
$ docker run --rm --volume="$PWD:/srv/jekyll" --it -p 4000:4000 jekyll/jekyll jekyll serve
```

![jekyll](/assets/images/190928/jekyll.png){: width="700px"}

That's it. `$PWD` is the root directory of my Github Pages repository, everything else is managed by Jekyll in the container. As the directory is bound inside to the container, Jekyll recognizes the change and regenerates the local site right after I save a file, then I can see the result in the browser.

With this setup, now I can manage the blog wherever with any computers, without duplicately cloning the repository.
A brief diagram of editing is as follows.

![diagram](/assets/images/190928/vscode.png){: .center-image width="700px"}