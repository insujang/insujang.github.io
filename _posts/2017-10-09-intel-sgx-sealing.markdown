---
layout: post
title: "Intel SGX Sealing"
date: "2017-10-09 15:26:34 +0900"
author: "Insu Jang"
tags: [research, sgx, io]
---

There is a few information related to sealing, even no detailed explanation in the paper: Intel SGX explaned.
All in this post are from Intel, with a little thought of mine.

## Sealing

Sealing is a service that Intel provides with Intel SGX technology for secure data saving.  
Intel SGX provides protections data only if it is in the enclave, part of main memory.
Therefore, when the enclave process exits, the enclave will be destroyed and any data that is secured whithin the enclave will be lost.
If the data is meant to be re-used later, the enclave must make special arrangements to store the data outside the enclave.

Using sealing, the data within the enclave is encrypted using an encryption key that is derived from the CPU hardware. The encryption provides assurances of confidentiality, integrity, and authenticity on the data.

> Note: Like Intel SGX does, sealing does not provide availability to the sealed data.
Therefore, the data may be lost due to disk corruption, malicious modification (e.g. Ransomeware), etc.

Intel SGX provides two policies for encryption keys: MRENCLAVE (enclave identity) and MRSIGNER (signing identity).
These policies affect the derivation of the encryption key, and this is partially explained in Intel SGX explained.
- Section 5.6. Enclave Measurement (MRENCLAVE)
- Section 5.7.2. Certificate-Based Enclave identity (MRSIGNER)
- Section 5.7.4. Establishing an Enclave's Identity

### MRENCLAVE
Derive a key based on the value of the enclave's MRENCLAVE. Any change that impacts the enclave's measurement will yield a different key, providing full isolation between enclaves.  
The paper also mentions that "different versions of the same enclave will also have different seal keys, preventing offline data migration."
In other words, the MRENCLAVE-based keys are available only to enclave instances sharing the same MRENCLAVE.

### MRSIGNER
Derive a key based on the value of the enclave's MRSIGNER, and the enclave's version. MRSIGNER reflects the **key or identity of the Sealing Authority** that signed the enclave's certificate.
The Sealing Authority may sign multiple enclaves and enable them to retrieve the same seal key. These enclaves can transparently access data that was sealed by the other.

While sealing with MRENCLAVE does not allow offline data migration between the same enclave with different versions, this allows limited data migration (only older version to newer version) or between different enclaves with the same Signing identity.

The MRSIGNER-based keys are bound to the 3 tuples (MRSIGNER, ISVPRODID, ISVSVN). The keys are available to any enclave with:
- the same MRSIGNER
- the same ISVPRODID
- and ISVSVN equal to or greather than the key in questions. (greather than the key means current enclave is a newer one.)

> Here, **different version** seems to mean different **<mark>Security Version Number (SVN)</mark>**, which is explained in the paper Intel SGX explained (p79).
>
> ![isvsvn](/assets/images/171009/isvsvn.png){: .center-image width="400px"}
>
>  Enclaves that represent different versions of a module
can have different security version numbers (SVN). The SGX design disallows the migration of secrets from an enclave with a higher SVN to an enclave with a lower SVN.
>
> As users upgrade, SGX will facilitate the migration of secrets from the vulnerable version of the enclave to the fixed version. Once a user’s secrets have migrated, the SVN restrictions in SGX will deflect any attack based on building the vulnerable enclave version and using it to read the migrated secrets.
>
> As explained above, a software module’s SVN should only be incremented when a security vulnerability is found. SIGSTRUCT only allocates 2 bytes to the ISVSVN field, which translates to 65,536 possible SVN values. This space can be exhausted if a large team (incorrectly) sets up a continuous build system to allocate a new SVN for every software build that it produces, and each code change triggers a build.

### SDK Functions

Intel SGX SDK provides some functions for data sealing.

- `sgx_seal_data_ex` / `sgx_unseal_data_ex` [[ref](https://software.intel.com/en-us/node/709129)]
- `sgx_seal_data` / `sgx_unseal_data` [[ref](https://software.intel.com/en-us/node/709128)]
    Simplified version of `sgx_seal_data_ex`, which uses MRSIGNER policy by default.
- `sgx_calc_sealed_data_size` [[ref](https://software.intel.com/en-us/node/709125)]
    Reference code in [[here](https://software.intel.com/en-us/forums/intel-software-guard-extensions-intel-sgx/topic/701485)]
    uses the function to allocate memory space for sealed data.

SDK function introduction is [[here](https://software.intel.com/en-us/node/709048)].

A very simple example data sealing code is as follows.

```c
sgx_status_t res;
uint8_t* plaintext = (uint8_t*) malloc(plaintext_len);
// Do something in plaintext memory space.

// Allocate space for sealing
uint32_t ciph_size = sgx_calc_sealed_data_size(0, plaintext_len);
uint8_t* sealed = (uint8_t*) malloc(ciph_size);
uint32_t plain_size = plaintext_len;

// Seal and unseal the data
res = sgx_seal_data(0, NULL, plaintext_len, plaintext, ciph_size, (sgx_sealed_data_t *) sealed);
assert(res == SGX_SUCCESS);

res = sgx_unseal_data((sgx_sealed_data_t *) sealed, NULL, NULL, plaintext, &plain_size);
assert (res == SGX_SUCCESS);
```

### References

- Innovative Technology for CPU Based Attestation and Sealing [[link]](https://software.intel.com/sites/default/files/article/413939/hasp-2013-innovative-technology-for-attestation-and-sealing.pdf)
- Introduction to Intel(R) SGX Sealing [[link]](https://software.intel.com/en-us/blogs/2016/05/04/introduction-to-intel-sgx-sealing)
- Intel 64 and IA-32 Architectures Software Developer's Manual Volume 3D: System Programming Guide, Part 4 [[link]](https://software.intel.com/sites/default/files/managed/7c/f1/332831-sdm-vol-3d.pdf)
