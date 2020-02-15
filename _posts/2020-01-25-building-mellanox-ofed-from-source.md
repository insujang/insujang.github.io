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

# Building Mellanox OFED source code: inside install script

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

# Compiling modified code: using dpkg-buildpackage

So, we can modify the source code with manual debian package build for customization.

```
$ mkdir -p ~/Documents/mlnx-ofed-kernel
$ cp mlnx-ofed-kernel_4.7.orig.tar.gz ~/Documents/mlnx-ofed-kernel
$ tar xvf ~/Documents/mlnx-ofed-kernel/mlnx-ofed-kernel_4.7.orig.tar.gz # The root path of untared source code: ~/Documents/mlnx-ofed-kernel/mlnx-ofed-kernel-4.7
```

## Adding code
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

## building a package
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

## Installing a package
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

## Test
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

# Compiling modified code: using Makefile (libibverbs)

However, this work is too burdensome to test our customized code; commit the changes that might have bugs to test whether there is a bug.
Many components are userspace drivers, so we can just build it.

## Compiling with Makefile
For example, let us build `libibverbs`, a verb API library that we use for RDMA programming.
`libibverbs` adopted `autogen` system for cross-domain build.

```shell
$ cd libibverbs
$ ./autogen.sh
$ ./configure
$ make -j
```

the system will kindly introduce which packages are missing to build the library. After `make` command is done, the library will be built on `libibverbs/src/.libs` directory.

```shell
libibverbs/src/.libs$ $ ls -l
total 2704
-rw-rw-r-- 1 insujang insujang 1087330 Jan 29 13:55 libibverbs.a
lrwxrwxrwx 1 insujang insujang      16 Jan 29 13:55 libibverbs.la -> ../libibverbs.la
-rw-rw-r-- 1 insujang insujang     987 Jan 29 13:55 libibverbs.lai
lrwxrwxrwx 1 insujang insujang      19 Jan 29 13:55 libibverbs.so -> libibverbs.so.1.0.0
lrwxrwxrwx 1 insujang insujang      19 Jan 29 13:55 libibverbs.so.1 -> libibverbs.so.1.0.0
-rwxrwxr-x 1 insujang insujang  566096 Jan 29 13:55 libibverbs.so.1.0.0
...
```

Use `libibverbs.so` to build our test program. I personally use CMake, so adding the following code into CMakeLists.txt would be enough.
```cmake
include_directories(/home/insujang/libibverbs/include)
link_directories(/home/insujang/libibverbs/src/.libs)

add_executable(test_program ${SRCS})
target_link_libraries(test_program ibverbs)
```

> **[Feb 15, 2020 Update]** Or, you can use more modern way to import libraries [^1]:
>
> ```cmake
> add_library(ibverbs SHARED IMPORTED)
> set_target_properties(ibverbs PROPERTIES
>   IMPORTED_LOCATION /home/insujang/libibverbs/src/.libs/libibverbs.so
>   INTERFACE_INCLUDE_DIRECTORIES /home/insujang/libibverbs/include)
> 
> add_executable(test_program ${SRCS})
> target_link_libraries(test_program ibverbs)
> ```

## No userspace device-specific driver. How to fix it?
Are we done? Sadly no. When you launch a program, libibverbs prints warning messages and your program cannot find infiniband devices.

```
libibverbs: Warning: couldn't open config directory '/usr/local/etc/libibverbs.d'.
libibverbs: Warning: no userspace device-specific driver found for /sys/class/infiniband_verbs/uverbs1
libibverbs: Warning: no userspace device-specific driver found for /sys/class/infiniband_verbs/uverbs0
```

What is a difference between libraries installed with dpkg and manual compiled one? To investigate it, we recompile the test program using libraries that are installed by dpkg.
To see internal works, use `strace` to trace its system calls.

