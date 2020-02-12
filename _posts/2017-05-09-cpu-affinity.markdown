---
layout: post
title: "CPU Affinity"
date: "2017-05-09 21:56:25 +0900"
author: "Insu Jang"
tags: [research, linux]
---
CPU affinity, also called CPU pinning, enables the binding of a process or a thread to a specific CPU core, or CPU cores.

The following function is provided as a standard library to set affinity. [\[reference\]](https://linux.die.net/man/2/sched_setaffinity)

```c
#include <sched.h>

int sched_setaffinity(pid_t pid, size_t cpusetsize, cpu_set_t *mask);
int sched_getaffinity(pid_t pid, size_t cpusetsize, cpu_set_t *mask);
```

On success, `schedu_setaffinity()` and `sched_getaffinity()` return 0. On error, -1 is returned, and `errno` is set appropriately.

`cpu_set_t` can be set by defined macros as follows. [\[reference\]](http://man7.org/linux/man-pages/man3/CPU_SET.3.html)

```c
void CPU_ZERO(cpu_set_t *set);
void CPU_ZERO_S(size_t setsize, cpu_set_t *set);
void CPU_SET(int cpu, cpu_set_t *set);
void CPU_CLR(int cpu, cpu_set_t *set);
int CPU_ISSET(int cpu, cpu_set_t *set);
...

cpu_set_t *CPU_ALLOC(int num_cpus);
void CPU_FREE(cpu_set_t *set);
...
```
where `int cpu` is the number of CPU cores. It should be one among 0~num_cpus-1. For example, it can be 0~7 if there are 8 logical processors in a machine.

The following code will make this program be run only in CPU number 7.

```c
cpu_set_t *mask = NULL;
int num_cpus = 8;
size_t size;

// Memory allocation
// null exception handling is omitted.
mask = CPU_ALLOC(num_cpus);

// Zero initialization
size = CPU_ALLOC_SIZE(num_cpus);
CPU_ZERO_S(size, mask);

// Add a mask for CPU 7
CPU_SET_S(7, size, mask);

// Set affinity
sched_setaffinity(getpid(), size, mask);

CPU_FREE(mask);
```

# References
- Processor affinity. Wikipedia. \[Online\]: https://en.wikipedia.org/wiki/Processor_affinity
- sched_setaffinity. Linux man page. \[Online\]: https://linux.die.net/man/2/sched_setaffinity
- CPU SET. Linux Programmer's Manual. \[Online\]: http://man7.org/linux/man-pages/man3/CPU_SET.3.html
