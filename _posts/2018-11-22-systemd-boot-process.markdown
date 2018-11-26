---
layout: post
title: "systemd Boot Process"
date: "2018-11-22 13:49:40 +0900"
author: "Insu Jang"
tags: [research, linux]
---

## What is systemd?
> systemd is a suite of basic building blocks for a Linux system. It provides a system and service manager that runs as PID 1 and starts the rest of the system.
>
> [https://www.freedesktop.org/wiki/Software/systemd](https://www.freedesktop.org/wiki/Software/systemd)

systemd is now the init process running as PID 1 as indicated above.
`/sbin/init` was the actual init process of Linux (also known as System V init boot system),
it is now replaced with `/usr/lib/systemd` in many Linux distributions.

After the kernel is initialized, it launches systemd process.
Detailed Linux boot process is described in [here](https://www.thegeekstuff.com/2011/02/linux-boot-process/).
This post only handles in-systemd details.

systemd provides parallelized boot, uses sockets and d-bus activation for starting services, offers on-demand daemon launch, etc.
We can easily attach our own daemons to systemd by creating service scripts in either `/lib/systemd/system` or `/etc/systemd/system` directories.
For the daemons to be automatically and normally launched, we need to acknowledge the systemd launch process, which this post will investigate more.

## systemd boot process in Linux

The following chart is a structural overview of well-known systemd units and their position in the boot-up logic,
according to freedesktop.
The chart comes from [here](https://www.freedesktop.org/software/systemd/man/bootup.html).
Should be clear to see in PC, or visit [here](https://linoxide.com/linux-how-to/systemd-boot-process/) to see it as an image in mobile.

```
local-fs-pre.target
         |
         v
(various mounts and   (various swap   (various cryptsetup
 fsck services...)     devices...)        devices...)       (various low-level   (various low-level
         |                  |                  |             services: udevd,     API VFS mounts:
         v                  v                  v             tmpfiles, random     mqueue, configfs,
  local-fs.target      swap.target     cryptsetup.target    seed, sysctl, ...)      debugfs, ...)
         |                  |                  |                    |                    |
         \__________________|_________________ | ___________________|____________________/
                                              \|/
                                               v
                                        sysinit.target
                                               |
          ____________________________________/|\________________________________________
         /                  |                  |                    |                    \
         |                  |                  |                    |                    |
         v                  v                  |                    v                    v
     (various           (various               |                (various          rescue.service
    timers...)          paths...)              |               sockets...)               |
         |                  |                  |                    |                    v
         v                  v                  |                    v              rescue.target
   timers.target      paths.target             |             sockets.target
         |                  |                  |                    |
         v                  \_________________ | ___________________/
                                              \|/
                                               v
                                         basic.target
                                               |
          ____________________________________/|                                 emergency.service
         /                  |                  |                                         |
         |                  |                  |                                         v
         v                  v                  v                                 emergency.target
     display-        (various system    (various system
 manager.service         services           services)
         |             required for            |
         |            graphical UIs)           v
         |                  |           multi-user.target
         |                  |                  |
         \_________________ | _________________/
                           \|/
                            v
                  graphical.target
```
The first target of systemd to be launched is `default.target`, which is typically a symbolically linked to `graphical.target` or `multi-user.target`
(depending on whether system is configured for a GUI or only a text console).
If you want to add your own system service into systemd hierarchy, it would be usally be added `multi-user.target`, like for example:
```
/etc/systemd/system/myservice.service

[Unit]
Description=My Service

[Service]
ExecStart=/usr/bin/echo 'Hello'

[Install]
WantedBy=multi-user.target
```

as illustrated in [freedesktop systemd.target manual](https://www.freedesktop.org/software/systemd/man/systemd.target.html).

`timers.target`, `paths.target`, and `sockets.target` are special targets for the initialization of timers, paths, and sockets, respectively.
These targets have default dependencies: target unites are automatically configured with:

- `After=sysinit.target`,
- `Requires=sysinit.target`,
- `Before=shutdown.target`,
- and `Conflicts=shutdown.target`.

Those default dependencies can be ignored with the following statement in the unit: `DefaultDependencies=no`.
For example, `udev.service` uses two sockets: `systemd-udevd-control.socket` and `systemd-udevd-kernel.socket`. In the chart above, `udev.service` should be initialized in the stage before `sysinit.target`.
Therefore, all `udev.service`, `systemd-udevd-control.socket`, and `systemd-udevd-kernel.socket` have `DefaultDependencies=no` statement to avoid those default dependencies.

<pre>
/lib/systemd/system/udev.service

[Unit]
Description=udev Kernel Device manager
Documentation=man:systemd-udevd.service(8) man:udev(7)
<b>Defaultdependencies=no</b>
Wants=systemd-udevd-control.socket systemd-udevd-kernel.socket
<b>After=systemd-udevd-control.socket systemd-udevd-kernel.socket systemd-sysusers.service</b>
Before=sysinit.target
...
</pre>

<pre>
/lib/systemd/system/systemd-udevd-control.socket

[Unit]
Description=udev Control Socket
Documentation=man:systemd-udevd.service(8) man:udev(7)
<b>DefaultDependencies=no</b>
Before=sockets.target
ConditionPathIsReadWrite=/sys

[Socket]
Service=systemd-udevd.service
ListenSequentialPacket=/run/udev/control    // Socket Path for FIFO UNIX domain socket
SocketMode=600
PassCredentials=yes
RemoveOnStop=yes
</pre>

There are [more special systemd units](https://www.freedesktop.org/software/systemd/man/systemd.special.html#),
such like `network.target` or `network-online.target`,
by default freedesktop does not show which position those targets sit in.

### References
- [bootup - System bootup process](https://www.freedesktop.org/software/systemd/man/bootup.html)
- [Systemd Boot Process a Close Look in Linux](https://linoxide.com/linux-how-to/systemd-boot-process/)
- [CREATING AND MODIFYING SYSTEMD UNIT FILES](https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/7/html/system_administrators_guide/sect-managing_services_with_systemd-unit_files)
- [systemd.special - Special systemd units](https://www.freedesktop.org/software/systemd/man/systemd.special.html)
