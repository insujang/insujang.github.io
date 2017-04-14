---
layout: post
title: "Adding an Additional SGX Instruction"
date: "2017-04-14 23:22:59 +0900"
author: "Insu Jang"
tag: [research, sgx]
---
# Implementing a SGX SDK Function for the Instruction
## 1. Function Declaration
Declare a Function into `/linux-sgx/common/inc/sgx_urts.h`.

```c
...
sgx_status_t SGXAPI sgx_create_abc(void);
```

## 2. Function Definition
Define a Function into any file in `/linux-sgx/psw/urts/`. I defined it in `/linux-sgx/psw/urts/linux/urts.cpp`, as follows.

```c
extern "C" sgx_status_t sgx_create_abc()
{
    printf("Hello from %s!\n", __func__);
    return SGX_SUCCESS;
}
```

Also, you should define a function with the same name in `/linux-sgx/sdk/simulation/urtssim/urts_deploy.c`, but with `void` return type and no parameters.

```c
void sgx_create_abc(){};
void sgx_debug_load_state_add_element(){};
void sgx_debug_unload_state_remove_element(){};
void sgx_destroy_enclave(){};
...
```

## 3. Add a Function in .lds
Add a function name in `/linux-sgx/psw/urts/linux/urts.lds`.
Without this step, executing an user application causes the following error:

```
./app: symbol lookup error: ./app: undefined symbol: sgx_create_abc
```


```
{
    global:
        sgx_create_enclave;
        sgx_create_abc;
        sgx_destroy_enclave;
        ...
}
```

## 4. Call the Function in User Application!
```c
#include "sgx_urts.h"
int main(){
    ...
    sgx_create_abc();
    ...
}
```

![sgx_create_abc](/assets/images/170414/sgx_create_abc.png){: .center-image}

# Implementing an SGX Simulated Instruction
## 1. Instruction Definition
Simulated SGX instructions are in `/linux-sgx/sdk/simulation/uinst/u_instructions.cpp`.

Add a new instruction `_EABC()` in here.

```c
uintptr_t _EABC()
{
    printf("Hello from %s!\n", __func__);
    return SGX_SUCCESS;
}
```

Also, we should add the function call in either `_SE0()`, which means this instruction is ENCLS, or `_SE3()`, which means this instruction is ENCLU.

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

    case SE_EADD:
        return _EADD(reinterpret_cast<page_info_t*>(xbx),
                     reinterpret_cast<void*>(xcx));
    ...
    case SE_EABC:
        return _EABC();
    ...
    }
}
```

## 2. Assign an SE Instruction Number
We uses `SE_EABC`, which is not defined yet. Add a definition into `/linux-sgx/common/inc/internal/inst.h`.

```c
typedef enum {
    SE_EREPORT = 0x0,
    SE_EGETKEY,
    SE_EENTER,
    SE_ERESUME,
    SE_EEXIT,
    SE_LAST_RING3,

    SE_ECREATE = 0x0,
    SE_EADD,
    SE_EINIT,
    SE_EREMOVE,
    SE_EABC,
    SE_EDBGRD,
    SE_EDBGWR,
    SE_EEXTEND,
    SE_LAST_RING0
} se_opcode_t;
```

<s>
Note that `SE_EABC` should be the last, to make the other variables' value not changed.
</s>

**Update**: Note that `SE_EABC` must directly follow `SE_EREMOVE`, to make it have the value of 4. `SE_EDBGRD, SE_EDBGWR, SE_EEXTEND, SE_LAST_RING0` are currently not used.

Also add a SE instruction in `/linux-sgx/common/inc/internal/linux/linux-regs.h`.

```c
/* SE instructions - needs to be sync-up with inst70.h */
#define SE_EREPORT    0
#define SE_EGETKEY    1
#define SE_EENTER     2
#define SE_EEXIT      4

#define SE_ECREATE    0
#define SE_EADD       1
#define SE_EINIT      2
#define SE_EREMOVE    3
#define SE_EABC       4
```

Make the value same with what you set in `se_opcode_t`.

# Bridging the SDK Function and the SGX Instruction
Detailed explanation is in [\[here\]](/2017-04-14/intel-sgx-sdk-functions-for-enclave-creation/).

## 1. Add a Macro for Assembly Simulation
Add some macros in `/linux-sgx/sdk/simulation/assembly/linux/sw_emu.h`

```
...
.macro EREMOVE_SW
    SE0_SW SE_EREMOVE
.endm

.macro EABC_SW
    SE0_SW SE_EABC
.endm
```

I do not know in detail, but it automatically calls `_SE0()` function in `/linux-sgx/sdk/simulation/uinst/u_instructions.cpp`, with `xax=SE_EABC`.

The macro described in below declares a local function named `DoEABC_SW` as an wrapper of `EABC_SW` macro that we just created. It is already well written, so do not add this macro in anywhere.

```
.macro DoSW inst
DECLARE_LOCAL_FUNC Do\()\inst\()_SW
    SE_PROLOG
    \inst\()_SW
    SE_EPILOG
