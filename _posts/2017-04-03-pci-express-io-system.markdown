---
layout: post
title: "PCI Express I/O System"
date: "2017-04-03 12:12:58 +0900"
author: "Insu Jang"
tags: [pcie,cuda]
---

# I/O Hardware Overview

The basic I/O hardware elements, such as ***ports, buses, and device controllers***,
accomodate a wide variety of I/O devices.

To encapsulate the details and oddities of different devices, the kernel of an
operating system is structured to use device-driver modules.

A device communicates with a computer system by sending signals over a cable or through the air.
- The device communicates with the machine via a connection point, or **port**.
- If devices share a common set of wires, the connection is called a bus. (e.g. PCI bus)
- A controller is a collection of electronics that can operate a port, a bus, or a device.


How can the processor give commands and data to a controller to accomplish an I/O transfer?
The short answer is that the controlelr has one or more registers for data and control signals.

Two ways in which this communiation can occur:
1. Use of **special I/O instructions** that specify the transfer of a byte or word to an I/O port address.
The I/O instruction triggers bus lines to select the proper device and to move bits into or out of a device register.
2. Using **memory-mapped I/O**. The device-control registers are mapped into the address space
of the processor.
The CPU executes I/O requests using the standard data-transfer instructions to read and write the device-control registers at their mapped locations in physical memory.

# NVIDIA GPU on PCI Express
The current form of the GPU is a PCI express device. The NVIDIA GPU exposes the following base address registers (BARs) to the system through PCI in addition to the PCI configuration space and VGA_compatible I/O ports.

BAR0
: Memory-mapped I/O (MMIO) registers

BAR1
: Device memory windows.

BAR2
: Complementary space of BAR1.

BAR5
: I/O port.

BAR6
: PCI ROM.

The most significant area is the BAR0 presenting MMIO registers.
This is the main control space of the GPU, through which **all hardware engines are controlled**.

Here is the GPU information provided by `lspci` command that I am using.
![gpu_lspci](/assets/images/gpu_lspci.png)

BAR0: `0xde000000` (MMIO registers)
BAR1 and BAR2: `0xd0000000` (64-bit memory-map uses two adjacent BARs)
BAR3 and BAR4: `0xd8000000` (64-bit memory map)
BAR5: `0xe000` (I/O ports)
BAR6: `0xdf000000` (PCI Expansion ROM)

### References
- Silberschatz A, Galbin P.B, Gagne G, Operating System Concepts, Wiley, 2012, ISBN:9781118063330
- Root Complex, Wikipedia [Online] https://en.wikipedia.org/wiki/Root_complex
- Kato S, Implementing open-source CUDA runtime, In Proceddings of the 54-th Programming Symposium, 2013
