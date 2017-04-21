---
layout: post
title: "Hooking an SGX ENCLS Leaf Function Call from KVM"
date: "2017-04-21 20:36:41 +0900"
author: "Insu Jang"
tags: [research, sgx, linux]
---

### Environment
- Host: Ubuntu 14.04.5 LTS, Linux kernel 4.6.0, Intel Core-i7 6700 Skylake processor
- Guest: Ubuntu 14.04.4 LTS, Linux kernel 3.16.5, QEMU-KVM based virtual machine (using Intel VT-x)

# 1. ENCLS
- SGX Programming Reference, Section 5.2.1
- `ENCLS` instruction is used to execute an enclave system function (privileged) of specified leaf number.
- Software specifies the leaf function **by setting the appropriate value in the register EAX as input**.
    1. Example) Instruction = ENCLS, EAX = 0x0: ECREATE
    2. Example) Instruction = ENCLS, EAX = 0x1: EADD

    All leaf functions are defined in SGX programming reference, and linux-sgx-driver (`/linux-sgx-driver/isgx_arch.h`).
- In 64-bit mode, the instruction ignores upper 32 bits of the RAX register.
- In VMX non-root operation, execution of ENCLS is *unconditionally allowed* if the "Enable ENCLS exiting" VM-execution control is 0.
- **If the "Enable ENCLS exiting" VM-execution control is set, <mark>execution of individual leaf function of ENCLS is governed by the "ENCLS-exiting bitmap"</mark>.** Each bit position of "ENCLS-exiting bitmap" corresponds to the index (EAX) of an ENCLS leaf function.  
In other words, a VMM can **<mark>hook into the ENCLS instruction</mark> by setting the new VM-exiting control called "enable ENCLS exiting" (bit 15 in the secondary processor-based VM-execution controls).**

```
...
if (in VMX non-root operation) and (Enable_ENCLS_EXITING = 1):
    if ((EAX < 63) and (ENCLS_EXITING_Bitmap[EAX] = 1)) or ((EAX > 62) and (ENCLS_EXITING_Bitmap[63] = 1)):
        set VMCS.EXIT_REASON = ENCLS;
        deliver VM exit;
...
```

# 2. Secondary Processor-based VM-Execution Control (IA32_VMX_PROCBASED_CTLS2)
- Intel SDM Volume 3, Appendix A.3.3
- Intel SDM Volume 3, Section 24.6.2
- Intel SDM Volume 4, Table 2-2
- SGX Programming Reference, Section 6.5
- There are two definitions in Intel Software Developer's Manual: an MSR (Volume 3, Appendix A.3.3) and a field in VMCS (Volume 3, Section 24.6.2).
    1. Virtual Machine Control Structure (VMCS) field encoding is 0x401E (401EH).
        - It is a field in VMCS: value can be written by `vmcs_write32(unsigned long field, u32 value)` in `/linux/arch/x86/kvm/vmx.c:1570`.
        - **Bit position 15 (Enable ENCLS exiting): If this control is 1, executions of ENCLS consult the ENCLS-exiting bitmap to determine whether the instruction causes a VM exit. See Section 24.6.16 and Section 25.1.3.**
        - Software **should consult <mark>the VMX capability MSR IA32_VMX_PROCBASED_CTLS2</mark> to determine which bits may be set to 1.** Failure to clear reserved bits causes subsequent VM entries to fail.
    2. Model Specific Register (MSR) index is 0x48B (48BH). This MSR is for Intel VT.
        - It is a MSR: value can be written by `wrmsr(unsigne msr, unsigned low, unsigned high)` in `/linux/arch/x86/include/asm/msr.h:216`.
        - Defined in `/linux/usr/include/asm/msr-index.h:677`.  
        `#define MSR_IA32_VMX_PROCBASED_CTLS2 0x0000048b`
        - The `IA32_VMX_PROCBASED_CTLS2` MSR exists only if bit 63 of the `IA32_VMX_PROCBASED_CTLS` MSR (=primary processor-based VM-execution control) is 1.
        - To hook any ENCLS instruction, we first have to set bit 15 of the `MSR_IA32_VMX_PROCBASED_CTLS2` MSR 1.
        - Bits information
            - Bits 31:0 indicates the allowed 0-settings of these controls.  
            These bits are always 0. This fact indicates that VM entry allows each bit of the secondary processor-based VM-execution controls to be 0.
            - Bits 63:32 indicate the allowed 1-settings of theses controls.  
            VM entry allows control X (bit X of the IA32_VMX_PROCBASED_CTLS2) to be 1 if bit 32+X in the MSR is set to 1. If bit 32+X in the MSR is cleared to 0, VM entry failes if control X and the "activate secondary controls (bit 63 of the IA32_VMX_PROCBASED_CTLS)" are both 1.  
            The 1-setting is not allowed for any reserved bit.