.endm
```

Add a symbol into `/linux-sgx/sdk/simulation/assembly/linux/sgxsim.S`.

```
/* DoECREATE_SW, DoEADD_SW, DoEINIT_SW, DoEREMOVE, ... */
DoSW ECREATE
DoSW EADD
DoSW EINIT
DoSW EREMOVE
DoSW EABC
```

## 2. Add a Function Declaration for Assembly - C Interface
Add a function declaration in `/linux-sgx/sdk/simulation/assembly/sgxsim.h` to make the function be called in the other code.

```c
...
uintptr_t DoEREMOVE_SW(uintptr_t unused_xbx, void* epc_lin_addr);

uintptr_t DoEABC_SW();
```

All `Do(inst)_SW` functions are called in `/linux-sgx/sdk/simulation/driver_api/driver_api.cpp`. For example, `DoECREATE_SW()` function is called by the function `create_enclave()`.

Implement a new arbitrary function `create_abc()` in here.

```c
int create_abc()
{
    return (int) DoEABC_SW();
}
```

Also don't forget to add a declaration in the corresponding header: `/linux-sgx/common/inc/internal/driver_api.h`.

```c
/*
@enclave_id identify the unique enclave;
@start_addr is the linear address that driver allocate for app;
*/
int create_enclave(secs_t *secs, sgx_enclave_id_t *enclave_id, void **start_addr);
...
int create_abc();
```

## 3. Connect the SDK Function and the Instruction Interface
`create_enclave()` is called by `EnclaveCreatorSim::create_enclave()`, defined in `/linux-sgx/sdk/simulation/urtssim/enclave_creator_sim.cpp`.

First, we add a member function inside the class in `/linux-sgx/sdk/simulation/urtssim/enclave_creator_sim.h`.

```c++
class EnclaveCreatorSim : public EnclaveCreator
{
public:
    int create_enclave(secs_t* secs, sgx_enclave_id_t* enclave_id, void** start_addr, bool ae);
    int create_abc();
    ...
};
```

And implement a function that calls `create_abc()`.

```c++
int EnclaveCreatorSim::create_abc()
{    
    return ::create_abc();
}
```

Originally, `EnclaveCreatorSim::create_enclave()` is called by `CLoader`. But we will make `EnclaveCreatorSim::create_abc()` be directly called by the SGX SDK function, as `EnclaveCreatorSim::initialize()` is called directly by a function in SGX SDK function, `sgx_create_enclave()`.  
(`sgx_create_enclave()` calls `_create_enclave()`, which is defined in `/linux-sgx/psw/urts/urts_com.h`, and it calls `__create_enclave()` defined in the same file, and it calls `get_enclave_creator()->initialize()`.)

We already added the function `sgx_create_abc()` in `/linux-sgx/psw/urts/linux/urts.cpp`. Let's modify this function to call `EnclaveCreatorSim::create_abc()`.

```c
extern "C" sgx_status_t sgx_create_abc()
{
    sgx_status_t ret = SGX_SUCCESS;
    printf("Hello from %s!\n", __func__);

    ret = (sgx_status_t) get_enclave_creator()->create_abc();

    return ret;
}
```

However, when you compile SGX SDK, the compiler shows the following error.

```
/home/insujang/sgx/workspace/linux-sgx/psw/urts/linux/urts.cpp:79:31: error: ‘class EnclaveCreator’ has no member named ‘create_abc’
  ret = get_enclave_creator()->create_abc();
```

`get_enclave_creator()` returns an instance of `EnclaveCreator` class, not an instance of `EnclaveCreatorSim`, which is a child class of `EnclaveCreator`.

Hence, we should add a function in the parent class. `EnclaveCreator` class is declared in `/linux-sgx/common/inc/internal/enclave_creator.h`.  
As we declared a function as `int create_abc()`, we should make the format same. Also, the function in `EnclaveCreator` must be a virtual function (not pure) as two other classes also inherit `EnclaveCreator` class, which do not override this function.

```c++
// this is the interface to both hardware, simulation and signing mode
class EnclaveCreator : private Uncopyable
{
public:
    ...
    virtual int create_abc() { return (int) SGX_SUCCESS; };
};
```

# Run It!
Now compile SDK, install it, and also compile an user application and run it. Don't forget to compile it with `SGX_MODE=SIM`, because it uses a simulated instruction.

The result is as follows.

![sgx_add_instruction](/assets/images/170414/sgx_add_instruction.png){: .center-image}
* The result of adding an additional SGX instruction, `EABC`.
{: .center}

- `Hello from sgx_create_abc!` from the SGX SDK function `sgx_create_abc()`.
- `Hello from _EABC!` from the SGX simulated instruction `_EABC()`.
