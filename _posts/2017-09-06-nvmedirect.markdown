---
layout: post
title: "NVMeDirect"
date: "2017-09-06 20:40:37 +0900"
author: "Insu Jang"
tags: [research,pcie,io]
---

# NVMeDirect Overview

NVMeDirect is a software framework that is used to directly access to a NVMe SSD from a user space application.  

In the existing system, applications should access to a storage through several software I/O stacks.
![storage_io_stack](/assets/images/170906/storage_io_stack.png){: .center-image width="800px"}

As the storage media is getting faster, overheads by the software stack takes larger portion of I/O time. Hence, this software I/O stack is being reduced as shown in the above figure.
This software I/O stack overheads have been pointed out by several papers.
Especially, context switches between user space and kernel space are overwhelming the overhead.

Hence, this paper proposes a direct access from user space applications to NVMe SSD directly via memory-mapped I/O (MMIO).
![nvmedirect](/assets/images/170906/nvmedirect.png){: .center-image width="800px"}

# NVMeDirect Design

![nvme_design](/assets/images/170906/nvme_design.png){: .center-image width="800px"}

There is a NVMeDirect device driver in kernel space that manages queues for user space applications. User space applications use a NVMeDirect library to use I/O queues. As it is mapped to user space, the user applications don't have to switch its context to kernel space via system calls.

Due to this fundamental design, it does not use virtual file system (VFS) or any other traditional file systems. Current NVMeDirect 1.0 stores raw data, however, NVMeDirect 2.0 supports ForestFS, which is based on ForestDB database.

![forestfs](/assets/images/170906/forestfs.png){: .center-image width="800px"}

Unfortunately, current public Github repository does not contain ForestFS implementation.


### References
- [NVMeDirect: A User-space I/O Framework for Application-Specific Optimizations on NVMe SSDs](https://www.usenix.org/system/files/conference/hotstorage16/hotstorage16_kim.pdf)
- [NVMeDirect Slides](https://www.usenix.org/sites/default/files/conference/protected-files/hotstorage16_slides_kim.pdf), HotStorage '16
- [NVMeDirect 2.0](https://www.flashmemorysummit.com/English/Collaterals/Proceedings/2017/20170810_FA31_Kim.pdf), Flash Memory Summit '17