# 3. ENCLS-exiting Bitmap
- SGX Programming Reference, Section 6.5.1
- Intel SDM Volume 3, Section 24.6.16
- **When bits in the "ENCLS-exiting bitmap" are set, <mark>execution of the corresponding ENCLS leaf functions in the guest results in a VM exit.</mark>**
- ENCLS-exiting bitmap is a 64-bit VM-execution control field in virtual machine control structure (VMCS).

    | Field Name (64-bit control field) |   Encoding   |
    |-----------------------------------|:------------:|
    | ENCLS-exiting bitmap (full)       |  0x0000202E  |
    | ENCLS-exiting bitmap (high)       |  0x0000202F  |

    * These fields exist only on processors that support the 1-setting of the "enable ENCLS exiting" VM-execution control.

- For example, ECREATE is mapped EAX 0x0. If 0th index of ENCLS-exiting bitmap is set 1, ECREATE function call will result in a VM exit, with exit reason `ENCLS`.
- It is a field inside the VMCS: value can be written by `vmcs_write32(unsigned long field, u32 value)` in `/linux/arch/x86/kvm/vmx.c:1570`.

# 4. Implementing A ENCLS Hook on KVM
**`/linux/arch/x86/kvm/vmx.c:3269 static __init int setup_vmcs_config(struct vmcs_config *vmcs_conf)`**  
**`/linux/arch/x86/kvm/vmx.c:4936 static int vmx_vcpu_setup()`**

### (1) In `setup_vmcs_config()` (`/linux/arch/x86/kvm/vmx.c:3269`).

In terms of configuring secondary processor-based VM-exeuction controls MSR,
- It first checks bit position 31 of the primary processor-based VM-execution controls MSR (`MSR_IA32_VMX_PROCBASED_CTLS`) is 1. This indicates that the secondary processor-based VM-execution controls MSR (`MSR_IA32_VMX_PROCBASED_CTLS2`) is used.  
It is set by default by KVM, as follows, hence you don't have to modify the following code.  
```c
...
// CPU_BASED_ACTIVATE_SECONDARY_CONTROLS is defined in
// /linux/arch/x86/kvm/include/asm/vmx.h:54
// #define CPU_BASED_ACTIVATE_SECONDARY_CONTROLS 0x80000000
opt = CPU_BASED_TPR_SHADOW |
      CPU_BASED_USE_MSR_BITMAPS |
      CPU_BASED_ACTIVATE_SECONDARY_CONTROLS;
adjust_vmx_control(min, opt, MSR_IA32_VMX_PROCBASED_CTLS, &_ cpu_based_exec_control);
...
if (_ cpu_based_exec_control & CPU_BASED_ACTIVATE_SECONDARY_CONTROLS) {
  ...
}
```
- Bit position 15 of the secondary processor-based VM-execution controls MSR (`MSR_IA32_VMX_PROCBASED_CTLS2`) is **Enable ENCLS exiting**. For a VMM to hook a specific ENCLS instruction called in a guest machine, this bit must be set. However, it is **not** set by default. Hence, set this bit as follows.
```c
...
// Set bit position 15 as 1 of the MSR_IA32_VMX_PROCBASED_CTLS2.
#define SECONDARY_ENABLE_ENCLS_EXITING (1 << 15)
opt2 = SECONDARY_EXEC_VIRTUALIZE_APIC_ACCESS |
    ...
    SECONDARY_EXEC_TSC_SCALING |
    SECONDARY_ENABLE_ENCLS_EXITING;
adjust_vmx_controls(min2, opt2, MSR_IA32_VMX_PROCBASED_CTLS2, &_ cpu_based_2nd_exec_control);
...
```

### (2) In `vmx_vcpu_setup()` (`/linux/arch/x86/kvm/vmx.c:4939`).

Set an ENCLS0-exiting bitmap VMCS control field (encoding `0x0000202E`). This indicates which ENCLS instruction should be hooked by a VMM. It is **not** set by default. Hence, set the VMCS control field as follows to hook an ENLS instruction call.

Note that ***<mark>each bit position</mark> of the control field represents the leaf number of ENCLS instruction***, i.e. for EEXTEND, which has leaf number 0x06, 6th bit should be set.  
Also note that ENCLS-exiting bitmap control field (`0x0000202E`) is not defined in Linux kernel by default. You also have to set it first, in `/linux/arch/x86/kvm/include/asm/vmx.h`.
```c
/linux/arch/x86/kvm/include/asm/vmx.h
enum vmcs_field {
    VIRTUAL_PROCESSOR_ID        = 0x00000000,
    ...
    XSS_EXIT_BITMAP_HIGH        = 0x0000202D,
    ENCLS_EXITING_BITMAP        = 0x0000202E,
    ENCLS_EXITING_BITMAP_HIGH   = 0x0000202F,
    ...
};
```

