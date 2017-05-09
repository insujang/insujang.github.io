---
layout: post
title: "Usermode Helper API"
date: "2017-05-10 00:45:16 +0900"
author: "Insu Jang"
tags: [research, linux]
---

We already know that `fork()` and `exec()` are system calls for making a new process from user space.

However, system calls cannot be called in kernel space. Then how to execute a process from kernel space?  
Usermode Helper API is for creating a user mode process from kernel space.

Data structure that is used for the API is `struct subprocess_info`.

```c
/linux/include/kmod.h

struct subprocess_info {
	struct work_struct work;
	struct completion* complete;
	const char* path;
	char** argv;
	char** envp;
	int wait;
	int retval;
	int (*init)(struct subprocess_info* info, struct cred* new);
	void (*cleanup)(struct subprocess_info* info);
	void* data;
};
```

Simple example from the reference:

```c
#include <linux/kmod.h>

struct subprocess_info* sub_info;
char* argv[] = {"/home/insujang/test", "message from kernel device driver", NULL};
static char* envp[] = {
    "HOME=/",
    "TERM=linux",
    "PATH=/sbin:/bin:/usr/sbin:/usr/bin", NULL };

sub_info = call_usermodehelper_setup(argv[0], argv, envp, GFP_ATOMIC);
if(sub_info == NULL) return -ENOMEM;

return call_usermodehelper_exec(sub_info, UMH_WAIT_PROC);
```

This code will executes `/home/insujang/test` executable file. It should be called from device driver, or another kernel space.  
All examples that I have referred uses the same `envp`, but I don't know exactly what this means.

Simpler version of process creation is as follows.

```c
#include <linux/kmod.h>

char* argv[] = {"/home/insujang/test", "message from kernel device driver", NULL};
static char* envp[] = {
    "HOME=/",
    "TERM=linux",
    "PATH=/sbin:/bin:/usr/sbin:/usr/bin", NULL };

return call_usermodehelper(argv[0], argv, envp, UMH_WAIT_PROC);
```

## References
- Invoking user-space applications from the kernel. M. Jones. \[Online\]: https://www.ibm.com/developerworks/library/l-user-space-apps/
