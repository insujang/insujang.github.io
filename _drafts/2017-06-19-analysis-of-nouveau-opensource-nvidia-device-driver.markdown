---
layout: post
title: "Analysis of Nouveau: Open-source NVIDIA Device Driver"
date: "2017-06-19 15:53:13 +0900"
author: "Insu Jang"
tag: [research, cuda]
---

1. `nouveau_devobj_ctor`

    `/nouveau/core/engine/device/base.c`

    Called when device is initialized. (not Nouveau intiailization)

    ```
    static int
    nouveau_devobj_ctor(struct nouveau_object *parent,
                struct nouveau_object *engine,
                struct nouveau_oclass *oclass, void *data, u32 size,
                struct nouveau_object **pobject)
    {
        struct nouveau_client *client = nv_client(parent);
        struct nouveau_device *device;
        struct nouveau_devobj *devobj;
        struct nv_device_class *args = data;
        u32 boot0, strap;
        u64 disable, mmio_base, mmio_size;
        void __iomem *map;
        int ret, i, c;

        if (size < sizeof(struct nv_device_class))
            return -EINVAL;

        /* find the device subdev that matches what the client requested */
        device = nv_device(client->device);
        if (args->device != ~0) {
            device = nouveau_device_find(args->device);
            if (!device)
                return -ENODEV;
        }

        ret = nouveau_parent_create(parent, nv_object(device), oclass, 0,
                        nouveau_control_oclass,
                        (1ULL << NVDEV_ENGINE_DMAOBJ) |
                        (1ULL << NVDEV_ENGINE_FIFO) |
                        (1ULL << NVDEV_ENGINE_DISP) |
                        (1ULL << NVDEV_ENGINE_PERFMON), &devobj);
        *pobject = nv_object(devobj);
        if (ret)
            return ret;

        mmio_base = nv_device_resource_start(device, 0);
        mmio_size = nv_device_resource_len(device, 0);

        printk("%s: mmio base: 0x%lx, mmio size: 0x%lx\n",
                __func__, mmio_base, mmio_size);

        /* translate api disable mask into internal mapping */
        disable = args->debug0;
        for (i = 0; i < NVDEV_SUBDEV_NR; i++) {
            if (args->disable & disable_map[i])
                disable |= (1ULL << i);
        }
        /* identify the chipset, and determine classes of subdev/engines */
        if (!(args->disable & NV_DEVICE_DISABLE_IDENTIFY) &&
            !device->card_type) {
            map = ioremap(mmio_base, 0x102000);
            if (map == NULL)
                return -ENOMEM;

            printk("%s: mapping mmio_base. addr: 0x%lx, size: 0x102000\n",
                    __func__, mmio_base);

            /* switch mmio to cpu's native endianness */
    #ifndef __BIG_ENDIAN
            if (ioread32_native(map + 0x000004) != 0x00000000)
    #else
            if (ioread32_native(map + 0x000004) == 0x00000000)
    #endif
                iowrite32_native(0x01000001, map + 0x000004);

            /* read boot0 and strapping information */
            boot0 = ioread32_native(map + 0x000000);
            strap = ioread32_native(map + 0x101000);
            iounmap(map);

            /* determine chipset and derive architecture from it */
            ...

            nv_info(device, "BOOT0  : 0x%08x\n", boot0);
            nv_info(device, "Chipset: %s (NV%02X)\n",
                device->cname, device->chipset);
            nv_info(device, "Family : NV%02X\n", device->card_type);

            /* determine frequency of timing crystal */
            ...

            nv_debug(device, "crystal freq: %dKHz\n", device->crystal);
        }
        if (!(args->disable & NV_DEVICE_DISABLE_MMIO) &&
            !nv_subdev(device)->mmio) {
            nv_subdev(device)->mmio  = ioremap(mmio_base, mmio_size);

            if (!nv_subdev(device)->mmio) {
                nv_error(device, "unable to map device registers\n");
                return -ENOMEM;
            }
        }

        /* ensure requested subsystems are available for use */
        for (i = 1, c = 1; i < NVDEV_SUBDEV_NR; i++) {
            if (!(oclass = device->oclass[i]) || (disable & (1ULL << i)))
                continue;

            if (device->subdev[i]) {
                nouveau_object_ref(device->subdev[i],
                          &devobj->subdev[i]);
                continue;
            }

            ret = nouveau_object_ctor(nv_object(device), NULL,
                          oclass, NULL, i,
                          &devobj->subdev[i]);
            if (ret == -ENODEV)
                continue;
            if (ret)
                return ret;

            device->subdev[i] = devobj->subdev[i];

            /* note: can't init *any* subdevs until devinit has been run
             * due to not knowing exactly what the vbios init tables will
             * mess with.  devinit also can't be run until all of its
             * dependencies have been created.
             *
             * this code delays init of any subdev until all of devinit's
             * dependencies have been created, and then initialises each
             * subdev in turn as they're created.
             */
            while (i >= NVDEV_SUBDEV_DEVINIT_LAST && c <= i) {
                struct nouveau_object *subdev = devobj->subdev[c++];
                if (subdev && !nv_iclass(subdev, NV_ENGINE_CLASS)) {
                    ret = nouveau_object_inc(subdev);
                    if (ret)
                        return ret;
                    atomic_dec(&nv_object(device)->usecount);
                } else
                if (subdev) {
                    nouveau_subdev_reset(subdev);
                }
            }
        }

        return 0;
    }

    ```

    dmesg result. These messages are from `nv_info()` function call.

    ```
    [18728.215670] nouveau  [  DEVICE][0000:01:00.0] BOOT0  : 0x0c8000a1
    [18728.215672] nouveau  [  DEVICE][0000:01:00.0] Chipset: GF110 (NVC8)
    [18728.215673] nouveau  [  DEVICE][0000:01:00.0] Family : NVC0
    ```

    Some intiialization done in this function:

    1. Initialize a device data structure (struct nouveau_device) via calling `nv_device()`.
    2. Create a nouveau parent? via calling `nouveau_parent_create()`.
    3. Read boot0 and strapping information by **temporarily mapping BAR0. mmio_base is initialized with the physical address of BAR0.**

        ```
        mmio_base = nv_device_resource_start(device, 0);    // 0 means return BAR0 base address.
        mmio_size = nv_device_resource_len(device, 0);      // 0 means return BAR0 length.
        printk("%s: mmio base: 0x%lx, mmio size: 0x%lx\n", __func__, mmio_base, mmio_size);

        ...
        map = ioremap(mmio_base, 0x102000);
        ...

        if (ioread32_native(map + 0x000004) == 0x00000000)
            iowrite32_native(0x01000001, map + 0x000004);

        boot0 = ioread32_native(map, 0x000000);
        strap = ioread32_native(map + 0x101000);
        iounmap(map);
        ```

        **Note that reading these values can be done in userspace, through accessing `mmap()`ed MMIO region.**

        ```
        ./pcimem /sys/bus/pci/devices/0000\:01\:00.0/resource0 0x0 w
        Target offset is 0x0, page size is 4096
        mmap(0, 4096, 0x3, 0x1, 3, 0x0)
        PCI Memory mapped to address 0x7f3d3e739000.
        Value at offset 0x0 (0x7f3d3e739000): 0xC8000A1
        ```
        Target value is boot0, and the value is same with the dmesg result.

    4. **Create a MMIO mapping into device's sub device.**

        ```
        if (!(args->disable & NV_DEVICE_DISABLE_MMIO) &&
            !nv_subdev(device)->mmio) {
            nv_subdev(device)->mmio = ioremap(mmio_base, mmio_size);
            ...
        }
        ```
    5. Initialize all subsystems.

        ```
        for (i = 1; c = 1; i < NVDEV_SUBDEV_NR; i++) {


            if (device->subdev[i]) {
                nouveau_object_ref(device->subdev[i], &devobj->subdev[i]);
                continue;
            }

            ret = nouveau_object_ctor(nv_object(device), NULL, oclass, NULL, &devobj->subdev[i]);
            ...
            device->subdev[i] = devobj->subdev[i];
            while (i >= NVDEV_SUBDEV_DEVINIT_LAST && c <= i) {
                struct nouveau_object *subdev = devobj->subdev[c++];
                if (subdev && !nv_iclass(subdev, NV_ENGINE_CLASS)) {
                    ret = nouveau_object_inc(subdev);
                }
                else if (subdev) {
                    nouveau_subdev_reset(subdev);
                }
            }
        }
        ```

        subdevices are VBIOS, PMC, PFB, VOLT, PTERM, ... (subdevices are in `/nouveau/core/subdev` and `/nouveau/core/core/subdev.c`)

