---
layout: post
title: "Introduction to VFIO"
date: "2017-04-24 10:13:55 +0900"
author: "Insu Jang"
tags: [research, linux, pcie]
---

# Virtual Function I/O (VFIO)
- Introduced to replace the old-fashioned KVM PCI device assignment (virtio).
- Userspace driver interface
- Use IOMMU (AMD IOMMU, Intel VT-d, etc)
- Full PCI interrupt, MMIO and I/O port access, PCI configuration space access support
- Take **an abstract view of a device**: to support anything!

## VFIO Device Filer descriptor
- located in /dev/vfio

    ![vfio_list](/assets/images/vfio_list.png)
- Each divided into regions
    - **Each region maps to a device resource (MMIO BAR, IO BAR, PCI configuration space)**
    - Region count and information discovered **through ioctl**.  
    Properties that can be discovered via ioctl are:
        1. VFIO_DEVICE_GET_INFO (`/linux/include/uapi/linux/vfio.h:186~204`)

            ```c
            #define VFIO_DEVICE_GET_INFO    _IO(VFIO_TYPE, VFIO_BASE + 7)
            ```
        2. VFIO_DEVICE_GET_REGION_INFO (`/linux/include/uapi/vfio.h:206~230`)

            ```c
            #define VFIO_DEVICE_GET_REGION_INFO _IO(VFIO_TYPE, VFIO_BASE + 8)
            ```
        3. VFIO_DEVICE_GET_IRQ_INFO (`/linux/include/uapi/vfio.h:291~333`)

            ```c
            #define VFIO_DEVICE_GET_IRQ_INFO    _IO(VFIO_TYPE, VFIO_BASE + 9)
            ```

    ![vfio_regionmap](/assets/images/vfio_regionmap.png){: .center-image width="800px"}
    - `vfio_pci_ioctl()` function is implemented in `/linux/drivers/vfio/pci/vfio_pci.c:545`.

## VFIO-PCI Device Driver Structure
- Mainly focus on **`vfio-pci`**
- Implementation is in `/linux/drviers/vfio/pci`. Main driver code is `vfio_pci.c`. This kernel module is compiled as `vfio_pci`, and we load the module as `modprobe vfio-pci` for VFIO based PCI-passthrough.

    ```
    $ sudo modprobe vfio_pci
    $ sudo vfio-bind 0000:01:00.0
    ```
    - Main kernel module file is `vfio_pci.c`. When Linux kernel initializes this module, `vfio_pci_init()` is called.

        ```c
        static int __init vfio_pci_init(void) {
            // Allocate shared config space permision data used by all devices
            vfio_pci_init_perm_bits();
            // Register and scan for devices
            pci_register_device(&vfio_pci_driver);
            vfio_pci_fill_ids();
            return 0;
        }
        ```
    - Also when loading the kernel module, `vfio_pci_probe()` function is called. This is a part of kernel module operation data structure `static struct pci_driver vfio_pci_driver`.

        ```c
        static int vfio_pci_probe(struct pci_dev *pdev, const struct pci_device_id *id) {
            struct vfio_pci_device* vdev;
            vdev = kzalloc(sizeof(*vdev), GFP_KERNEL);
            vdev->pdev = pdev;
            vdev->irq_type = VFIO_PCI_NUM_IRQS;
            vfio_add_group_dev(&pdev->dev, &vfio_pci_ops, vdev);
            ...
        }
        ```

        Here, VFIO PCI device structure is mapped to`pdev`, which represents the actual PCI device.

    - To use VFIO, we pass a kind of parameter to QEMU, like  
    `-device vfio-pci,host=01:00.0,bus=root.1.addr=00.0,multifunction=on,x-vga=on`  
    The above option is for passing a GPU (`01:00.0`) to a virtual machine.

        When QEMU opens a VFIO device driver to load the device, `vfio_pci_open()` is called. This function is a part of operations struct `static const struct vfio_device_ops vfio_pci_ops`.

        ```c
        static int vfio_pci_open(void *device_data)
        {
            struct vfio_pci_device* vdev = device_data;
            try_module_get(THIS_MODULE);
            vfio_pci_enable(vdev);
            vfio_spapr_pci_eeh_open(vdev->pdev);
            vdev->refcnt++;
            ...
        }
        ```
        A presentation says `vfio-iommu-type1` works with x86 style guest mapping, but the implementation uses POWER SPAPR.

    - In probing the kernel module, `vfio_pci_ops` is mapped to the VFIO device. This data structure contains the following operations.

        ```c
        static const struct vfio_device_ops vfio_pci_ops = {
          .name       = "vfio-pci",
          .open       = vfio_pci_open,
          .release    = vfio_pci_release,
          .ioctl      = vfio_pci_ioctl,
          .read       = vfio_pci_read,
          .write      = vfio_pci_write,
          .mmap       = vfio_pci_mmap,
          .request    = vfio_pci_request,
        };
        ```

        Device information can be passed via `vfio_pci_ioctl()`, as said earlier.  
        To read and write a data, `vfio_pci_read()` and `vfio_pci_write()` functions are used.
        These functions are wrappers of `vfio_pci_rw()` (`/linux/drivers/vfio/pci/vfio_pci.c:985,994`).

        `vfio_pci_rw()` is defined right above `vfio_pci_read()`, which calls
        1. `vfio_pci_config_rw` (defined in `/linux/drivers/vfio/pci/vfio_pci_config.c:1678`)
        2. `vfio_pci_bar_rw` (defined in `/linux/drivers/vfio/pci/vfio_pci_rdwr.c:116`)
        3. `vfio_pci_vga_rw` (defined in `/linux/drivers/vfio/pci/vfio_pci_rdwr.c:183`)

        in terms of the index passed to the function.

        For GPU, `vfio_pci_rw()` is mostly called with the index 7 (=`VFIO_PCI_CONFIG_REGION_INDEX`) and 8 (=`VFIO_PCI_VGA_REGION_INDEX`). Small number of calls are done with index 0 (=`VFIO_PCI_BAR0_REGION_INDEX`). Note that each index can be found in `/linux/include/uapi/linux/vfio.h:418`.
    - After a VM starts execution, it communicates with a PCI device via QEMU (`vfio_pci_read_config()` and `vfio_pci_write_config()`) and KVM VFIO device driver (`vfio_pci_rw()`).

## References
- Alex Williamson. *An Introduction to PCI Device Assignment with VFIO*. [\[Online\]](http://events.linuxfoundation.org/sites/events/files/slides/An%20Introduction%20to%20PCI%20Device%20Assignment%20with%20VFIO%20-%20Williamson%20-%202016-08-30_0.pdf). Aug 2016.
- Alex Williamson. *VFIO: PCI device assignment breaks free of KVM*. [\[Online\]](http://www.linux-kvm.org/images/d/d1/2011-forum-VFIO.pdf). 2011.
