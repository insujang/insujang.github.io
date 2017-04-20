---
layout: post
title: "Hooking an SGX ENCLS Leaf Function Call from KVM"
date: "2017-04-20 16:37:35 +0900"
author: "Insu Jang"
tags: [research, sgx]
---

### Environment
- Host: Ubuntu 14.04.5 LTS, Intel Core-i7 6700 Skylake processor
- Guest: Ubuntu 14.04.4 LTS, QEMU-KVM based virtual machine (using Intel VT-x)

# 1. ENCLS
- SGX Programming Reference, Section 5.2
- `ENCLS` instruction is used to execute an enclave system function (privileged) of specified leaf number.
- Software specifies the leaf function **by setting the appropriate value in the register EAX as input**.
    1. Example) EAX = 0x0: ECREATE
    2. Example) EAX = 0x1: EADD

    All leaf functions are defined in SGX programming reference, and linux-sgx-driver (`/linux-sgx-driver/isgx_arch.h`).
- In 64-bit mode, the instruction ignores upper 32 bits of the RAX register.
- In VMX non-root operation, execution of ENCLS is unconditionally allowed if the "Enable ENCLS exiting" VM-execution control is 0.  
**If the "Enable ENCLS exiting" VM-execution control is set, <mark>execution of individual leaf function of ENCLS is governed by the "ENCLS-exiting bitmap"</mark>.** Each bit position of "ENCLS-exiting bitmap" corresponds to the index (EAX) of an ENCLS leaf function.
- In other words, a VMM can **<mark>hook into the ENCLS instruction</mark> by setting the new VM-exiting control called "enable ENCLS exiting" (bit 15 in the secondary processor-based VM-execution controls).**

```
...
if (in VMX non-root operation) and (Enable_ENCLS_EXITING = 1):
    if ((EAX < 63) and (ENCLS_EXITING_Bitmap[EAX] = 1)) or ((EAX > 62) and (ENCLS_EXITING_Bitmap[63] = 1)):
        set VMCS.EXIT_REASON = ENCLS;
        deliver VM exit;
...
```

# 2. Secondary Processor-based VM-Execution Control (IA32_VMX_PROCBASED_CTLS2)
- Intel SDM Volume 3, Section A.3.3
- Intel SDM Volume 3, Section 24.6.2
- Intel SDM Volume 4, Table 2-2
- There are two definitions in Intel Software Developer's Manual: an MSR and a field in VMCS.
    1. Model Specific Register (MSR) index is 0x48B (48BH). This MSR is for Intel VT.
        - It is a MSR: value can be written by `wrmsr(unsigne msr, unsigned low, unsigned high)` in `/linux/arch/x86/include/asm/msr.h:216`.
        - Defined in `/linux/usr/include/asm/msr-index.h:677`.  
        `#define MSR_IA32_VMX_PROCBASED_CTLS2 0x0000048b`
        - The `IA32_VMX_PROCBASED_CTLS2` MSR exists only if bit 63 of the `IA32_VMX_PROCBASED_CTLS` MSR (=primary processor-based VM-execution control) is 1.
        - To hook any ENCLS instruction, we first have to set bit 15 of the `MSR_IA32_VMX_PROCBASED_CTLS2` MSR 1.
    2. Virtual Machine Control Structure (VMCS) field encoding is 0x401E (401EH).
        - It is a field in VMCS: value can be written by `vmcs_write32(unsigned long field, u32 value)` in `/linux/arch/x86/kvm/vmx.c:1570`.
        - **Bit position 15 (Enable ENCLS exiting): If this control is 1, executions of ENCLS consult the ENCLS-exiting bitmap to determine whether the instruction causes a VM exit. See Section 24.6.16 and Section 25.1.3.**
        - Software **should consult <mark>the VMX capability MSR IA32_VMX_PROCBASED_CTLS2</mark> to determine which bits may be set to 1.** Failure to clear reserved bits causes subsequent VM entries to fail.


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

- For example, ECREATE is mapped EAX 0x0. If bit 0 of ENCLS-exiting bitmap is set 1, ECREATE function call will result in a VM exit.
- It is a field inside the VMCS: value can be written by `vmcs_write32(unsigned long field, u32 value)` in `/linux/arch/x86/kvm/vmx.c:1570`.

# 4. Adding Configuration on KVM
**`/linux/arch/x86/kvm/vmx.c:4936 static int vmx_vcpu_setup()`**

1. Insert `wrmsr()` to set the 15th bit of `MSR_IA32_VMX_PROCBASED_CTLS2` MSR 1.
2. Insert `vmcs_write32()` to set bit flags of `ENCLS-exiting Bitmap` for ENCLS VM exit calls.
3. Check whether it works or not.


## VMX Instruction Reference
- Intel SDM Volume 3, Section 30
- This section describes the virtual machine extensions (VMX) for the Intel 64 and IA-32 architectures.
- The VMX includes
    1. **five instructions that manage the virtual-machine control structure (VMCS)**
    2. four instructions that manage VMX operation
    3. two TLB-management instructions
    4. two instructions for use by guest software

1. VMCS-maintenance instruction
    1. **VMPTRLD ()**: Make the referenced VMCS active and current, loading the *current-VMCS* pointer, and establish the current VMCS based on the contents of VMCS data area in the referenced VMCS region.
    2. **VMPTRST**: The *current-VMCS* pointer is stored into the destination operand.
    3. **VMCLEAR**
    4. **VMREAD**: Read a component from a VMCS and stores it into a destination operand that may be a register or in memory.  
    Wrapped as a C function `unsigned long __vmcs_readl(unsigned long field)` in `/linux/arch/x86/kvm/vmx.c:1510`.
    5. **VMWRITE**: Write a component to a VMCS from a source operand that may be a register or in memory.  
    Wrapped as a C function `void __vmcs_writel(unsigned long field, unsigned long value)` in `/linux/arch/x86/kvm/vmx.c:1554`.

### References
- Intel Corporation. *Intel Software Guard Extensions Programming Reference*. [\[Online\]](https://software.intel.com/sites/default/files/managed/48/88/329298-002.pdf). Oct. 2014
- Intel Corportation. *Intel 64 and IA-32 Architectures Software Developer's Manual Volume 3*. [\[Online\]](https://software.intel.com/sites/default/files/managed/a4/60/325384-sdm-vol-3abcd.pdf). Mar. 2017
