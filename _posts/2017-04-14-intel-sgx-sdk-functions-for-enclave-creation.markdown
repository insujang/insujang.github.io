---
layout: post
title: "Intel SGX SDK Functions for Enclave Creation"
date: "2017-04-14 13:58:12 +0900"
author: "Insu Jang"
tag: [research, sgx]
---

Many research papers have dealed about how SGX internally works, however, none have handled how SGX SDK works.  
This post explains how Intel [Linux SGX SDK](https://github.com/01org/linux-sgx) calls Intel SGX CPU instructions, to create an enclave.

As we all know, There is an SGX instruction we use to create an enclave, `EADD`. This is a Intel CPU microcode instruction. However, a user program does not directly call this instruction, but calls `sgx_create_enclave()` SDK function. How this function is related to `EADD`?

### 1. `sgx_create_enclave()`
At first, we include `"sgx_urts.h"` to use untrusted sgx library functions when programming a SGX user program. The header is in `/linux-sgx/common/inc/sgx_urts.h`, and its implementation is in `linux-sgx/psw/urts/linux/urts.cpp`.

```c
/linux-sgx/common/inc/sgx_urts.h

sgx_status_t SGXAPI sgx_create_enclave(const char *file_name, const int debug, sgx_launch_token_t *launch_token, int *launch_token_updated, sgx_enclave_id_t *enclave_id, sgx_misc_attribute_t *misc_attr);
```

```c
#include "urts_com.h"
extern "C" sgx_status_t sgx_create_enclave(const char *file_name, const int debug, sgx_launch_token_t *launch_token, int *launch_token_updated, sgx_enclave_id_t *enclave_id, sgx_misc_attribute_t *misc_attr)
{
    sgx_status_t ret = SGX_SUCCESS;
    ...
    ret = _create_enclave(!!debug, fd, file, NULL, launch_token, launch_token_updated, enclave_id, misc_attr);
    ...

    return ret;
}
```

### 2. `_create_enclave()`
As indicated, `_create_enclave()` is declared and defined in `/linux-sgx-/psw/urts/urts_com.h`. It calls an internal function defined in the same file, `__create_enclave()`.

```c
static int __create_enclave(BinParser &parser, uint8_t* base_addr, const metadata_t *metadata, se_file_t& file, const bool debug, SGXLaunchToken *lc, le_prd_css_file_t *prd_css_file, sgx_enclave_id_t *enclave_id, sgx_misc_attribute_t *misc_attr)
{
    ...
    CEnclave* enclave = new CEnclave(loader);

    // initialize the enclave object
    ret = enclave->initialize(file,
                              loader.get_enclave_id(),
                              const_cast<void*>(loader.get_start_addr()),
                              metadata->enclave_size,
                              metadata->tcs_policy);
    ...

    //call trts to do some intialization
    if(SGX_SUCCESS != (ret = get_enclave_creator()->initialize(loader.get_enclave_id())))
    {
        sgx_status_t status = SGX_SUCCESS;
        CEnclavePool::instance()->remove_enclave(loader.get_enclave_id(), status);
        goto fail;
    }
    ...
}
```

### 3. `get_enclave_creator()`
At the first time, I taught that `CEnclave` is an enclave created by CPU, however, it is just a container for a software. Actual enclave is not created by this function call. Instead, `get_enclave_creator()->initialize()` function makes an actual enclave.

`get_enclave_creator()` function is defined in `/linux-sgx/psw/urts/loader.cpp`.

```c++
// enclave creator instance
extern EnclaveCreator* g_enclave_creator;

EnclaveCreator* get_enclave_creator(void)
{
    return g_enclave_creator;
}
```

### 4. `g_enclave_creator`
At here, a function that allocates a class instance for `g_enclave_creator` depends on SGX running mode; simulation, or hardware.

#### SGX running mode
When we compile a sample code, we can put an option named `SGX_MODE`, the value of which is either `SIM` or `HW`. The instruction says that we can use `SGX_MODE=SIM` to run it in simulation mode, and `SGX_MODE=HW` to run it in hardware mode. Some different libraries are linked in terms of the value of the option.

#### Hardware mode
When compiling a program with `SGX_MODE=HW`, `g_enclave_creator` is initialized in `linux-sgx/psw/urts/linux/enclave_creator_hw.cpp`.

```c++
EnclaveCreator* g_enclave_creator = new EnclaveCreatorHW();
static uint64_t g_eid = 0x1;
```

`EnclaveCreatorHW` is a child class, inheriting `EnclaveCreator` class. `EnclaveCreatorHW` is declared in `/linux-sgx/psw/urts/enclave_creator_hw.h`.

Its implementation seems to be divided into two cpp files: `/linux-sgx/psw/urts/enclave_creator_hw_com.cpp` and `/linux-sgx/psw/urts/linux/enclave_creator_hw.cpp`.  
The constructor and `create_enclave()` function is defined in `/linux-sgx/psw/urts/linux/enclave_creator_hw.cpp`.

```c++
EnclaveCreatorHW::EnclaveCreatorHW():
    m_hdevice(-1),
    m_sig_registered(false)
{
    se_mutex_init(&m_sig_mutex);
}

int EnclaveCreatorHW::create_enclave(secs_t *secs, sgx_enclave_id_t *enclave_id, void **start_addr, bool ae)
{
    ...
}
```

I intentionally add a `printf()` call in the constructor function, and check whether it is printed.  
```c++
EnclaveCreatorHW::EnclaveCreatorHW():
    m_hdevice(-1),
    m_sig_registered(false)
{
    printf("Enclave Creator for HW is iniitlaized.\n");
    se_mutex_init(&m_sig_mutex);
}
```

I used a sample user program provided by Intel, `SampleEnclave`.

![enclave_hw](/assets/images/170414enclave_hw.png){: .center-image}
* The result when compiling the sample enclave with `SGX_MODE=HW`.
{: .center}

`prints()` is called when the program is compiled with the option `SGX_MODE=HW`, however, it is not called when it is compiled with the option `SGX_MODE=SIM`.

![enclave_hw2](/assets/images/170414enclave_hw2.png){: .center-image}
* The result when compiling the sample enclave with `SGX_MODE=SIM`.
{: .center}

#### Simulation mode
The above result means that there is another enclave creator for simulation mode.

In the simulation mode, `g_enclave_creator` is initialized in `/linux-sgx/sdk/simulation/urtssim/enclave_creator_sim.cpp` as follows.

```c++
EnclaveCreator* g_enclave_creator = new EnclaveCreatorSim();
```

`EnclaveCreatorSim` class is declared in `/linux-sgx/sdk/simulation/urtssim/enclave_creator_sim.h`, and its functions are defined in `/linux-sgx/sdk/simulation/urtssim/enclave_creator_sim.cpp`.

There is no overridden constructor, so I put a `printf()` call in `EnclaveCreatorSim::create_enclave()` function.

```c++
int EnclaveCreatorSim::create_enclave(secs_t *secs, sgx_enclave_id_t *enclave_id, void **start_addr, bool ae)
{
    UNUSED(ae);

    printf("Enclave Creator for simulation is initialized.\n");
    return ::create_enclave(secs, enclave_id, start_addr);
}
```

![enclave_sim](/assets/images/170414enclave_sim.png){: .center-image}
* The result when compiling the sample enclave with `SGX_MODE=SIM`.
{: .center}


### 5. `EnclaveCreatorHW::create_enclave()`
In simulation mode, Intel SGX SDK does not use any CPU's SGX instructions. So Let's see the internal function call flows of `EnclaveCreatorHW` class.

```c++
int EnclaveCreatorHW::create_enclave(secs_t *secs, sgx_enclave_id_t *enclave_id, void **start_addr, bool ae)
{
    ...
    ret = ioctl(m_hdevice, SGX_IOC_ENCLAVE_CREATE, &param);
    ...
}
```

It passes its control to Intel SGX driver to call `ECREATE`, which is a `ECLS` instruction the can only be called in kernel mode.

This `ioctl()` call is passed through Intel SGX Linux driver, and calls the function `isgx_ioctl_enclave_create()` in `/linux-sgx-driver/isgx_ioctl.c`.

```c
static long isgx_ioctl_enclave_create(struct file *filep, unsigned int cmd,
				      unsigned long arg)
{
    ...
    ret = __ecreate((void *) &pginfo, secs_vaddr);

  	isgx_put_epc_page(secs_vaddr);

  	if (ret) {
  		isgx_info(enclave, "ECREATE returned %d\n", (int)ret);
  		goto out;
  	}
    ...
}
```

`__ecreate()` function is defined in `/linux-sgx-driver/isgx_arch.h`.

```c
static inline unsigned long __ecreate(struct page_info *pginfo, void *secs)
{
	return __encls(ECREATE, pginfo, secs, "d"(0));
}
```

`__encls` function is defined as a macro, with C inline assembly function as follows, in `/linux-sgx-driver/isgx_arch.h`.

```
#ifdef CONFIG_X86_64
#define __encls(rax, rbx, rcx, rdx...)	\
	({				\
	int ret;			\
	asm volatile("1: .byte 0x0f, 0x01, 0xcf;\n\t"	\
		     " xor %%eax,%%eax;\n"		\
		     "2: \n"					\
		     ".section .fixup,\"ax\"\n"			\
		     "3: movq $-1,%%rax\n"			\
		     "   jmp 2b\n"				\
		     ".previous\n"				\
		     _ASM_EXTABLE(1b, 3b)			\
		     : "=a"(ret), "=b"(rbx), "=c"(rcx)		\
		     : "a"(rax), "b"(rbx), "c"(rcx), rdx	\
		     : "memory");				\
	ret;	\
	})
```

And CPU calls `ECREATE` instruction inside itself.

### 6. `EnclaveCreatorSim::create_enclave()`
While simulation mode does not use CPU's SGX instructions, all SGX instructions are also simulated. For example, `ECREATE` is implemented in `/linux-sgx/sdk/simulation/uinst/u_instructions.cpp`.

Let's see how this simulated instruction is called. The starting point is `/linux-sgx/sdk/simulation/urtssim/enclave_creator_sim.cpp`.

```c++
int EnclaveCreatorSim::create_enclave(secs_t *secs, sgx_enclave_id_t *enclave_id, void **start_addr, bool ae)
{
    UNUSED(ae);
    return ::create_enclave(secs, enclave_id, start_addr);
}
```
I don't know in detail about c++, so I cannot understand what `::create_enclave()` means. But seeing the given parameters, it seems to be the one defined in `/linux-sgx/sdk/simulation/drvier_api/driver_api.cpp`.

```c++
/* Allocate linear address space. */
int create_enclave(secs_t           *secs,
                   sgx_enclave_id_t *enclave_id,
                   void             **start_addr)
{
    ...
    ce = reinterpret_cast<CEnclaveSim*>(DoECREATE_SW(&pinfo));
    ...
}
```

### 7. `DoECREATE_SW()`
`DoECREATE_SW()` function is declared in `/linux-sgx/sdk/simulation/assembly/asxsim.h`, however, there is no definition on the name. Instead, it uses a macro to change the function name. The macro is defined in `/linux-sgx/sdk/simulation/assembly/linux/sw_emu.h`

```
/* This macro is used to generate simulation functions like:
 * DoECREATE_SW, DoEADD_SW, ...
*/
.macro DoSW inst
DECLARE_LOCAL_FUNC Do\()\inst\()_SW
    SE_PROLOG
    \inst\()_SW
    SE_EPILOG
.endm
```
which means `Do'ECREATE'_SW` is declared as `'ECREATE'_SW`. And `ECREATE_SW` is also declared right above.

```
.macro ECREATE_SW
    SE0_SW SE_ECREATE
.endm

.macro EADD_SW
    SE0_SW SE_EADD
.endm

.macro EINIT_SW
    SE0_SW SE_EINIT
.endm

.macro EREMOVE_SW
    SE0_SW SE_EREMOVE
.endm
```
Hence, `DoECREATE_SW()` actually calls `SE_ECREATE()` function, defined in `/linux-sgx/sdk/simulation/uinst/u_instructions.cpp`.

```c
uintptr_t _SE0(uintptr_t xax, uintptr_t xbx,
               uintptr_t xcx, uintptr_t xdx,
               uintptr_t xsi, uintptr_t xdi)
{
    UNUSED(xsi), UNUSED(xdi);

    switch (xax)
    {
    case SE_ECREATE:
        return _ECREATE(reinterpret_cast<page_info_t*>(xbx));
    ...
    }

    return 0;
}
```

It seems that macros are used for simulating registers and CPU behaviors. Hence, `SE_ECREATE()` is saved in the `xax` variable and `_SE0` calls `_ECREATE()`, which is a simulated `ECREATE` function, as I explained in [\[here\]](/2017-04-05/intel-sgx-instructions-in-enclave-initialization/).

## References
- Intel SGX SDK Github repository. https://github.com/01org/linux-sgx
- Intel SGX Linux driver Github repository. https://github.com/01org/linux-sgx-driver

## License
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

This program is free software; you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation; version 2 of the License.
