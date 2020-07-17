---
layout: post
title: Introduction to Fedora Silverblue
date: 2020-07-15 12:35
category: 
author: Insu Jang
tags: ["linux", "study"]
summary: 
---

# Fedora Silverblue

![silverblue](https://docs.fedoraproject.org/en-US/fedora-silverblue/_images/silverblue-logo.svg)

Fedora Silverblue [^silverblue] is an *immutable* desktop operating system based on Fedora Linux distribution.
What *immutable* does mean is that most directories including rootfs (/) are mounted as read-only, and user applications run in an isolated execution environment.
It is a part of Atomic Host project, and share the same underlying system with Fedora CoreOS (FCOS).

For this purpose, Fedora Silverblue adopted two technologies:

1. libostree (OSTree)
2. Flatpak

# `libostree` [^ostree]

libostree (previously called OSTree) provides git-like model for managing bootable filesystem trees (binaries), along with for deploying them and managing the bootloader configuration.
By using libostree, a filesystem commit (image) can be used to boot Linux, making it easy to upgrade, rollback, and manage the filesystem.
To make it feasible, the filesystem is required to be always clean (without users' configurations, etc); hence most directories are mounted as read-only.

However, according to Linux Filesystem Hierarchy Standard (FHS) [^fhs], toe rootfs must have:

- `/bin`: essential command binaries
- `/boot`: static files of the boot loader
- `/dev`: device files
- `/etc`: host-specific system configuration
- `/lib`: essential shared libraries and kernel modules
- `/media`: mount point for removable media
- `/mnt`: mount point for mounting a filesystem temporarily
- `/opt`: add-oin application software packages
- `/run`: data relevant to running processes
- `/sbin`: essential system binary
- `/srv`: data for services provided by this system
- `/tmp`: temporary files
- `/usr`: secondary hierarchy
- `/var`: variable data
- `/bome`: user home directories (optional)
- `/lib<qual>`: alternate format essential shared libraries (e.g. `/lib64`, optional)
- `/root`: home directory for the root user (optional)

some of which can be modified by legacy packages (deb, rpm).
To satisfy the FHS while keep the rootfs clean, Fedora Silverblue makes symbolic links for writable directories, such as `/home` to `/var/home`.

In Fedora Silverblue, the filesystem is immutable and *stateless*, and all runtime state is written and stored in `/var`:
- `/home` -> `/var/home`
- `/opt` -> `/var/opt`
- `/root` -> `/var/roothome`
- `/usr/local` -> `/var/usrlocal`
- `/mnt` -> `/var/mnt`
- `/tmp` -> `/sysroot/tmp`

and so on.


This approach (making the rootfs read-only) is not new; Android [^androidfs], ChromeOS [^chromeosfs] have also been deployed with read-only rootfs.
They also uses Linux as their base system, however, Fedora Silverblue is one of the first Linux distributions that provides Linux desktop environment with read-only rootfs (another one is EndlessOS).

Note that Fedora Silverblue uses `rpm-ostree`, a modified version of libostree, but in this post I will say the fundamental properties of libostree only.

## Mouting the specified rootfs image by libostree

So, how libostree mounts the rootfs read-only when booting the Linux kernel? libostree's customized initramfs parses kernel command line arguments `ostree=`, and mounts the specified rootfs image to the rootfs.

You can find the current kernel command line argument by `rpm-ostree`:

```sh
$ rpm-ostree kargs
resume=/dev/mapper/fedora-swap rd.lvm.lv=fedora/root rd.lvm.lv=fedora/swap rhgb quiet root=/dev/mapper/fedora-root ostree=/ostree/boot.0/fedora/<image-commit-id>/0
```

The way libostree mounts the specified path into `/` is well documented in [^ostree-initramfs]:

- Parse the `ostree=` kernel command line argument in the initramfs
- Set up a read-only bind mount on `/usr`
- Bind mount the deployment's `/sysroot` to the physical `/`
- Use `mount(MS_MOVE)` to make the deployment root appear to be the root filesystem

With the result `rpm-ostree kargs` above, the root (`root=`) is `/dev/mapper/fedora-root`, the physical `/` of which will be mounted as `/sysroot` by initramfs.
Currently `/` is initramfs, and not mounted by actual device filesystem yet (step 1).

An then, initramfs uses `ostree=` argument to find actual path for rootfs from the device (in my case, `/ostree/boot.0/fedora/<image-commit-id>/0`, at this moment it can be accessed as `/sysroot/ostree/boot.0/fedora/<image-commit-id>/0`) and bind mounts it to the logical `/` (step 3).

The result is as follows (note that `/ostree/boot.0/fedora/<image-commit-id>/0` is a symbolic link to `/ostree/deploy/fedora/deploy/<image-commit-id>/0`).

```shell
$ findmnt
TARGET                        SOURCE                                                         FSTYPE          OPTIONS
/                             /dev/mapper/fedora-root[/ostree/deploy/fedora/deploy/<image-commit-id>.0]
│                                                                                            ext4            rw,relatime,seclabel
├─/sys                        sysfs                                                          sysfs           rw,nosuid,nodev,noexec,relatime,seclabel
...
├─/tmp                        tmpfs                                                          tmpfs           rw,nosuid,nodev,seclabel
├─/sysroot                    /dev/mapper/fedora-root                                        ext4            rw,relatime,seclabel
├─/usr                        /dev/mapper/fedora-root[/ostree/deploy/fedora/deploy/<image-commit-id>.0/usr]
│                                                                                            ext4            ro,relatime,seclabel
├─/var                        /dev/mapper/fedora-root[/ostree/deploy/fedora/var]             ext4            rw,relatime,seclabel
│ ├─/var/home                 /dev/mapper/fedora-home                                        ext4            rw,relatime,seclabel
│ └─/var/lib/nfs/rpc_pipefs   sunrpc                                                         rpc_pipefs      rw,relatime
...
```

It is executed by `ostree/src/switchroot/ostree-prepare-root.c` [[src](https://github.com/ostreedev/ostree/blob/master/src/switchroot/ostree-prepare-root.c)]:

```c
/* -*- c-file-style: "gnu" -*-
 * Switch to new root directory and start init.
 *
 * Copyright 2011,2012,2013 Colin Walters <walters@verbum.org>
 *
 * Based on code from util-linux/sys-utils/switch_root.c,
 * Copyright 2002-2009 Red Hat, Inc.  All rights reserved.
 * Authors:
 *  Peter Jones <pjones@redhat.com>
 *  Jeremy Katz <katzj@redhat.com>
 *
 * Relicensed with permission to LGPLv2+.
 *
 * SPDX-License-Identifier: LGPL-2.0+
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the
 * Free Software Foundation, Inc., 59 Temple Place - Suite 330,
 * Boston, MA 02111-1307, USA.
 */

int main(int argc, char *argv[]) {
  ...

  if (strcmp(root_mountpoint, "/") == 0) {
    /* pivot_root rotates two mount points around.  In this instance . (the
     * deploy location) becomes / and the existing / becomes /sysroot.  We
     * have to use pivot_root rather than mount --move in this instance
     * because our deploy location is mounted as a subdirectory of the real
     * sysroot, so moving sysroot would also move the deploy location.   In
     * reality attempting mount --move would fail with EBUSY. */
    if (pivot_root (".", "sysroot") < 0)
      err (EXIT_FAILURE, "failed to pivot_root to deployment");
  }
  else {
    /* In this instance typically we have our ready made-up up root at
     * /sysroot/ostree/deploy/.../ (deploy_path) and the real rootfs at
     * /sysroot (root_mountpoint).  We want to end up with our made-up root at
     * /sysroot/ and the real rootfs under /sysroot/sysroot as systemd will be
     * responsible for moving /sysroot to /.
     *
     * We need to do this in 3 moves to avoid trying to move /sysroot under
     * itself:
     *
     * 1. /sysroot/ostree/deploy/... -> /sysroot.tmp
     * 2. /sysroot -> /sysroot.tmp/sysroot
     * 3. /sysroot.tmp -> /sysroot
     */
    if (mkdir ("/sysroot.tmp", 0755) < 0)
      err (EXIT_FAILURE, "couldn't create temporary sysroot /sysroot.tmp");

    if (mount (deploy_path, "/sysroot.tmp", NULL, MS_MOVE, NULL) < 0)
      err (EXIT_FAILURE, "failed to MS_MOVE '%s' to '/sysroot.tmp'", deploy_path);

    if (mount (root_mountpoint, "sysroot", NULL, MS_MOVE, NULL) < 0)
      err (EXIT_FAILURE, "failed to MS_MOVE '%s' to 'sysroot'", root_mountpoint);

    if (mount (".", root_mountpoint, NULL, MS_MOVE, NULL) < 0)
      err (EXIT_FAILURE, "failed to MS_MOVE %s to %s", deploy_path, root_mountpoint);

    if (rmdir ("/sysroot.tmp") < 0)
      err (EXIT_FAILURE, "couldn't remove temporary sysroot /sysroot.tmp");
  }

  ...

  if (running_as_pid1) {
    execl ("/sbin/init", "/sbin/init", NULL);
    err (EXIT_FAILURE, "failed to exec init inside ostree");
  }
  else {
    exit (EXIT_SUCCESS);
  }
}
```

which is in ostree initramfs [[src](https://github.com/ostreedev/ostree/blob/master/src/boot/mkinitcpio/ostree)]:
```sh
#!/bin/bash

build() {
    add_binary /usr/lib/ostree/ostree-prepare-root
    add_binary /usr/lib/ostree/ostree-remount

    add_file /usr/lib/systemd/system/ostree-prepare-root.service
    add_symlink /usr/lib/systemd/system/initrd-switch-root.target.wants/ostree-prepare-root.service \
        /usr/lib/systemd/system/ostree-prepare-root.service
}
```

and ostree-prepare-root is executed by systemd and logged in journal:

```sh
$ jorunalctl
...
Jul 08 03:57:29 localhost systemd[1]: Starting dracut pre-mount hook...
Jul 08 03:57:29 localhost kernel: audit: type=1130 audit(1594195049.283:10): pid=1 uid=0 auid=4294967295 ses=4294967295 subj=kernel msg='unit=dracut-initqueue comm="systemd" exe="/usr/lib/systemd/systemd" hostname=? addr=? terminal=? res=success'
Jul 08 03:57:29 localhost systemd[1]: Finished dracut pre-mount hook. 
Jul 08 03:57:29 localhost audit[1]: SERVICE_START pid=1 uid=0 auid=4294967295 ses=4294967295 subj=kernel msg='unit=dracut-pre-mount comm="systemd" exe="/usr/lib/systemd/systemd" hostname=? addr=? terminal=? res=success'
Jul 08 03:57:29 localhost systemd[1]: Starting File System Check on /dev/mapper/fedora-root...
Jul 08 03:57:29 localhost systemd-fsck[670]: /dev/mapper/fedora-root: clean, 199520/4587520 files, 2002583/18350080 blocks
Jul 08 03:57:29 localhost systemd[1]: Finished File System Check on /dev/mapper/fedora-root.
Jul 08 03:57:29 localhost audit[1]: SERVICE_START pid=1 uid=0 auid=4294967295 ses=4294967295 subj=kernel msg='unit=systemd-fsck-root comm="systemd" exe="/usr/lib/systemd/systemd" hostname=? addr=? terminal=? res=success'
Jul 08 03:57:29 localhost systemd[1]: Mounting /sysroot...
Jul 08 03:57:29 localhost systemd[1]: Mounted /sysroot.
Jul 08 03:57:29 localhost kernel: EXT4-fs (dm-0): mounted filesystem with ordered data mode. Opts: (null)
Jul 08 03:57:29 localhost systemd[1]: Starting OSTree Prepare OS/...
Jul 08 03:57:29 localhost ostree-prepare-root[676]: Resolved OSTree target to: /sysroot/ostree/deploy/fedora/deploy/b03f449af099faf5f6702e330d45b9b395cea3f286fe63e799d0a4dda9ce3e5d.0
Jul 08 03:57:29 localhost systemd[1]: sysroot-ostree-deploy-fedora-deploy-b03f449af099faf5f6702e330d45b9b395cea3f286fe63e799d0a4dda9ce3e5d.0-usr.mount: Succeeded.
Jul 08 03:57:29 localhost systemd[1]: sysroot-ostree-deploy-fedora-deploy-b03f449af099faf5f6702e330d45b9b395cea3f286fe63e799d0a4dda9ce3e5d.0.mount: Succeeded.
Jul 08 03:57:29 localhost systemd[1]: Finished OSTree Prepare OS/.
Jul 08 03:57:29 localhost audit[1]: SERVICE_START pid=1 uid=0 auid=4294967295 ses=4294967295 subj=kernel msg='unit=ostree-prepare-root comm="systemd" exe="/usr/lib/systemd/systemd" hostname=? addr=? terminal=? res=success'
Jul 08 03:57:29 localhost systemd[1]: Reached target Initrd Root File System.
Jul 08 03:57:29 localhost systemd[1]: Starting Reload Configuration from the Real Root...
Jul 08 03:57:29 localhost systemd[1]: Reloading.
```

## Making the rootfs read-only by libostree

OK. now we know that how libostree mounts the specified rootfs image into real `/`. But, although the document says the root is mouted read-only, actual mount result shows it is mounted writable:

```sh
$ findmnt
TARGET                        SOURCE                                                         FSTYPE          OPTIONS
/                             /dev/mapper/fedora-root[/ostree/deploy/fedora/deploy/<image-commit-id>.0]
│                                                                                            ext4            rw,relatime,seclabel
...
```

But, I am not able to write any content in `/`. What happened?

At first, I thought it is controlled by SELinux, since Fedora Silverblue enables SELinux by default.

```sh
$ seenforce 0
$ sestatus
SELinux status:                 enabled
SELinuxfs mount:                /sys/fs/selinux
SELinux root directory:         /etc/selinux
Loaded policy name:             targeted
Current mode:                   permissive   <----
Mode from config file:          enforcing
Policy MLS status:              enabled
Policy deny_unknown status:     allowed
Memory protection checking:     actual (secure)
Max kernel policy version:      32
```

But have no luck. No audit log appended in `/var/log/audit/audit.log` as well (even with `semodule -DB`; `-D` indicates ignoring `dontaudit` flag).

Instead, I found a hint from issues in ostree repository:
[https://github.com/ostreedev/ostree/issues/1265](https://github.com/ostreedev/ostree/issues/1265) -> 
[https://github.com/coreos/coreos-assembler/pull/736](https://github.com/coreos/coreos-assembler/pull/736)

the latter of which is mentioned in [[the pull request]](https://github.com/coreos/coreos-assembler/pull/737):

> cgwalters commented on Sep 5, 2019
>
> Add the immutable bit to the physical root; we don't
> expect people to be creating anything there. A use case for
> OSTree in general is to support installing inside the existing
> root of a deployed OS, so OSTree doesn't do this by default, but
> we have no reason not to enable it here. Administrators should
> generally expect that state data is in /etc and /var; if anything
> else is in /sysroot it's probably by accident.
> 
> I just happened to think of this while working on
> #736

that contains a commit to add a line into the script creating a coreos disk:

```sh
# Finally, add the immutable bit to the physical root; we don't
# expect people to be creating anything there.  A use case for
# OSTree in general is to support installing *inside* the existing
# root of a deployed OS, so OSTree doesn't do this by default, but
# we have no reason not to enable it here.  Administrators should
# generally expect that state data is in /etc and /var; if anything
# else is in /sysroot it's probably by accident.
chattr +i rootfs
```

> chattr - change file attributes on a Linux file system
>
> attributes
>
> ...
>
> i: A file with the 'i' attributes cannot be modified: it cannot be deleted or renamed, no link can be created to this file, most of the file's metadata can not be modified, and the file can not be opened in write mode. Only the superuser or a process possessing the CAP_LINUX_IMMUTABLE capability can set or clear this attribute.

Here I got a hint: they use the immutable bit of Linux extended (ext2) filesystem feature.
To prove whether it solely protects the rootfs, I check whether the flag is set.
As the source of `/` is `/ostree/deploy/fedora/deploy<image-commit-id>`,

```sh
$ lsattr /ostree/deploy/fedora/deploy
----i---------e----- /ostree/deploy/fedora/deploy/<image-commit-id>
--------------e----- /ostree/deploy/fedora/deploy/<image-commit-id>.origin
```

Got it! the rootfs directory is set the **immutable bit**.
Now I check whether I, as the root user, have `CAP_LINUX_IMMUTABLE` capability:

```sh
$ capsh --print
Current: = cap_chown,...,cap_linux_immutable,...
Bounding set = cap_chown,...,cap_linux_immutable,...
```

Great, it seems I am able to clear the bit. Let's erase it and try to write a new file on rootfs.

```sh
$ chattr -i <image-commit-id>
$ lsattr /ostree/deploy/fedora/deploy
--------------e----- /ostree/deploy/fedora/deploy/<image-commit-id>
$ echo "hello!" > /test
$ cat /test
hello!
```

Everything works as expected. Therefore, Fedora Silverblue depends on Linux ext filesystem flag for rootfs write protection.

Funny thing is that, after writing a file at `/` and setting the immutable bit back on, you cannot remove the `/test` file either.

I now understand the immutable flag works for rootfs write protection, however, I not do not know at which point the immutable flag is set.
Maybe libostree downloads the OS image with the enabled bit, since there is no code for setting the immutable bit for rootfs in [rpm-ostree](https://github.com/coreos/rpm-ostree) repository.


# Flatpak [^flatpak]

Flatpak is a modern linux app packaging framework.
Legacy Linux package frameworks (e.g. dpkg, yum, dnf) shares and depends on shared libraries installed on the host system.
This has prohibited Linux application developers from using more recent version of libraries due to possible limited compatibility.

![ubuntu_core_with_snap](/assets/images/200715/canonical_ubuntucore16_diagram.jpg)

Recent packaging systems (e.g. AppImage, Flatpak, snapcraft) packages packs required libraries with the application binary itself altogether into an image, running it in an isolated execution environment without any dependencies in the host (A good example of isolated execution environment is Linux container, but it seems not the only option, as Flatpak does not always use Linux containers).

Fedora Silverblue, by default, runs Flatpak applications, and does not provide rpm and dnf package management system in the host.
Note that Fedora Silverblue provides some ways to bridge the gap between traditional Linux and Fedora Silverblue; Toolbox and `rpm-ostree`, but I will not explain about these in this post.

Although they should be isolated from the host environment, they still require services provided by the host, e.g., accessing devices, rendering graphics, sound, printers, etc.
Considering container based isolation, they are not provided by default.

Flatpak provides [Portals](https://docs.flatpak.org/en/latest/basic-concepts.html#portals), an interface that the process can interact with the host.
It contains opening URIs, printing, showing notifications, power management, etc.
For applications that does not packed with Flatpak framework many run in the isolated execution but cannot use these features.

[^silverblue]: [Fedora Silverblue](https://docs.fedoraproject.org/en-US/fedora-silverblue/)
[^fhs]: [Linux Filesystem Hierarchy Standard (FHS)](https://refspecs.linuxfoundation.org/fhs.shtml)
[^ostree]: [libostree](https://ostree.readthedocs.io/en/latest/)
[^androidfs]: [Android Partition Layout](https://source.android.com/devices/bootloader/system-as-root)
[^chromeosfs]: [ChromiumOS Developer Mode: Making Changes to the Filesystem](https://chromium.googlesource.com/chromiumos/docs/+/master/developer_mode.md#disable-verity)
[^ostree-initramfs]: [Adapting existing mainstream distributions: Booting and initramfs technology](https://ostree.readthedocs.io/en/latest/manual/adapting-existing/#booting-and-initramfs-technology)
[^flatpak]: [Flatpak: The Future of Apps On Linux](https://flatpak.org/)