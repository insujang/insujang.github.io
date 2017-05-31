---
layout: post
title: "Implementing and Using Custom Intel SGX Trusted Library"
date: "2017-05-31 18:42:44 +0900"
author: "Insu Jang"
tags: [research, sgx]
---

# Intel SGX Trusted Library

Trusted libraries are libraries that are linked to a SGX program, and used **inside** an enclave. Hence, it should follow SGX enclave restrictions to be used.  
According to Intel SGX SDK document, restrictions are as follow.

- Trusted libraries are **static libraries** that linked with the enclave binary.
- This functions/objects can only be used **from within the enclave.** (=ECALL cannot be implemented in a library)
- We should not link the enclave with any trusted library including C/C++ standard libraries.

![sgx_trusted_library](/assets/images/170531/sgx_trusted_library.png)

I'm currently using Intel SGX Eclipse plugin to develop SGX programs. This post is about implementing a third-party Intel SGX trusted library.

Installation guide of Intel SGX Eclipse plugin is in [\[here\]](https://01.org/sites/default/files/documentation/intel_sgx_sdk_installation_guide_for_linux_os.pdf).

<!-- https://download.01.org/intel-sgx/linux-1.8/docs/ -->

# Implementing Intel SGX Trusted Library in Eclipse

## 1. Simple library template

![sgx_eclipse_trusted_new](/assets/images/170531/sgx_eclipse_trusted_new.png){: .center-image}

![sgx_eclipse_trusted_new2](/assets/images/170531/sgx_eclipse_trusted_new2.png){: .center-image}

In Eclipse, we can easily make a new SGX project. But different from making a normal SGX application, we select Static Library - Empty Project, instead of choosing an executable.

After making an empty project, there is nothing in it. Create a trusted SGX library template as follows.

![sgx_eclipse_trusted_new3](/assets/images/170531/sgx_eclipse_trusted_new3.png){: .center-image}

The structure is simple: nothing in `untrusted` directory, a file for ecall in `static_trusted` directory.

When we build it, `libtrusted.sgx.static.lib.a` library file and `trusted_u.c/h` in `untrusted` directory are created.

## 2. Implementing a function callable inside an enclave

Just building a simple template is super easy. Then how we can add a trusted function into this trusted library?

Define and implement a function in a file with any name in `static_trusted` directory.

![sgx_eclipse_trusted_new_function](/assets/images/170531/sgx_eclipse_trusted_new_function.png){: .center-image}

That's it. As it is not an ECALL, we don't need to add the function into EDL.


## 3. Linking a library to a SGX application

Now our new trusted function can be used within any enclave. Let's link this library to an SGX application.  
Making a sample SGX application is well explained in the Eclipse Help content (`Help > Help Contents > Intel(R) SGX Eclipse Plug-in Developer Guide` in Eclipse window).

From the basic understanding of using a library, what we need is:
- A header including the definition of the function (`static_trusted/another_trusted.h`)
- A binary library file that is linked (`libtrusted.sgx.static.lib.a`)

Add this information into the makefile for an application enclave.

![sgx_eclipse_trusted_new_function3](/assets/images/170531/sgx_eclipse_trusted_new_function3.png){: .center-image}

Call a trusted function inside an ecall function. A result is as follows.

![sgx_eclipse_trusted_new_function2](/assets/images/170531/sgx_eclipse_trusted_new_function2.png){: .center-image}
