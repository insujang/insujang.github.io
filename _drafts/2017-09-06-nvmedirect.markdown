---
layout: post
title: "NVMeDirect"
date: "2017-09-06 20:40:37 +0900"
author: "Insu Jang"
tags: [research,pcie,io]
---

NVMeDirect is a software framework that is used to directly access to a NVMe SSD from a user space application.  

In the existing system, applications should access to a storage through several software I/O stacks.
![storage_io_stack](/assets/storage_io_stack.png){: .center-image width="800px"}

As the storage media is getting faster, overheads by the software stack takes larger portion of I/O time. Hence, this software I/O stack is being reduced as shown in the above figure.
This software I/O stack overheads have been pointed out by several papers.
