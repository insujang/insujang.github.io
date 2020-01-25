---
layout: post
title: Building Mellanox OFED from source code
date: 2020-01-25 10:28
category: 
author: Insu Jang
tags: [study, linux, mellanox, rdma]
summary: 
---

Mellanox is a manufacturer of networking products based on **infiniband**, which in these days are used for Remote DMA (RDMA).
Though their documents are explained and managed well in their [\[website\]](https://www.mellanox.com),
I cannot find how to build an infiniband device driver from source code they provide.

Source code can be downloaded in [\[here\]](https://www.mellanox.com/products/infiniband-drivers/linux/mlnx_ofed).
Currently the latest version of MLNX_OFED is [4.7-3.2.9.0](http://www.mellanox.com/downloads/ofed/MLNX_OFED-4.7-3.2.9.0/MLNX_OFED_SRC-debian-4.7-3.2.9.0.tgz).

When you untar the archive, you can see `SOURCES` directory, which contains the following another archives.
```shell
~/MLNX_OFED_SRC-4.7-3.2.9.0/SOURCES$ ls
dapl_2.1.10mlnx.orig.tar.gz                              libvma_8.9.5.orig.tar.gz
ibacm_41mlnx1.orig.tar.gz                                mlnx-ethtool_5.1.orig.tar.gz
ibsim_0.7mlnx1.orig.tar.gz                               mlnx-iproute2_5.2.0.orig.tar.gz
ibutils_1.5.7.1.orig.tar.gz                              mlnx-nfsrdma_4.7.orig.tar.gz
infiniband-diags_5.4.0.MLNX20190908.5f40e4f.orig.tar.gz  mlnx-nvme_4.7.orig.tar.gz
iser_4.7.orig.tar.gz                                     mlnx-ofed-kernel_4.7.orig.tar.gz
isert_4.7.orig.tar.gz                                    mlnx-rdma-rxe_4.7.orig.tar.gz
kernel-mft_4.13.3.orig.tar.gz                            mpitests_3.2.20.orig.tar.gz
knem_1.1.3.90mlnx1.orig.tar.gz                           mstflint_4.13.0.orig.tar.gz
libdisni_1.9.orig.tar.gz                                 ofed-scripts_4.7.orig.tar.gz
libibcm_41mlnx1.orig.tar.gz                              openmpi_4.0.2rc3.orig.tar.gz
libibmad_5.4.0.MLNX20190423.1d917ae.orig.tar.gz          perftest_4.4.orig.tar.gz
libibumad_43.1.1.MLNX20190905.1080879.orig.tar.gz        rdma-core_47mlnx1.orig.tar.gz
libibverbs_41mlnx1.orig.tar.gz                           rshim_1.16.orig.tar.gz
libmlx4_41mlnx1.orig.tar.gz                              sockperf_3.6.orig.tar.gz
libmlx5_41mlnx1.orig.tar.gz                              srp_4.7.orig.tar.gz
librdmacm_41mlnx1.orig.tar.gz                            srptools_41mlnx1.orig.tar.gz
librxe_41mlnx1.orig.tar.gz                               ucx_1.7.0.orig.tar.gz
```

Seeing the automated `install.pl` script in the root directory, we can easily recognize that it does:

- copy (maybe backup? not sure) the archive into `/var/tmp`.
- untar the archive
- build a deb package using `/usr/bin/dpkg-buildpackage`.
- copy the deb package(s) into `/path/to/root/ofed/DEBS/<VERSION>/<architecture>`.
- install the package(s) using `/usr/bin/dpkg -i` after dkms module check (`/usr/bin/dpkg-deb`).

Automated install script output messages of `mlnx-ofed-kernel-utils` as an example.
Root directory of the ofed director is `/home/insujang/MLNX_OFED_SRC-4.7-3.2.9.0`, and the Linux distribution is Ubuntu 18.04 (messages should be different from Fedora, etc).
```
Building DEB for mlnx-ofed-kernel-utils-4.7 (mlnx-ofed-kernel)...
Running: cp /home/insujang/MLNX_OFED_SRC-4.7-3.2.9.0/SOURCES/mlnx-ofed-kernel_4.7.orig.tar.gz .
Running: tar xzf /home/insujang/MLNX_OFED_SRC-4.7-3.2.9.0/SOURCES/mlnx-ofed-kernel_4.7.orig.tar.gz
Running  /usr/bin/dpkg-buildpackage -us -uc
Running: cp ../*.deb /home/insujang/MLNX_OFED_SRC-4.7-3.2.9.0/DEBS/ubuntu18.04/x86_64/COMMON/
Installing mlnx-ofed-kernel-utils-4.7...
Running /usr/bin/dpkg -i --force-confnew --force-confmiss /home/insujang/MLNX_OFED_SRC-4.7-3.2.9.0/DEBS/ubuntu18.04/x86_64/COMMON/mlnx-ofed-kernel-utils_4.7-OFED.4.7.3.2.9.1.g457f064_amd64.deb
Running: /usr/bin/dpkg-deb -x /home/insujang/MLNX_OFED_SRC-4.7-3.2.9.0/DEBS/ubuntu18.04/x86_64/COMMON/mlnx-ofed-kernel-dkms_4.7-OFED.4.7.3.2.9.1.g457f064_all.deb /var/tmp/mlnx-ofed-kernel-dkms_module-check 2>/dev/null
is_module_in_deb: core is in /home/insujang/MLNX_OFED_SRC-4.7-3.2.9.0/DEBS/ubuntu18.04/x86_64/COMMON/mlnx-ofed-kernel-dkms_4.7-OFED.4.7.3.2.9.1.g457f064_all.deb
<omit duplicated>
Installing mlnx-ofed-kernel-dkms-4.7...
Running /usr/bin/dpkg -i --force-confnew --force-confmiss /home/insujang/MLNX_OFED_SRC-4.7-3.2.9.0/DEBS/ubuntu18.04/x86_64/COMMON/mlnx-ofed-kernel-dkms_4.7-OFED.4.7.3.2.9.1.g457f064_all.deb
```

So, we can modify the source code with manual debian package build for customization.

```
$ mkdir -p ~/Documents/mlnx-ofed-kernel
$ cp mlnx-ofed-kernel_4.7.orig.tar.gz ~/Documents/mlnx-ofed-kernel
$ tar xvf ~/Documents/mlnx-ofed-kernel/mlnx-ofed-kernel_4.7.orig.tar.gz # The root path of untared source code: ~/Documents/mlnx-ofed-kernel/mlnx-ofed-kernel-4.7
```

Add some modifications to the code. I added a simple `printk()` function call into `drivers/net/ethernet/mellanox/mlx5/core/main.c:static int __init init(void)`, the function that is called when the kernel module is loaded.
```c
drivers/net/ethernet/mellanox/mlx5/core/main.c
...
static int __init init(void)
{
    ...
    printk("Hello Mellanox World!");
    ...
    return 0;
}
...
```

When you try to build a deb package (`dpkg-buildpackage -us -uc`), it says:
```shell
dpkg-source: info: local changes detected, the modified files are:
 mlnx-ofed-kernel-4.7/drivers/net/ethernet/mellanox/mlx5/core/main.c
dpkg-source: info: you can integrate the local changes with dpkg-source --commit
dpkg-source: error: aborting due to unexpected upstream changes, see /tmp/mlnx-ofed-kernel_4.7-OFED.4.7.3.2.9.1.g457f064.diff.9Exitm
dpkg-buildpackage: error: dpkg-source -b mlnx-ofed-kernel-4.7 subprocess returned exit status 2
```

> `dpkg-buildpackage` is called in `~/Documents/mlnx-ofed-kernel/mlnx-ofed-kernel-4.7`, where the root directory of source code.

Commit the change:
```
$ dpkg-source --commit
dpkg-source: info: local changes detected, the modified files are:
 mlnx-ofed-kernel-4.7/drivers/net/ethernet/mellanox/mlx5/core/main.c
Enter the desired patch name: hello world

dpkg-source: info: local changes have been recorded in a new patch: mlnx-ofed-kernel-4.7/debian/patches/hello-world
```

Build again:
```
$ dpkg-buildpackage -us -uc
dpkg-buildpackage: info: source package mlnx-ofed-kernel
dpkg-buildpackage: info: source version 4.7-OFED.4.7.3.2.9.1.g457f064
dpkg-buildpackage: info: source distribution unstable
...
 dpkg-genbuildinfo
 dpkg-genchanges  >../mlnx-ofed-kernel_4.7-OFED.4.7.3.2.9.1.g457f064_amd64.changes
dpkg-genchanges: info: including full source code in upload
 dpkg-source --after-build mlnx-ofed-kernel-4.7
dpkg-buildpackage: info: full upload (original source is included)
```

Install the package:
```
$ sudo dpkg -i mlnx-ofed-kernel-dkms-4.7-OFED.4.7.3.2.9.1.g457f064_all.deb
...
depmod...

Backing up initrd.img-4.15.0-74-generic to /boot/initrd.img-4.15.0-74-generic.old-dkms
Making new initrd.img-4.15.0-74-generic
(If next boot fails, revert to initrd.img-4.15.0-74-generic.old-dkms image)
update-initramfs.........

DKMS: install completed.
```

Reload the kernel module.
```
$ sudo /etc/init.d/openibd restart
Unloading HCA driver:                                      [  OK  ]
Loading HCA driver and Access Layer:                       [  OK  ]
$ dmesg
...
[360770.261344] mlx5_core 0000:18:00.0: firmware version: 12.23.1020
[360770.261372] mlx5_core 0000:18:00.0: 63.008 Gb/s available PCIe bandwidth (8 GT/s x8 link)
[360772.410308] mlx5_core 0000:18:00.0: Port module event: module 0, Cable plugged
[360772.522253] mlx5_core 0000:18:00.0: mlx5_fw_tracer_start:776:(pid 9890): FWTracer: Ownership granted and active
[360773.379878] Hello Mellanox World!
[360773.384107] mlx5_ib: Mellanox Connect-IB Infiniband driver v4.7-3.2.9
[360773.791522] mlx5_core 0000:18:00.0: MLX5E: StrdRq(0) RqSz(1024) StrdSz(256) RxCqeCmprss(0)
```

Changed source code are applied in the kernel module: `mlx5_core`.