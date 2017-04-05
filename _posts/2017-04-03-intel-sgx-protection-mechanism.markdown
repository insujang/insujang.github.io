---
layout: post
title: "Intel SGX Protection Mechanism"
date: "2017-04-03 14:09:50 +0900"
author: "Insu Jang"
tags: [research,sgx]
---

*All Figure numbers are same with those in the paper.*

# Glossary
- PMH: Page Miss Handler.
- MMU: Memory Management Unit.
- TLB: Translation Look-aside Buffer.
- FSM: Finite State Machine.
- EPC: Enclave Page Cache.
- EPCM: Enclave Page Cache Map.
- PRM: Processor Reserved Memory.
- ELRANGE: Enclave Linear Address Range.

# Address Translation
## Concepts
> Section 2.5.1 Address Translation Concepts

System software relies on the CPU's address translation mechanism for implementing isolation among less privileged pieces of software.

From a systems perspective, address translation is a layer of indirection between
- *virtual address*, which are used by a program's memory load and store instructions
- *physical address*, which reference the physical address space.

The mapping between virtual and physical addresses is defined by *page tables*, which are managed by the system software.
The translation process is carried out by dedicated hardware in the CPU, which is referred to as the **address translation unit** or **memory management unit (MMU)**.

![address_translation_concept](/assets/images/170403/address_translation_concept.png){: width="700px" .center-image}
*Figure 10. Address translation concept*
{: .center}

## Address Translation Cache
> Section 2.11.5 Caches and Address Translation

Address translation requires up to 20 memory accesses, so it is impractical to perform a full address translation for every cache access. Instead, address translation results are cached in the **translation look-aside buffer (TLB)**.

When a virtual address is not contained in a core's TLB, the Page Miss Handler (PMH) performs a *page walk* to translate the virtual address, and the result is stored in the TLB.

In the Intel architecture, the PMH is implemented in hardware, so the TLB is nevery directly exposed to software.

> Section 2.14.3. Microcode and Address Translation
>
> In order to minimize the latency of a page walk, the PMH is implemented as a Finite-State Machine (FSM).

# Intel SGX
## Overview
Intel Software Guard Extensions (SGX) is a hardware-based data protection technology,
developed by Intel Corporation.

The cental concept of SGX is the ***enclave***, a protected environment that contains the code and data pertaining to a security-sensitive computation.

### The Enclave Page Cache (EPC)
> Section 5.1.1 The Enclave Page Cache (EPC)

The contents of enclaves and the associated data structures are stored in the *Enclave Page Cache (EPC)*, which is a subset of DRAM that cannot be directly accessed by other software, including system software and SMM code. The CPU's integrated memory controllers also reject DMA transfers targeting the EPC, thus protecting it from access by other peripherals.

It is a subset of processor reserved memory (PRM).

![epc](/assets/images/170403/epc.png){: width=600px .center-image}
*Figure 60. EPC and PRM layout*
{: .center}

<!--
### The Enclave Page Cache Map (EPCM)
As the system software is not trusted, SGX processors check the correctness of the system software's virtual address allocation decisions, and refused to perform any action that would compromise SGX's security guarantees.

For example, if the system software attempts to allocate the same EPC page to two enclaves, the SGX instruction used to perform the allocation will fail.

It is impossible for enclave to communicate via shared memory using EPC pages. Fortunately, enclaves can share untrusted non-EPC memory.
-->

### The Enclave Linear Address Range (ELRANGE)
> Section 5.2.1 The Enclave Linear Address Range (ELRANGE)

Each enclave designates an area in its virtual address space, called the *enclave linear address range (ELRANGE)*, which is used to map the code and the sensitive data stored in the enclave's EPC pages. The virtual address space outside ELRANGE is mapped to access non-EPC memory via the same virtual addresses as the enclave's host process.

![sgx_elrange](/assets/images/170403/sgx_elrange.png){: width="600px" .center-image}
*Figure 61. An enclave's EPC pages are accessed using a dedicated region in the enclave's virtual address space, called ELRANGE*
{: .center}

Enclaves must store all their code and private data inside ELRANGE, and must consider the memory outside ELRANGE to be an untrusted interface to outside world.

