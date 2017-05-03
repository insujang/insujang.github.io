---
layout: post
title: "Calling Kernel Module's Function from The Other Kernel Module"
date: "2017-05-03 15:18:17 +0900"
author: "Insu Jang"
tags: [research, linux]
---

I made two kernel modules, one of which calls a function of the other module, but it kept saying me that `WARNING: "<function_name>" undefined!`.
Even though I exported the function, there actually is another step that I should follow.

**References: http://stackoverflow.com/a/9499893**

What I did before finding the reference was to export the target function.

```c
/kernel1/functions.h

void function1(void);
```
```c
/kernel1/functions.c

#include <linux/module.h>
void function1(void){};
EXPORT_SYMBOL(function1);
```

However, the other kernel module (say it kernel2) does not know where `function1()` exists. Hence, to use this function from kernel2, we need to **import Module.symvers of kernel1** into Kbuild.in of kernel module kernel2.

As in the reference post, we just define `KBUILD_EXTRA_SYMBOLS` in Kbuild.in. We don't have to any more things.
```
/kernel2/Kbuild.in

...
KBUILD_EXTRA_SYMBOLS = /kernel1/Module.symvers
...
```

Now compiling kernel2 will show no warnings.
