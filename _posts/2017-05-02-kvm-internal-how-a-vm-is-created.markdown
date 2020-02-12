---
layout: post
title: "KVM Internal: How a VM is Created?"
date: "2017-05-02 20:26:56 +0900"
author: "Insu Jang"
tag: [research, linux]
---

KVM is an acronym of "Kernel based Virtual Machine", and is a virtualization infrastructure for the Linux kernel that turns it into a hypervisor.  
It is used with QEMU to emulate some peripherals, called QEMU-KVM.

The basic architecture for KVM is as follows.

![](https://image.slidesharecdn.com/els305-100323102407-phpapp02/95/virtualization-with-kvm-kernelbased-virtual-machine-4-728.jpg?cb=1269341011){: .center-image}
* KVM Architecture.
{: .center}

QEMU process runs as a userspace process on top of the Linux kernel with KVM module, and a guest kernel runs on the of emulated hardware in QEMU.

QEMU can co-work with KVM for hardware based virtualization (Intel VT-x or AMD AMD-V). Using hardware based virtualization, QEMU does not have to emulate all CPU instructions, so it is really fast.

When we create a virtual machine on the host, we type the following command.

```
sudo qemu-system-x86_64 -enable-kvm -M q35 -m 8192 -cpu host,kvm=off ...
```

which means that we runs x86-64 based architecture CPU, with the help of KVM support (hardware based virtualization), the emulated chipset should be q35, and the size of memory should be 8GB, and so on.

After typing the command, QEMU sends `ioctl()` command to KVM module to create a VM.

```c
/linux/virt/kvm/kvm_main.c:2998

static int kvm_dev_ioctl_create_vm (unsigned long type)
{
    int r;
    struct kvm* kvm;

    kvm = kvm_create_vm(type);

    ...
}
```
```c
/linux/virt/kvm/kvm_main.c:545

static struct kvm *kvm_create_vm (unsigned long type)
{
    int r, i;
    struct kvm* kvm = kvm_arch_alloc_vm();

    ...
    r = kvm_arch_init_vm(kvm, type);
    r = hardware_enable_all();

    ...
}
```
```c
/linux/include/linux/kvm_host.h:738
static inline struct kvm *kvm_arch_alloc_vm(void)
{
    return kzalloc(sizeof(struct kvm), GFP_KERNEL);
}
```

`struct kvm` is a virtual machine data structure that KVM uses, and is defined as follows.

```c
/linux/include/linux/kvm_host.h:361

struct kvm {
    spinlock_t mmu_lock;
    struct mutex slots_lock;
    struct mm_struct* mm;
    ...
}
```

It includes all hardware units that are necessary.  
Actual initialization of the data structure is done in `kvm_arch_init_vm()`.

```c
/linux/arch/x86/kvm/x86.c:7726

int kvm_arch_init_vm (struct kvm *kvm, unsigned long type)
{
    INIT_HLIST_HEAD(&kvm->arch.mask_notifier_list);
    INIT_LIST_HEAD(&kvm->arch.active_mmu_pages);
    ...
    kvm_page_track_init(kvm);
    kvm_mmu_init_vm(kvm);

    return 0;
}
```

# References
- Wikipedia. Kernel-based Virtual Machine. \[Online\]. https://en.wikipedia.org/wiki/Kernel-based_Virtual_Machine
- Novell. KVM Architecture. \[Online\]. https://www.slideshare.net/NOVL/virtualization-with-kvm-kernelbased-virtual-machine
