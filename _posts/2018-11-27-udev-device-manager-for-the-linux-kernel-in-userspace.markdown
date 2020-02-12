---
layout: post
title: "udev: Device Manager for the Linux Kernel in Userspace"
date: "2018-11-27 10:05:14 +0900"
author: "Insu Jang"
tags: [research, linux]
---

# What is udev?
> udev (userspace /dev) is a device manager for the Linux kernel.
As the successor of devfsd and hotplug, udev primaily manages device nodes in the /dev directory.
At the same time, udev also handls all user space events
raised when hardware devices are added into the system or removed from it,
including firmware loading as reuqired by certain devices.
>
> [https://en.wikipedia.org/wiki/Udev](https://en.wikipedia.org/wiki/Udev)

udev first appeared at Linux kernel version 2.5, and merged into the Linux mainline with version 2.6.
udev was developed by [Greg Kroah-Hartman](https://en.wikipedia.org/wiki/Greg_Kroah-Hartman) and [Kay Sievers](https://en.wikipedia.org/wiki/Kay_Sievers), for the purpose of replacing devfs (device file system).
Greg Kroah-Hartman published **[the paper](https://landley.net/kdocs/ols/2003/ols2003-pages-249-257.pdf)** regarding to udev,
which is worth reading.

# Why was udev developed?
`/dev` directory is where all device files for the system are loaded (note that everything in Linux is files, so are devices).
This directory had been managed by `devfs` filesystem until Linux kernel version 2.5.
The introduction of `devfs` solved some problem, however, still many problems remained. For those problems, please refer to Section 2 in [the paper](https://landley.net/kdocs/ols/2003/ols2003-pages-249-257.pdf).

udev was started to solve all of those problems, and its goals are:
- Run in userspace (doing so we save kernel memory space that was wasted by saving device naming rules),
- Create a dynamic `/dev` (automatically creates or removes device entries in `/dev` when devices are inserted or removed),
- Provide consistent device naming (e.g. `eth0` -> `enp2s0`), and
- Provide a userspace API to access info about current system devices.

# udev Internals
## kobject_uevent
Though udev runs in userspace, it is highly entangled with the Linux kernel.
The first entry that recognizes device insertion/deletion events is surely the Linux kernel.
While there were no mechanisms for the Linux kernel to *push notifications* to userspace processes
(with `ioctl()` the kernel can only provide responses for the corresponding requests from userspace processes),
**netlink IPC mechanism** emerged and currently it is available for the kernel to send a notification first.

The family protocol for udev is `kobject_uevent`.
Currently, udev is a part of systemd, therefore it uses systemd's socket protocol:

<pre>
/lib/systemd/system/systemd-udevd-kernel.socket

[Unit]
Description=udev Kernel Socket
...

[Socket]
Service=systemd-udevd.service
ReceiveBuffers=128M
<b>ListenNetlink=kobject-uevent 1</b>
...
</pre>

```c
systemd/src/udev/udevd.c: static int listen_fds(int* ret_ctrl, int* ret_netlink) {
  ...
  n = sd_listen_fds(true);
  if (sd_is_socket(fd, AF_NETLINK, SOCK_RAW, -1) > 0) {
    if (netlink_fd >= 0)
            return -EINVAL;
    netlink_fd = fd;
    continue;
  }
  ...
}
```

which are equivalent to the following standalone code:

```c
#include <linux/netlink.h>
#include <sys/socket>
int netlink_fd = socket(AF_NETLINK, SOCK_RAW, NETLINK_KOBJECT_UEVENT);
```

The messages sent from the kernel look like as follows.
Except the netlink header explained in [here (Section 3.1)](https://people.redhat.com/nhorman/papers/netlink.pdf),
the body of netlink packets is just a plain string. [\[Source\]](https://stackoverflow.com/questions/22803469/uevent-sent-from-kernel-to-user-space-udev)
```
"add@/class/input/input9/mouse2\0    // message
ACTION=add\0                         // action type
DEVPATH=/class/input/input9/mouse2\0 // path in /sys
SUBSYSTEM=input\0                    // subsystem (class)
SEQNUM=1064\0                        // sequence number
PHYSDEVPATH=/devices/pci0000:00/0000:00:1d.1/usb2/2­2/2­2:1.0\0  // device path in /sys
PHYSDEVBUS=usb\0       // bus
PHYSDEVDRIVER=usbhid\0 // driver
MAJOR=13\0             // major number
MINOR=34\0",           // minor number
```

## libudev and kobject_uevent message groups
We should note that the other userspace processes except udevd **must not** receive netlink messages from the kernel directly
by using the above netlink socket.
Then how our program can receive device notification? The answer is `libudev`.
udevd, once the device initialization is finished, broadcasts device ready notification to all the other userspace processes.
`libudev` also uses netlink socket, but only for the internal usage.

There is an important difference between two netlink sockets that udevd and libudev use.
`NETLINK_KOBJECT_UEVENT` seems to have two different multicast groups: `GROUP_KERNEL` and `GROUP_UDEV`, namely kernel message group and udev message group, respectively.

```c
systemd/src/libsystemd/sd-device/device-monitor-private.h

typedef enum MonitorNetlinkGroup {
  MONITOR_GROUP_NONE,
  MONITOR_GROUP_KERNEL,
  MONITOR_GROUP_UDEV,
  _MONITOR_NETLINK_GROUP_MAX,
  _MONITOR_NETLINK_GROUP_INVALID = -1,
} MonitorNetlinkGroup;
```

`GROUP_KERNEL` is the message group **sent to udevd to command the device initialization**, and `GROUP_UDEV` is the message group **after the udevd finishes the device initialization**.
Therefore, `GROUP_KERNEL` is used only by udevd, and `GROUP_UDEV` is used by libudev and all the other processes waiting for the device notifications from udevd.

Both message groups are sent from the kernel to user space, the actual origin of the message group `GROUP_UDEV` is udevd, not the kernel.
Although [netlink](http://man7.org/linux/man-pages/man7/netlink.7.html) is the IPC mechanism between the kernel and the userspace processes, it can also be used to communicate between two userspace processes, if we have a bit of code in the kernel for the support [\[cite\]](https://stackoverflow.com/a/44274783).


## Example case: USB device hotplugged

![udev summary](/assets/images/181127/udev_summary.png){: .center-image width="700px"}

A very simple operation flow of udev device notification is as above.
The uevent that udevd receives from the kernel driver is actually a `GROUP_KERNEL` message,
and the notification to userspace programs in the box `/lib/udev programs or others` is done through a `GROUP_UDEV` message.

Each message is analyzed in:

- [\[GROUP_KERNEL kernel function call flow\]](/2018-11-28/udev-function-flow-for-kobjectuevent-kernel-group-message/)
- [\[GROUP_UDEV function call flow\]](/#)

# References
- [udev: An Introduction To Linux's udev](https://www.iredale.net/p/by-title/introduction-to-udev/udev-introduction-latest.pdf)
- [udev - A Userspace Implementation of devfs](https://landley.net/kdocs/ols/2003/ols2003-pages-249-257.pdf)
- [Hotplugging with udev](https://bootlin.com/doc/legacy/udev/udev.pdf)
- [uevent init and operation (Korean)](http://egloos.zum.com/furmuwon/v/11024590)
- [Device & Driver -1- (Basic) (Korean)](http://jake.dothome.co.kr/device-driver-1/)
- [리눅스 USB 호스트 컨트롤러 드라이버에 대해서 (Korean)](http://hajesoft.co.kr/archives/37445)
- [What actually happens when you plug in a USB device?](https://www.technovelty.org/linux/what-actually-happens-when-you-plug-in-a-usb-device.html)
