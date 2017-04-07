---
layout: post
title: "Intel SGX Instructions in Enclave Initialization"
date: "2017-04-05 22:13:25 +0900"
author: "Insu Jang"
tags: [research,sgx]
---

### 1. ECREATE
- [Intel SGX Explained p63] Section 5.3.1. Creation
- [Programming References p21] Section 5.3. ECREATE

An enclave is born when the system software issues the `ECREATE` instruction, which turns a free EPC page into the SECS for the new enclave.

`ECREATE` copies an SECS structure outside the EPC into an SECS page inside the EPC. The internal structure of SECS is not accessible to software.  
Software sets the following fields in the source structure: `SECS:BASEADDR`, `SECS:SIZE`, and `ATTRIBUTES`.

`ECREATE` validates the information used to initialize the SECS, and results in a page fault (#PF) or general protection fault (#PF) if the information is not valid.  
`ECREATE` will also fault if SECS target page is in use; already valid; outside the EPC; adresses are not aligned; unused PAGEINFO fields are not zero.

```c++
linux-sgx/sdk/simulation/uinst/u_instructions.cpp

// Returns the pointer to the Enclave instance on success.
uintptr_t _ECREATE(page_info_t* pi)
{
    secs_t* secs = reinterpret_cast<secs_t*>(pi->src_page);

    // Enclave size must be at least 2 pages and a power of 2.
    GP_ON(!is_power_of_two((size_t)secs->size));
    GP_ON(secs->size < (SE_PAGE_SIZE << 1));

    CEnclaveSim* ce = new CEnclaveSim(secs);
    void*   addr;

    // 'ce' is not checked against NULL, since it is not
    // allocated with new(std::no_throw).
    addr = se_virtual_alloc(NULL, (size_t)secs->size, MEM_COMMIT);
    if (addr == NULL) {
        delete ce;
        return 0;
    }   

    // Mark all the memory inaccessible.
    se_virtual_protect(addr, (size_t)secs->size, SGX_PROT_NONE);
    ce->get_secs()->base = addr;

    CEnclaveMngr::get_instance()->add(ce);
    return reinterpret_cast<uintptr_t>(ce);
}
```

### 2. EADD
- [Intel SGX Explained p64] Section 5.3.2. Loading
- [Programming References p11] Section 5.3. EADD

The system software can use `EADD` instructions <mark>to load the initial code and data</mark> into the enclave. `EADD` is used to create both TCS pages and regular pages.  
This function copies a source page from non-enclave memory into the EPC, associates the EPC page with an SECS page residing in the EPC, and stores the linear address and security attributes in EPCM.


`EADD` reads its input data from a *Page Information (PAGEINFO)* structure.

The PAGEINFO structure contains
- The virtual address of the EPC page (`LINADDR`)
- The virtual address of the non-EPC page whose contents will be copied into the newly allocated EPC page (`SRCPGE`)
- A virtual address that resolves to the SECS of the enclave that will own the page (`SECS`).
- The virtual address, pointing to a Security Information (SECINFO) structure, which contains the newly allocated EPC page's access permissions (R, W, X) and its EPCM page type (`RT_REG` or `PT_TCS`).

```c++
linux-sgx/common/inc/internal/arch.h

typedef struct _page_info_t
{
    PADDED_POINTER(void,        lin_addr);      // Enclave linear address
    PADDED_POINTER(void,        src_page);      // Linear address of the page where contents are located
    PADDED_POINTER(sec_info_t,  sec_info);      // Linear address of the SEC_INFO structure for the page
    PADDED_POINTER(void,        secs);          // Linear address of EPC slot that contains SECS for this enclave
} page_info_t;
```

![pageinfo](/assets/images/170405/pageinfo.png){: .center-image}

`EADD` validates its inputs, and modifies the newly allocated EPC page and its EPCM entry.

`EADD` ensures
- The EPC page is not allocated to another enclave.
- The page's virtual address falls within the enclave's ELRANGE.
- All the reserved fields in SECINFO are set to zero.

```c++
linux-sgx/sdk/simulation/uinst/u_instructions.cpp

uintptr_t _EADD(page_info_t* pi, void* epc_lin_addr)
{
    void     * src_page = pi->src_page;
    CEnclaveMngr * mngr = CEnclaveMngr::get_instance();
    CEnclaveSim    * ce = mngr->get_enclave(pi->lin_addr);

    if (ce == NULL) {
        SE_TRACE(SE_TRACE_DEBUG, "failed to get enclave instance\n");
        return SGX_ERROR_UNEXPECTED;
    }

    GP_ON(!IS_PAGE_ALIGNED(epc_lin_addr));
    GP_ON((ce->get_secs()->attributes.flags & SGX_FLAGS_INITTED) != 0);

    // Make the page writable before doing memcpy()
    se_virtual_protect(epc_lin_addr, SE_PAGE_SIZE, SI_FLAGS_RW);

    // Memory copy from non-EPC page into EPC page.
    mcp_same_size(epc_lin_addr, src_page, SE_PAGE_SIZE);

    se_virtual_protect(epc_lin_addr, SE_PAGE_SIZE, (uint32_t)pi->sec_info->flags);

    GP_ON(!ce->add_page(pi->lin_addr, pi->sec_info->flags));
    return SGX_SUCCESS;
}
```
<!--
`EADD` simulation code uses `pi->lin_addr` to get a simulated enclave, `ce`.  
According to the paper *'Intel SGX Explained'*, it is the virtual address of the EPC page. Meanwhile, according to the *'Intel SGX Programming Reference'*, it seems that virtual address of the EPC page is passed as a parameter of `EADD` function, `epc_lin_addr`.

Are `pi->lin_addr` and `epc_lin_addr` different? They are almost same, but different, according to the driver API function, `add_enclave_page()`.

```c++
linux-sgx/sdk/simulation/driver_api/driver_api.cpp

int add_enclave_page(sgx_enclave_id_t enclave_id,
                     void*            source,
                     size_t           offset,
                     const sec_info_t &secinfo,
                     uint32_t         attr)
{
    sec_info_t    sinfo;
    page_info_t   pinfo;
    CEnclaveMngr* mngr;
    CEnclaveSim*  ce;

    ...

    memset(&pinfo, 0, sizeof(pinfo));
    pinfo.secs     = ce->get_secs();
    pinfo.lin_addr = (char*)ce->get_secs()->base + offset;
    pinfo.src_page = source;
    pinfo.sec_info = &sinfo;

    // Passing NULL here when there is no EPC mgmt.
    return (int)DoEADD_SW(&pinfo, GET_PTR(void, ce->get_secs()->base, offset));
}
```
`_EADD` instruction is called during `DoEADD_SW` function is handled.

`pinfo.lin_addr` is initialized as `(char*)ce->get_secs()->base + offset`,  
and `epc_lin_addr` is set as `GET_PTR(void, ce->get_secs()->base, offset)`.

`GET_PTR` is defined as  
`#define GET_PTR(t, p, offset) reinterpret_case<t*>( reinterpret_case<size_t>(p) + static_cast<size_t>(offset) )`  
in `linux-sgx/common/inc/internal/util.h`.

While `epc_lin_addr` saves the address `ce->get_secs()->base + sizeof(size_t) * offset`, `pinfo.lin_addr` saves the address `ce->get_secs()->base + offset`.

Of course, there will be no problem on calling `get_enclave()`, as it is defined as follows.

```c++
linux-sgx/sdk/simulation/uinst/enclave_mngr.cpp

CEnclaveSim* CEnclaveMngr::get_enclave(const void* base_addr)
{
    CEnclaveSim* ce = NULL;
    ...
    std::list<CEnclaveSim*>::iterator it = m_enclave_list.begin();
    for (; it != m_enclave_list.end(); ++it)
    {   
        secs_t* secs = (* it)->get_secs();
        if (base_addr >= secs->base &&
            PTR_DIFF(base_addr, secs->base) < secs->size)
        {   
            ce = * it;
            break;
        }   
    }   
    ...
}
```
It just checks which enclave `base_addr` is in its ELRANGE (`BASEADDR` ~ `BASEADDR+SIZE`).
-->

#### 2-1. How a free EPC page is selected in SGX simulation mode?

Simulation implementation might be different from hardware implementation. In simulation mode, `ECREATE` allocates all EPC pages via `mmap()`.

```c++
linux-sgx/sdk/simulation/uinst/u_instructions.cpp

uintptr_t _ECREATE(page_info_t* pi)
{
    secs_t* secs = reinterpret_cast<secs_t*>(pi->src_page);
    ...
    CEnclaveSim* ce = new CEnclaveSim(secs);
    void*   addr;
    addr = se_virtual_alloc(NULL, (size_t)secs->size, MEM_COMMIT);
    ...
}
```
```c++
linux-sgx/common/src/se_memory.c

void* se_virtual_alloc(void* address, size_t size, uint32_t type)
{
    UNUSED(type);
    void* pRet = mmap(address, size, PROT_READ | PROT_WRITE, MAP_PRIVATE |  MAP_ANONYMOUS, -1, 0);
    if(MAP_FAILED == pRet)
        return NULL;
    return pRet;
}
```

As SGX simulation simulates SGX behavior by software, it copies EPC page data with **virtual address**. Hence `_EADD()` does not have detailed information about picking a physical EPC page.

#### 2.2. How system software selects a EPC page in SGX hardware mode?

SGX simulation code can't tell EPC page allocation in detail, as it is also a software, so it cannot use the physical address.

To understand actual implementation, I first tried to understand *Intel SGX Programming Reference* deeply. There is a table explaining inputs for the instruction.

*Table. Instruction Operand Encoding*
{: .center}

| Op/En |    EAX    | RBX                      | RCX                                      |
|:-----:|:---------:|:------------------------:|:----------------------------------------:|
| IR    | EADD (in) | Address of PAGEINFO (in) | Address of the destination EPC page (in) |

As you see the above table, addresses of PAGEINFO and target EPC page should be saved in the register `RBX` and `RCX`, respectively. The target EPC page is already determined, which means system software is responsible for selecting one. This is also explained in ISCA '15 tutorial slide. [\[link\]](https://software.intel.com/sites/default/files/332680-002.pdf)

![eadd_selecting_free_epc_page](/assets/images/170405/eadd_selecting_free_epc_page.png){: .center-image width="600px"}

Then this means I need to search a code that calls `EADD` instruction.

Simulation function which calls `EADD` instruction is `add_enclave_page()` in `sdk/simulation/driver_api/driver_api.cpp`. This is a simulation code because it is in `simulation` directory.  
Then there should be a function with the same name for hardware?

And yes. There is.

```c++
linux-sgx/psw/urts/linux/enclave_creator_hw.cpp

int EnclaveCreatorHW::add_enclave_page(sgx_enclave_id_t enclave_id, void* src, uint64_t rva, const sec_info_t &sinfo, uint32_t attr)
{
    ...
    int ret = 0;
    struct sgx_enclave_add_page addp = { 0, 0, 0, 0 };

    addp.addr = (__ u64)enclave_id + (__ u64)rva;
    addp.src = reinterpret_cast<uintptr_t>(source);
    addp.secinfo = reinterpret_cast<uintptr_t>(const_cast<sec_info_t* >(&sinfo));
    if(((1<<DoEEXTEND) & attr))
        addp.mrmask |= 0xFFFF;

    ret = ioctl(m_hdevice, SGX_IOC_ENCLAVE_ADD_PAGE, &addp);
    if(ret) {
        SE_TRACE(SE_TRACE_WARNING, "\nAdd Page - %p to %p... FAIL\n", source, rva);
        return error_driver2urts(ret);
    }

    return SGX_SUCCESS;
}
```

Note that PSW (Platform SoftWare) is for actual hardware. It calls `ioctl()`, which calls `sgx_ioctl_enclave_add_page()` in linux-sgx-driver. linux-sgx-driver is separately provided in [\[here\]](https://github.com.01org/linux-sgx-driver).

In `linux-sgx-driver/isgx_ioctl.c`,

`ioctl()` from `enclave_creator_hw.cpp`
- calls `isgx_ioctl_enclave_add_page()` at `linux-sgx-driver/isgx_ioctl.c:548`
- calls `__enclave_add_page()` at `linux-sgx-driver/isgx_ioctl.c:440`
- calls `construct_enclave_page` at `linux-sgx-driver/isgx_ioctl.c:122`
- calls `isgx_alloc_epc_page()` at `linux-sgx-driver/isgx_page_cache.c:429`
- calls `isgx_alloc_epc_page_fast()` at `linux-sgx-driver/isgx_page_cache.c:411`  
which picks the first entry from driver's EPC page list.

isgx Linux SGX driver manages EPC page instances by using the linked list(`static LIST_HEAD(isgx_free_list)` at `isgx_page_cache.c:25`) and the number of free EPC pages(`unsigned int isgx_nr_free_epc_pages` at `isgx_page_cache.c:31`).

The type of EPC pages is `struct isgx_epc_page`, defined as follows.

```c
linux-sgx-driver/isgx.h

struct isgx_epc_page {
	resource_size_t		pa;
	struct list_head	free_list;
};
```

Here, `pa` is the physical address for the EPC page. How `pa` is determined?

Each EPC page that is put into free list is allocated in the function `isgx_page_cache_init()` at `linux-sgx-driver/isgx_page_cache.c:360`.

```c
linux-sgx-driver/isgx_page_cache.c

int isgx_page_cache_init(resource_size_t start, unsigned long size)
{
    unsigned long i;
    struct isgx_epc_page * new_epc_page, * entry;
    struct list_head * parser, * temp;

    for (i = 0; i < size; i += PAGE_SIZE) {
        new_epc_page = kzalloc(sizeof(struct isgx_epc_page), GFP_KERNEL);
        if (!new_epc_page)
            goto err_freelist;
        new_epc_page->pa = start + i;
        ...
```

Each EPC page has the physical address as `start + i`. `start` is the first parameter of the function.

The function `isgx_page_cache_init()` is called in `isgx_init()` at `linux-sgx-driver/isgx_main.c:190`.

```c
linux-sgx-driver/isgx_main.c

ret = isgx_page_cache_init(isgx_epc_base, isgx_epc_size);
```

As shown above, `start` is the value of `isgx_epc_base` variable.  
`isgx_epc_base` is initialized by the function `isgx_init_platform()` at `linux-sgx-driver/isgx_main.c:133`.

```c
linux-sgx-driver/isgx_main.c

static int isgx_init_platform(void)
{
  isgx_epc_base = (((u64) (ebx & 0xfffff)) << 32) +
      (u64) (eax & 0xfffff000);
  isgx_epc_size = (((u64) (edx & 0xfffff)) << 32) +
      (u64) (ecx & 0xfffff000);
}
```

You can see what `isgx_epc_base` value is in your machine, as SGX driver prints it in kernel message buffer by default.

```c
static int __ init isgx_init(void)
{
  ...
  ret = isgx_init_platform();
  pr_info("isgx: EPC memory range 0x%Lx-0x%Lx\n", isgx_epc_base,
      isgx_epc_base + isgx_epc_size);
  ...
}
```

![sgx_epc_memory_range_ubuntu](/assets/images/170405/sgx_epc_memory_range_ubuntu.png){: .center-image}

My machine tells that 32MiB of EPC is allocated with the physical base memory address `0x80000000`.

All EPC page instance `struct isgx_epc_page` has a `pa` variable, which contains the physical address of the EPC page, and is initialized as EPC base address + offset.

And, managing page mapping table is also a responsibility of system software. Linux SGX driver insert PTE via calling `vm_insert_pfn()` at `linux-sgx-driver/isgx_util.c:67` by using `epc_page->pa` and expected virtual address `enclave_page->addr` as follows.

```c
linux-sgx-driver/isgx_util.c

void isgx_insert_pte(struct isgx_enclave * enclave,
             struct isgx_enclave_page * enclave_page,
             struct isgx_epc_page * epc_page,
             struct vm_area_struct * vma)
{
    int ret;
    ret = vm_insert_pfn(vma, enclave_page->addr, PFN_DOWN(epc_page->pa));
    if (ret) {
        isgx_err(enclave, "vm_insert_pfn() returned %d\n", ret);
        BUG();
    }   
}
```

***To be concluded, when a SGX platform is initialized, several EPC page instances (`struct isgx_epc_page`) are allocated to represent all EPC pages. System software manages them as a linked list, called `isgx_free_list`. When `EADD` is called, system software picks a free EPC page instance from the list, and create a page table entry, pointing the physical address that is saved in `epc_page->pa`, with the expected virtual address `enclave_page->addr`, a part of user enclave's ELRANGE.***

### 3. EEXTEND
- [Intel SGX Explained p64] Section 5.3.2. Loading
- [Programming References p31] Section 5.3. EEXTEND

While loading an enclave, the system software will also use the `EEXTEND` instruction, which updates the enclave's measurement used in the software attestation process.  
It updates the MRENCLAVE measurement register of an SECS with the measurement of an EXTEND string compromising of "EEXTEND" || ENCLAVEOFFSET || PADDING || 256 bytes of the enclave page.

RCX register contains the effective address of the 256 byte region of an EPC page to be measured.

> From Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 3D, Part 4:
> Section 39.1.2. EADD and EEXTEND Interaction
>
> Software can measure a 256 byte region as determined by the by the developer by invoking EEXTEND. Thus to measure an entire 4KB page, system software must execute EEXTEND 16 times. Each invocation of EEXTEND adds to the cryptographic log information about which region is being measured and the measurement of the section.

```
No simulation code
```

### 4. EINIT
- [Intel SGX Explained p64] Section 5.3.3. Initialization
- [Programming References p34] Section 5.3. EINIT

This function is the final instruction executed in the enclave build process. After EINIT, the MRENCLAVE measurement is cimplete, and the enclave is ready to start user code execution using EENTER instruction.

When `EINIT` completes successfully, it sets the enclave's INIT attribute to true. This opens the way for ring 3 application software to execute the enclave's code, using the SGX instructions.

On the other hand, once INIT is set to true, `EADD` **cannot be invoked on that enclave anymore**, so the system software must load all the pages that make up the enclave's initial state before executing the `EINIT` instruction.

```c++
intel-sgx/sdk/simulation/uinst/u_instructions.cpp

uintptr_t _EINIT(secs_t* secs, enclave_css_t* css, token_t* launch)
{
    CEnclaveMngr* mngr = CEnclaveMngr::get_instance();
    assert(mngr != NULL);

    CEnclaveSim* ce = mngr->get_enclave(secs);
    GP_ON(ce == NULL);

    GP_ON((ce->get_secs()->attributes.flags & SGX_FLAGS_INITTED) != 0);

    // Fill MREnclave, MRSigner, ISVPRODID, ISVSVN
    secs_t* this_secs = ce->get_secs();
    if (css != NULL) {
        // Check signature
        if ((css->body.attribute_mask.xfrm & this_secs->attributes.xfrm)
            != (css->body.attribute_mask.xfrm & css->body.attributes.xfrm))
        {   
            SE_TRACE(SE_TRACE_DEBUG,
                "SECS attributes.xfrm does NOT match signature attributes.xfrm\n");
            return SGX_ERROR_INVALID_ATTRIBUTE;
        }   

        if ((css->body.attribute_mask.flags & this_secs->attributes.flags)
            != (css->body.attribute_mask.flags & css->body.attributes.flags))
        {   
            SE_TRACE(SE_TRACE_DEBUG,
                "SECS attributes.flag does NOT match signature attributes.flag\n");
            return SGX_ERROR_INVALID_ATTRIBUTE;
        }   

        mcp_same_size(&this_secs->mr_enclave, &css->body.enclave_hash, sizeof(sgx_measurement_t));
        this_secs->isv_prod_id = css->body.isv_prod_id;
        this_secs->isv_svn = css->body.isv_svn;

        ippsHashMessage(css->key.modulus, SE_KEY_SIZE, (Ipp8u*)&this_secs->mr_signer, IPP_ALG_HASH_SHA256);
    }   

    // Check launch token
    if (launch != NULL && launch->body.valid) {
        if (memcmp(&launch->body.attributes, &this_secs->attributes, sizeof(sgx_attributes_t)))
        {   
            SE_TRACE(SE_TRACE_DEBUG,
                "SECS attributes does NOT match launch token attribuets\n");
            return SGX_ERROR_INVALID_ATTRIBUTE;
        }   
    }   

    // Mark it initialized
    this_secs->attributes.flags |= SGX_FLAGS_INITTED;

    return SGX_SUCCESS;
}
```

### References
- Intel Software Guard Extensions Programming Reference. [\[link\]](https://software.intel.com/sites/default/files/managed/48/88/329298-002.pdf)
- Intel SGX Explained. [\[link\]](https://eprint.iacr.org/2016/086.pdf)
- Intel SGX Tutorial Slide presented in ISCA 2015.
[\[link\]](https://software.intel.com/sites/default/files/332680-002.pdf)
- Intel SGX SDK Github Repository. [\[link\]](https://github.com/01org/linux-sgx)
- Intel SGX Linux Driver Github Repository.
[\[link\]](https://github.com/01org/linux-sgx-driver)

### License
All source codes are from Intel SGX SDK Github repository and Intel SGX Linux driver Github repository, released under BSD License 2.0 and GNU General Public License 2.0, respectively.

#### Intel SGX SDK
Copyright (C) 2011-2017 Intel Corporation. All rights reserved.  
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
* Redistributions of source code must retain the above copyright  
notice, this list of conditions and the following disclaimer.
* Redistributions in binary form must reproduce the above copyright  
notice, this list of conditions and the following disclaimer in the  
documentation and/or other materials provided with the distribution.
* Neither the name of the <organization> nor the  
names of its contributors may be used to endorse or promote products  
derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

#### Intel SGX Linux driver
(C) Copyright 2015 Intel Corporation

Authors:
* Jarkko Sakkinen <jarkko.sakkinen@intel.com>
* Suresh Siddha <suresh.b.siddha@intel.com>
* Serge Ayoun <serge.ayoun@intel.com>
* Shay Katz-zamir <shay.katz-zamir@intel.com>

This program is free software; you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation; version 2 of the License.