## How EPC Pages are Mapped into ELRANGE?
> Section 5.2.3 Address Translation for SGX Enclaves  
>
> Section 6.2.1 Functional Description

<!--
**SGX's active memory mapping attacks defense mechanism** (section 3.7.3 and 3.7.4) **revolve around ensuring that each EPC page can only be mapped at a specific virtual address inside the ELRANGE.**

When an EPC page is allocated, its **intended virtual address** is recorded in the EPCM entry for the page,. in the ADDRESS field.

#### What is "intended virtual address"?
-->
Virtual address allocation is system software's responsibility in SGX's model. So CPU cannot ask for system software to allocate a page in a specific virtual address.

In SGX1 model, only static memory allocation is supported. Hence, all EPC pages must be allocated to an enclave **before** initialization phase is finished.

![enclave_life_cycle](/assets/images/170403/enclave_life_cycle.png){: width="600px" .center-image}
*Figure 63. Enclave state transition diagram*
{: .center}

As you can see in Figure 63, EADD instruction, which is used for EPC page allocation, can only be called when the enclave is *uninitialized*.

As all EPC pages are allocated statically, the expected virtual addresses for EPC pages are ***continuous***.

**Hence, the intended virtual address is defined as follows.**

> Section 5.6.3 Measuring EADD

The virtual address of the newly created page is measured ***relatively*** to the start of the enclave's ELRANGE.

For example, if ELRANGE is set `{BASEADDR: 0x80000000, SIZE:0x200000}`, the second EPC page to be allocated to this enclave must have the virtual address `0x80001000`. (BASEADDR) + 4K * ENCLAVEOFFSET).

Then, how `BASEADDR` in ELRANGE is set?

> Section 5.6.1 Measuring ECREATE

The enclave's measurement does not include BASEADDR field. (ELRANGE is specified as BASEADDR and SIZE) It ***allows the system software to load an enclave at any virtual address inside a host address that satisfied the ELRANGE restrictions (5.2.1).***

> ELRANGE restrictions from *section 5.2.1 ELRANGE*
>
> ELRANGE must meet the same constraints as a variable memory type range, the size must be a power of 2, and the base must be aligned to the size.

To make it short, ELRANGE is defined by system software, but recorded by SGX at the time an enclave is created. All following EPC pages should have continuous virtual address from ELRANGE.

Here is a sample enclave's virtual address space in the paper.

![enclave_virtual_address_sample](/assets/images/170403/enclave_virtual_address_sample.png){: width="500px" .center-image}
*Figure 62. A possible layout of an enclave's virtual address space*
{: .center}

You can see that ADDRESS fields of EPC pages are continuous from BASEADDR (ELRANGE base address).

# SGX Address Translation Attack Protection Details

> Section 6.2.1 Functional Description

SGX adds the access control logic to the PMH. SGX's security checks are performed after SGX's access control log has access to the physical address produced by the page walker FSM.

![sgx_protection](/assets/images/170403/sgx_protection.png){: width="500px" .center-image}
*Figure 86. Security checks performed by the PMH.*
{: .center}

- If the logcal processor is outside enclave mode, only address translations that **do not target the PRM range** are allowed. (1)
- When the logical processor is inside enclave mode, checks the following.
  - Is the **physical address in PRM and EPC?** (2)
  - Blocked EPC pages are in the process of being evicted, so PMH must not create new TLB entries targeting them.  
  Is it blocked? (3)
  - Some EPC pages cannot be accessed by software. (e.g. SECS).  
  Is this page that kind of one? (4)
  - An EPC page must only be accessed by the code of the enclave who owns the page.  
  Is **this process the owner of the EPC page?** (5)
  - EPC pages must always be accessed using the virtual address when they were allocated to the enclave.  
  Does the **virtual address same with the intended one?** (6)



### References
- Software Guard Extensions, Wikipedia. [Online] [https://en.wikipedia.org/wiki/Software_Guard_Extensions](https://en.wikipedia.org/wiki/Software_Guard_Extensions)
- Costan V, Devadas S, Intel SGX Explained, IACR Cryptology ePrint Archive, 2016 [\[link\]](https://pdfs.semanticscholar.org/2d7f/3f4ca3fbb15ae04533456e5031e0d0dc845a.pdf)
