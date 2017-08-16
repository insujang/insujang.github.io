---
layout: post
title: "Enabling AtomicOps in VFIO PCI Passthrough"
date: "2017-08-16 16:48:47 +0900"
author: "Insu Jang"
tags: [research, amd, gpu]
---

I tried to use AMD's GPU for research, with the software stack called [AMD ROCm](https://rocm.github.io/).
AMD ROCm is a AMG discrete GPU compatible [Heterogeneous System Architecure (HSA) framework](http://www.hsafoundation.com/).

HSA is unique properties, different from OpenCL or CUDA: user mode queuing mode.
![hsa_queuing_model](/assets/images/170816/hsa_queuing_model.png){: .center-image}

Instead of traditional driver centrl models, in HSA, user applications are responsible
to create a request packet to the command queue heading to the GPU directly.

AMD ROC sample code illustrates how a user application creates the packet:
```
/*
 * Write the aql packet at the calculated queue index address.
 */
const uint32_t queueMask = queue->size - 1;
hsa_kernel_dispatch_packet_t* dispatch_packet = &(((hsa_kernel_dispatch_packet_t*)(queue->base_address))[index&queueMask]);

dispatch_packet->setup  |= 1 << HSA_KERNEL_DISPATCH_PACKET_SETUP_DIMENSIONS;
dispatch_packet->workgroup_size_x = (uint16_t)256;
dispatch_packet->workgroup_size_y = (uint16_t)1;
dispatch_packet->workgroup_size_z = (uint16_t)1;
dispatch_packet->grid_size_x = (uint32_t) (1024*1024);
dispatch_packet->grid_size_y = 1;
dispatch_packet->grid_size_z = 1;
dispatch_packet->completion_signal = signal;
dispatch_packet->kernel_object = kernel_object;
dispatch_packet->kernarg_address = (void*) kernarg_address;
dispatch_packet->private_segment_size = private_segment_size;
dispatch_packet->group_segment_size = group_segment_size;

uint16_t header = 0;
header |= HSA_FENCE_SCOPE_SYSTEM << HSA_PACKET_HEADER_ACQUIRE_FENCE_SCOPE;
header |= HSA_FENCE_SCOPE_SYSTEM << HSA_PACKET_HEADER_RELEASE_FENCE_SCOPE;
header |= HSA_PACKET_TYPE_KERNEL_DISPATCH << HSA_PACKET_HEADER_TYPE;

__atomic_store_n((uint16_t*)(&dispatch_packet->header), header, __ATOMIC_RELEASE);
```

It uses `__atomic_store_n`, which is an Atomic operation that PCI Express 3.0 supports.

Unfortunately, under KVM virtualized environment, it doesn't work due to AtomicOps passthrough problem.
So I opened an issue to [the Github repository](https://github.com/RadeonOpenCompute/ROCK-Kernel-Driver/issues/26) about this problem.
An AMD engineer, Gregory Stoner, answered that how to enable AtomicOps passthrough in a KVM virtualized environment.

> KVM can get the AtomicOp Routing working, we need the AtomicOp Requester Enable flag to get set on the GPU. What was happening is PCI configuration space (or update to Device Capabilities 2 register) isn’t writeable from within the guest os to prevent escapes from the VM . We need the host os/vm to set the config bit.

He also indicated how to enable it manually by modifying a bit in PCI configuation space.

Before setting the bit:

```
sudo lspci -s 0b:00.0 -xxx
0b:00.0 Display controller: Advanced Micro Devices, Inc. [AMD/ATI] Device 7300 (rev c1)
00: 02 10 00 73 07 05 10 00 c1 00 00 03 10 00 80 00
10: 0c 00 00 e0 ff 2f 00 00 0c 00 00 f0 ff 2f 00 00
20: 01 00 00 00 00 00 b0 c7 00 00 00 00 02 10 35 0b
30: 00 00 fe ff 48 00 00 00 00 00 00 00 0b 01 00 00
40: 00 00 00 00 00 00 00 00 09 50 08 00 02 10 35 0b
50: 01 58 03 f6 08 00 00 00 10 a0 12 00 a1 8f 00 00
60: 2c 28 00 00 03 0d 40 08 00 00 01 11 00 00 00 00
70: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 70 00
80: 0000 00 00 0e 00 00 00 03 00 01 00 00 00 00 00
90: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
a0: 05 00 81 00 98 03 e0 fe 00 00 00 00 00 00 00 00
b0: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
c0: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
d0: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
e0: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
f0: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
```

Setting the 40-th bit in PCI configuration space with the following commands:

```
sudo setpci -v -d *:7300 80.b=40
0000:0c:00.0 @80 40
0000:0b:00.0 @80 40
```

Then the result:

<pre>
sudo lspci -s 0b:00.0 -xxx
0b:00.0 Display controller: Advanced Micro Devices, Inc. [AMD/ATI] Device 7300 (rev c1)
00: 02 10 00 73 07 05 10 00 c1 00 00 03 10 00 80 00
10: 0c 00 00 e0 ff 2f 00 00 0c 00 00 f0 ff 2f 00 00
20: 01 00 00 00 00 00 b0 c7 00 00 00 00 02 10 35 0b
30: 00 00 fe ff 48 00 00 00 00 00 00 00 0b 01 00 00
40: 00 00 00 00 00 00 00 00 09 50 08 00 02 10 35 0b
50: 01 58 03 f6 08 00 00 00 10 a0 12 00 a1 8f 00 00
60: 2c 28 00 00 03 0d 40 08 00 00 01 11 00 00 00 00
70: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 70 00
80: <b>40</b> 00 00 00 0e 00 00 00 03 00 01 00 00 00 00 00
90: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
a0: 05 00 81 00 98 03 e0 fe 00 00 00 00 00 00 00 00
b0: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
c0: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
d0: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
e0: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
f0: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
</pre>

Then, AtomicOps work like a charm.