```shell
$ strace ./test_program
...
openat(AT_FDCWD, "/sys/class/infiniband_verbs/abi_version", O_RDONLY) = 3
read(3, "6\n", 8)                       = 2
close(3)                                = 0
geteuid()                               = 1003
prlimit64(0, RLIMIT_MEMLOCK, NULL, {rlim_cur=RLIM64_INFINITY, rlim_max=RLIM64_INFINITY}) = 0
openat(AT_FDCWD, "/etc/libibverbs.d", O_RDONLY|O_NONBLOCK|O_CLOEXEC|O_DIRECTORY) = 3               <-- here. The program with custom library finds `/usr/local/etc/libibverbs.d` at this point.
fstat(3, {st_mode=S_IFDIR|0755, st_size=4096, ...}) = 0
getdents(3, /* 5 entries */, 32768)     = 144
stat("/etc/libibverbs.d/.", {st_mode=S_IFDIR|0755, st_size=4096, ...}) = 0
stat("/etc/libibverbs.d/..", {st_mode=S_IFDIR|0755, st_size=4096, ...}) = 0
stat("/etc/libibverbs.d/rxe.driver", {st_mode=S_IFREG|0644, st_size=11, ...}) = 0
openat(AT_FDCWD, "/etc/libibverbs.d/rxe.driver", O_RDONLY) = 4
fstat(4, {st_mode=S_IFREG|0644, st_size=11, ...}) = 0
read(4, "driver rxe\n", 4096)           = 11
read(4, "", 4096)                       = 0
close(4)                                = 0
stat("/etc/libibverbs.d/mlx4.driver", {st_mode=S_IFREG|0644, st_size=35, ...}) = 0
openat(AT_FDCWD, "/etc/libibverbs.d/mlx4.driver", O_RDONLY) = 4
fstat(4, {st_mode=S_IFREG|0644, st_size=35, ...}) = 0
read(4, "driver /usr/lib/libibverbs/libml"..., 4096) = 35
read(4, "", 4096)                       = 0
close(4)                                = 0
stat("/etc/libibverbs.d/mlx5.driver", {st_mode=S_IFREG|0644, st_size=35, ...}) = 0
openat(AT_FDCWD, "/etc/libibverbs.d/mlx5.driver", O_RDONLY) = 4
fstat(4, {st_mode=S_IFREG|0644, st_size=35, ...}) = 0
read(4, "driver /usr/lib/libibverbs/libml"..., 4096) = 35
...
```

It reads `/etc/libibverbs.d`, instead of `/usr/lib/etc/libibverbs.d`. `/etc/libibverbs.d` contains the following files:
```shell
$ tree /etc/libibverbs.d/
/etc/libibverbs.d/
├── mlx4.driver
├── mlx5.driver
└── rxe.driver
```

As I use mlx5 device, let's see mlx5.driver file...
```shell
$ cat /etc/libibverbs/mlx5.driver
driver /usr/lib/libibverbs/libmlx5
```

`libibverbs` library should search its userspace driver in `/usr/lib/libverbs`, but the directory contains:
```shell
/usr/lib/libibverbs$ ls
libmlx4-rdmav2.so  libmlx5-rdmav2.so
```
Then it means that `libibverbs` library appends `-rdmav2.so` to the value of driver in `/etc/libibverbs/mlx5.driver`; `/etc/libibverbs/libmlx5-rdmav2.so`.
strace result also shows it load the file.
```shell
$ strace ./test_program
...
openat(AT_FDCWD, "/usr/lib/libibverbs/libmlx5-rdmav2.so", O_RDONLY|O_CLOEXEC) = 3             <-- here.
read(3, "\177ELF\2\1\1\0\0\0\0\0\0\0\0\0\3\0>\0\1\0\0\0\200W\0\0\0\0\0\0"..., 832) = 832
fstat(3, {st_mode=S_IFREG|0644, st_size=358712, ...}) = 0
mmap(NULL, 2453888, PROT_READ|PROT_EXEC, MAP_PRIVATE|MAP_DENYWRITE, 3, 0) = 0x7f248f566000
mprotect(0x7f248f5bc000, 2093056, PROT_NONE) = 0
mmap(0x7f248f7bb000, 12288, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_FIXED|MAP_DENYWRITE, 3, 0x55000) = 0x7f248f7bb000
...
```

Now we got what we have to do.

1. Copy `/etc/libibverb.d` into `/usr/local/etc/libibverbs.d`.
2. Modify `/usr/local/etc/libibverbs.d/mlx5.driver` to point your own libmlx5 library if needed.
  - I also build `libmlx5.so` which is stored in `/home/insujang/libmlx5/src/.libs`. I created a symbolic link named `libmlx5-rdmav2.so` (the name that `libibverbs` loads) at `/home/insujang`, linking to `/home/insujang/libmlx5/src/.libs/libmlx5.so.1.0.0`.
  - I modified `/usr/local/etc/libibverbs.d/mlx5.driver` to: `driver /home/insujang/libmlx5`.

The program should work.

[^1]: [[How do I add a library path in cmake? Stack Overflow](https://stackoverflow.com/a/28606916)