```c
/linux/arch/x86/kvm/vmx.c
...
if (cpu_has_secondary_exec_ctrls()) {
    vmcs_write32(SECONDARY_VM_EXEC_CONTROL, vmx_secondary_exec_control(vmx));

    // My custom ENCLS instruction has leat number 0x1A, hence set 26th bit as 1.
    vmcs_write64(ENCLS_EXITING_BITMAP, (1 << 26));
}
...
```

> If you want to hook multiple ENCLS instructions, the value passed should be a or-ed combination of several numbers.

### (3) In `vmx_handle_exit()` (`/linux/arch/x86/kvm/vmx.c:8314`).

Now the KVM will hook an ENCLS instruction that is set to be hooked. However, as the exit reason `ENCLS` is not included in Linux kernel by default, it prints `vmx: unexpected exit reason 0x3C` in dmesg.

Add an ENCLS exit reason in `/linux/arch/x86/include/uapi/asm/vmx.h`, as follows.
```c
#define EXIT_REASON_EXCEPTION_NMI     0
...
#define EXIT_REASON_INVPCID           58
#define EXIT_REASON_ENCLS             60
...
```

To see the entire list of vm exit reasons, refer to *Intel 64 and IA-32 Architectures Software Developer's Manual Volume 3, Appendix C*.

After adding the definition of ENCLS exit reason, implement an exit reason handler in `/linux/arch/x86/kvm/vmx.c`.  
The list of vmx exit handlers is defined in `/linux/arch/x86/kvm/vmx.c:7713`. Add a name of handler at the last of the list as follows.  
```c
static int (* const kvm_vmx_exit_handlers[])(struct kvm_vcpu * vcpu) = {
    [EXIT_REASON_EXCEPTION_NMI]         = handle_exception,
    ...
    [EXIT_REASON_PCOMMIT]               = handle_pcommit,
    [EXIT_REASON_ENCLS]                 = handle_encls,
};
```

And implement a handler named `handle_encls()`, as follows.  
```c
static int handle_encls (struct kvm_vcpu *vcpu) {
    skip_emulated_instruction(vcpu);
    printk("%s: handling encls exit reason from vcpu%d\n"),
          __func__, vcpu->vcpu_id);
    return 1;
}
```

As commented right above the declaration of `kvm_vmx_exit_handlers`, the exit handlers should return 1 if the exit was handled fully and guest execution may resume.  
Also I added `skip_emulated_instruction()` call because `vmx_handle_exit()` is called indefinitely without this function call.  
Currently I just added a simple `printk()`, but you can implement it as you want.

If a guest virtual machine calls the following `__eabc()` function,  
```c
#define __encls(rax, rbx, rcx, rdx...)  \
    ({              \
    int ret;            \
    asm volatile("1: .byte 0x0f, 0x01, 0xcf;\n\t"   \
             " xor %%eax,%%eax;\n"      \
             "2: \n"                    \
             ".section .fixup,\"ax\"\n"         \
             "3: movq $-1,%%rax\n"          \
             "   jmp 2b\n"              \
             ".previous\n"              \
             _ASM_EXTABLE(1b, 3b)           \
             : "=a"(ret), "=b"(rbx), "=c"(rcx)      \
             : "a"(rax), "b"(rbx), "c"(rcx), rdx    \
             : "memory");               \
    ret;    \
    })

static inline int __eabc (void) {
    unsigned long rbx = 0;
    unsigned long rcs = 0;
    // The value of the RAX register will be 0x1A, the leaf number of a custom ENCLS isntruction EABC.
    return __encls(0x1A, rbx, rcx, "d"(0));
}
```  
The result from the VMM dmesg is as follows.  
![handle_exit_reason_encls](/assets/images/170421/handle_exit_reason_encls.png){: .center-image}

<!--
1. Insert `wrmsr()` to set the 15th bit of `MSR_IA32_VMX_PROCBASED_CTLS2` MSR 1.
2. Insert `vmcs_write32()` to set bit flags of `ENCLS-exiting Bitmap` for ENCLS VM exit calls.
3. Check whether it works or not.
-->

### References
- Intel Corporation. *Intel Software Guard Extensions Programming Reference*. [\[Online\]](https://software.intel.com/sites/default/files/managed/48/88/329298-002.pdf). Oct. 2014
- Intel Corporation. *Intel 64 and IA-32 Architectures Software Developer's Manual Volume 3*. [\[Online\]](https://software.intel.com/sites/default/files/managed/a4/60/325384-sdm-vol-3abcd.pdf). Mar. 2017
