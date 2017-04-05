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

> I could not find how SGX finds one free EPC page among several free pages in detail.

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

    // `ce' is not checked against NULL, since it is not
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

### 3. EEXTEND
- [Intel SGX Explained p64] Section 5.3.2. Loading
- [Programming References p31] Section 5.3. EEXTEND

While loading an enclave, the system software will also use the `EEXTEND` instruction, which updates the enclave's measurement used in the software attestation process.  
It updates the MRENCLAVE measurement register of an SECS with the measurement of an EXTEND string compromising of "EEXTEND" || ENCLAVEOFFSET || PADDING || 256 bytes of the enclave page.

RCX register contains the effective address of the 256 byte region of an EPC page to be measured.

```
No simulation code
```

### 4. EINIT
- [Intel SGX Explained p64] Section 5.3.3. Initialization
- [Programming References p34] Section 5.3. EINIT

This function is the final instruction executed in the enclave build process. After EINIT, the MRENCLAVE measurement is cimplete, and the enclave is ready to start user code execution using EENTER instruction.

When `EINIT` completes successfullyy, it sets the enclave's INIT attribute to true. This opens the way for ring 3 application software to execute the enclave's code, using the SGX instructions.

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
- Intel SGX SDK Github Repository. [\[link\]](https://github.com/01org/linux-sgx)

### License
All source codes are from Intel SGX SDK Github repository with some comments, under BSD License 2.0.

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
