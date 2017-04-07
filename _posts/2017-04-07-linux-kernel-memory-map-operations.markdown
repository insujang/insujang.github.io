---
layout: post
title: "Linux Kernel Memory Map Operations"
date: "2017-04-07 09:55:25 +0900"
author: "Insu Jang"
tag: [study,linux]
---
Memory mapping is one of the most important features to protect the memory system in Linux.  
Linux provides several functions to map a physical address into a virtual address.

#### 1. `mmap`

```c
Linux/fs/sysfs/bin.c:337

static int mmap(struct file* file, struct vm_area_struct* vma) {...}
```

`mmap()` maps the file to a virtual memory. And this can be used with the special file `/dev/mem` (system memory) or `/dev/kmem` (kernel memory).

#### 2. `vm_insert_pfn`

This function is called by `sgx_enclave_add_page()`. Map a physical memory page into a **user space virtual memory address** space.

`vm_insert_pfn()` is a wrapper of `vm_insert_pfn_prot()` function.

```c
Linux/mm/memory.c

/**
 * vm_insert_pfn - insert single pfn into user vma
 * @vma: user vma to map to
 * @addr: target user address of this page
 * @pfn: source kernel pfn
 *
 * Similar to vm_insert_page, this allows drivers to insert individual pages
 * they've allocated into a user vma. Same comments apply.
 *
 * This function should only be called from a vm_ops->fault handler, and
 * in that case the handler should return NULL.
 *
 * vma cannot be a COW mapping.
 *
 * As this is called only for pages that do not currently exist, we
 * do not need to flush old virtual caches or the TLB.
 */
int vm_insert_pfn(struct vm_area_struct* vma, unsigned long addr,
                        unsigned long pfn)
{
        return vm_insert_pfn_prot(vma, addr, pfn, vma->vm_page_prot);
}
```

#### 3. `remap_pfn_range`
While `vm_insert_pfn()` adds a single pfn into user virtual memory address, `remap_pfn_range()` maps a consecutive block of physical memory to user space.

```c
Linux/mm/memory.c

/**
 * remap_pfn_range - remap kernel memory to userspace
 * @vma: user vma to map to
 * @addr: target user address to start at
 * @pfn: physical address of kernel memory
 * @size: size of map area
 * @prot: page protection flags for this mapping
 *
 *  Note: this is only safe if the mm semaphore is held when called.
 */
int remap_pfn_range(struct vm_area_struct* vma, unsigned long addr,
                    unsigned long pfn, unsigned long size, pgprot_t prot){}
```
The comment says it **remaps kernel memory** to userspace. I didn't get it what kernel memory is. Some Stack Overflow articles says it maps physical address to userspace virtual address. [\[link1\]](http://stackoverflow.com/a/17278263)[\[link2\]](http://unix.stackexchange.com/q/237783)

#### 4. `ioremap`
While `remap_pfn_range()` maps physical address to user space virtual address, `ioremap()` maps physical address to **kernel space virtual address**.  
This range must be accessed via special function `iowrite()` and `ioread()`.

`ioremap()` for x86 is a wrapper of `ioremap_nocache()`, as it is uncacheable by default.

```c
Linux/arch/x86/include/asm/io.h
/*
 * The default ioremap() behavior is non-cached:
 */
static inline void __iomem *ioremap(resource_size_t offset, unsigned long size)
{
        return ioremap_nocache(offset, size);
}

Linux/arch/x86/mm/ioremap.c
/**
 * ioremap_nocache     -   map bus memory into CPU space
 * @phys_addr:    bus address of the memory
 * @size:      size of the resource to map
 *
 * ioremap_nocache performs a platform specific sequence of operations to
 * make bus memory CPU accessible via the readb/readw/readl/writeb/
 * writew/writel functions and the other mmio helpers. The returned
 * address is not guaranteed to be usable directly as a virtual
 * address.
 *
 * This version of ioremap ensures that the memory is marked uncachable
 * on the CPU as well as honouring existing caching rules from things like
 * the PCI bus. Note that there are other caches and buffers on many
 * busses. In particular driver authors should read up on PCI writes
 *
 * It's useful if some control registers are in such an area and
 * write combining or read caching is not desirable:
 *
 * Must be freed with iounmap.
 */
void __iomem *ioremap_nocache(resource_size_t phys_addr, unsigned long size){}
```

### References
- Jessica McKellar, Alessandro Rubini, Jonathan Corbet, and Kr. 2015. *Linux Device Drivers*, O'Reilly Media.

### License
Linux kernel source codes are released under the GPLv2.