2. `nouveau_fifo_channel_create_`

    Defined in `/nouveau/core/engine/fifo/base.c`. The key function for GPU channel creation.

    ```
    int
    nouveau_fifo_channel_create_(struct nouveau_object *parent,
                     struct nouveau_object *engine,
                     struct nouveau_oclass *oclass,
                     int bar, u32 addr, u32 size, u32 pushbuf,
                     u64 engmask, int len, void **ptr)
    {
        struct nouveau_device *device = nv_device(engine);
        struct nouveau_fifo *priv = (void *)engine;
        struct nouveau_fifo_chan *chan;
        struct nouveau_dmaeng *dmaeng;
        unsigned long flags;
        int ret;

        /* create base object class */
        ret = nouveau_namedb_create_(parent, engine, oclass, 0, NULL,
                         engmask, len, ptr);
        chan = *ptr;
        if (ret)
            return ret;

        /* validate dma object representing push buffer */
        chan->pushdma = (void *)nouveau_handle_ref(parent, pushbuf);
        if (!chan->pushdma)
            return -ENOENT;

        dmaeng = (void *)chan->pushdma->base.engine;
        switch (chan->pushdma->base.oclass->handle) {
        case NV_DMA_FROM_MEMORY_CLASS:
        case NV_DMA_IN_MEMORY_CLASS:
            break;
        default:
            return -EINVAL;
        }  

        ret = dmaeng->bind(dmaeng, parent, chan->pushdma, &chan->pushgpu);
        if (ret)
            return ret;

        /* find a free fifo channel */
        spin_lock_irqsave(&priv->lock, flags);
        for (chan->chid = priv->min; chan->chid < priv->max; chan->chid++) {
            if (!priv->channel[chan->chid]) {
                priv->channel[chan->chid] = nv_object(chan);
                break;
            }
        }
        spin_unlock_irqrestore(&priv->lock, flags);

        if (chan->chid == priv->max) {
            nv_error(priv, "no free channels\n");
            return -ENOSPC;
        }

        /* map fifo control registers */
        chan->user = ioremap(nv_device_resource_start(device, bar) + addr +
                     (chan->chid * size), size);
        if (!chan->user)
            return -EFAULT;

        nouveau_event_trigger(priv->cevent, 1, 0);

        chan->size = size;

        return 0;
    }
    ```

    It find a free channel, and **maps the physical address to it**. Target physical address: BAR1 + addr (=0) + channel ID * 0x1000. For example, the first channel has channel ID 2, hence target physical address will be 0xe8002000 (BAR1 physical address = 0xe8000000).

    This channel is saved in **ptr**, which is a double void pointer.
