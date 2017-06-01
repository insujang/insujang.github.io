---
layout: post
title: "Implementing and Using Custom Intel SGX Trusted Library 2"
date: "2017-06-01 19:58:54 +0900"
author: "Insu Jang"
tags: [research, sgx]
---

In the previous post, I showed how to link a trusted function that can be called insdie the enclave.

However, Intel SGX provides a way to **import EDL** to make a library have an ECALL. The post from Intel is [\[here\]](https://software.intel.com/en-us/node/708990).

## 1. Implementing a trusted SGX library

As we do in the previous post, make a trusted library.

![sgx_eclipse_trusted_new_function_2](/assets/images/170601/sgx_eclipse_trusted_new_function_2.png){: .center-image}

So our simple trusted SGX library has a function named `ecall_testlib_sample`. Let's call this function from user space application, but outside an enclave.

## 2. Importing an EDL file

![sgx_eclipse_trusted_new_function_2_1](/assets/images/170601/sgx_eclipse_trusted_new_function_2_1.png){: .center-image}

The most important thing is to import a trusted library's EDL, as explained in the Intel's post.

You can selectively import functions by specifying function names instead of using wildcard character.

## 3. Specifying search path for the imported EDL

When building it, it says 'cannot find testlib.edl' in the search path. We need to add a search path to help GNU make search this EDL file.

![sgx_eclipse_trusted_new_function_2_2](/assets/images/170601/sgx_eclipse_trusted_new_function_2_2.png){: .center-image}

You should add search path to two Makefiles for trusted source code and untrusted one, respectively.

## 4. Linking a static library

Link a built binary static trusted library into a Makefile for trusted source.

![sgx_eclipse_trusted_new_function_2_3](/assets/images/170601/sgx_eclipse_trusted_new_function_2_3.png){: .center-image}

That's it. Build your application and test whether it works.

![sgx_eclipse_trusted_new_function_2_4](/assets/images/170601/sgx_eclipse_trusted_new_function_2_4.png){: .center-image}

A ECALL function from the library is successfully called.
