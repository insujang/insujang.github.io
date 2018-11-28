---
layout: post
title: "udev: Device Manager for the Linux Kernel in Userspace"
date: "2018-11-27 10:05:14 +0900"
author: "Insu Jang"
tags: [research, linux]
---

## What is udev?
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

## Why was udev developed?
`/dev` directory is where all device files for the system are loaded (note that everything in Linux is files, so are devices).
This directory had been managed by `devfs` filesystem until Linux kernel version 2.5.
The introduction of `devfs` solved some problem, however, still many problems remained. For those problems, please refer to Section 2 in [the paper](https://landley.net/kdocs/ols/2003/ols2003-pages-249-257.pdf).

udev was started to solve all of those problems, and its goals are:
- Run in userspace (doing so we save kernel memory space that was wasted by saving device naming rules),
- Create a dynamic `/dev` (automatically creates or removes device entries in `/dev` when devices are inserted or removed),
- Provide consistent device naming (e.g. `eth0` -> `enp2s0`), and
- Provide a userspace API to access info about current system devices.

## udev Internals
### kobject_uevent
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

### libudev and kobject_uevent message groups
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


### Example case: USB device hotplugged

![udev summary](/assets/images/181127/udev_summary.png){: .center-image width="700px"}

A very simple operation flow of udev device notification is as above.
The uevent that udevd receives from the kernel driver is actually a `GROUP_KERNEL` message,
and the notification to userspace programs in the box `/lib/udev programs or others` is done through a `GROUP_UDEV` message.

So let us take a look one by one.

#### Identifying the device
![USB subsystem in Linux](/assets/images/181127/usb_subsystem_linux.png){: .center-image}
[\[source\]](https://opensourceforu.com/2011/10/usb-drivers-in-linux-1/)

When a USB device is inserted to system, the very first initialization function to be started is `drivers/usb/core/usb.c:usb_init()`, written in [\[here\]](https://www.technovelty.org/linux/what-actually-happens-when-you-plug-in-a-usb-device.html).
The USB root hub driver (i.e. hcd) initiates the USB device initialization, the USB core takes the control and initializes an actual device structure `struct usb_device`.

```c
linux/include/linux/usb.h

struct usb_device {
  int devnum;
  char devpath[16];
  ...
  struct usb_device *parent;
  struct usb_bus *bus;
  struct usb_host_endpoint ep0;

  struct device dev;
  ...
};
```
Then the USB core registers the usb device with `device_register(&usb_device->dev)` function.

```c
int device_register(struct device *dev)
{
  device_initialize(dev);
  return device_add(dev);
}
```
The bus-specific fields of the `usb_device` structure are initialized by the USB core (e.g. devnum respresents an address on a USB bus) in `device_initialize()` call.
During handling `device_add()`, the kernel adds the kobject of the `usb_device` structure (at this time of the registration the usb device is shown in the `sysfs` directory [\[sysfs\]](https://www.win.tue.nl/~aeb/linux/lk/lk-13.html), which will be used by udevd), and the kernel emits `KOBJECT_UEVENT` messages with kernel message group.

```c
linux/drivers/base/core.c: device_add()

int device_add(struct device *dev)
{
  dev = get_device(dev);

  ...

  /* first, register with generic layer. */
  /* we require the name to be set before, and pass NULL */
  error = kobject_add(&dev->kobj, dev->kobj.parent, NULL);
  error = device_create_file(dev, &dev_attr_uevent);
  if (error)
    goto attrError;

  ...

  error = device_add_class_symlinks(dev);
  if (error)
    goto SymlinkError;
  error = device_add_attrs(dev);
  if (error)
    goto AttrsError;
  error = bus_add_device(dev);
  if (error)
    goto BusError;
  error = dpm_sysfs_add(dev);
  if (error)
    goto DPMError;
  device_pm_add(dev);

  ...

  kobject_uevent(&dev->kobj, KOBJ_ADD);

  ...
}
```

`kobject_uevent()` function is:

```c
linux/lib/kobject_uevent.c

/**
 * kobject_uevent - notify userspace by sending an uevent
 *
 * @kobj: struct kobject that the action is happening to
 * @action: action that is happening
 *
 * Returns 0 if kobject_uevent() is completed with success or the
 * corresponding error when it fails.
 */
int kobject_uevent(struct kobject *kobj, enum kobject_action action)
{
  return kobject_uevent_env(kobj, action, NULL);
}

/**
 * kobject_uevent_env - send an uevent with environmental data
 *
 * @kobj: struct kobject that the action is happening to
 * @action: action that is happening
 * @envp_ext: pointer to environmental data
 *
 * Returns 0 if kobject_uevent_env() is completed with success or the
 * corresponding error when it fails.
 */
int kobject_uevent_env(struct kobject *kobj, enum kobject_action action, char *envp_ext[])
{
  ...

  /* default keys */
  retval = add_uevent_var(env, "ACTION=%s", action_string);
  if (retval)
    goto exit;
  retval = add_uevent_var(env, "DEVPATH=%s", devpath);
  if (retval)
    goto exit;
  retval = add_uevent_var(env, "SUBSYSTEM=%s", subsystem);
  if (retval)
    goto exit;

  ...

  /* keys passed in from the caller */
  if (envp_ext) {
    for (i = 0; envp_ext[i]; i++) {
      retval = add_uevent_var(env, "%s", envp_ext[i]);
      if (retval)
        goto exit;
    }
  }

  retval = kobject_uevent_net_broadcast(kobj, env, action_string, devpath);
}

static int kobject_uevent_net_broadcast(struct kobject *kobj,
          struct kobj_uevent_env *env,
          const char *action_string,
          const char *devpath)
{
  ...

  /* kobjects currently only carry network namespace tags and they
   * are the only tag relevant here since we want to decide which
   * network namespaces to broadcast the uevent into.
   */
  if (ops && ops->netlink_ns && kobj->ktype->namespace)
    if (ops->type == KOBJ_NS_TYPE_NET)
      net = kobj->ktype->namespace(kobj);

  if (!net)
    ret = uevent_net_broadcast_untagged(env, action_string,
                devpath);
  else
    ret = uevent_net_broadcast_tagged(net->uevent_sock->sk, env,
              action_string, devpath);

  ...
}
```

The final destination should be `netlink_broadcast()`, which is callbed by `uevent_net_broadcast_(un)tagged()` function.

```c
static int uevent_net_broadcast_untagged(struct kobj_uevent_env *env,
           const char *action_string,
           const char *devpath)
{
  ...

  /* send netlink message */
  list_for_each_entry(ue_sk, &uevent_sock_list, list) {
    struct sock *uevent_sock = ue_sk->sk;

    ...

    retval = netlink_broadcast(uevent_sock, skb_get(skb), 0, 1,
             GFP_KERNEL);

    ...
  }

  ...
}
```

According to the signature of `netlink_broadcast()` function, 0 is portid and 1 is group number: equivalent to the value of `GROUP_KERNEL` in libudev library.

```c
linux/net/netlink/af_netlink.c

int netlink_broadcast(struct sock *ssk, struct sk_buff *skb, u32 portid, u32 group, gfp_t allocation)
```

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

In summary, the kernel function call trace for sending `GROUP_KERNEL` udev message to udevd is as follows:
```
device_register()
device_add()
kobject_uevent()
kobject_uevent_env()
kobject_uevent_net_broadcast()
uevent_net_broadcast_untagged()
netlink_broadcast()
```

### References
- [udev: An Introduction To Linux's udev](https://www.iredale.net/p/by-title/introduction-to-udev/udev-introduction-latest.pdf)
- [udev - A Userspace Implementation of devfs](https://landley.net/kdocs/ols/2003/ols2003-pages-249-257.pdf)
- [Hotplugging with udev](https://bootlin.com/doc/legacy/udev/udev.pdf)
- [uevent init and operation (Korean)](http://egloos.zum.com/furmuwon/v/11024590)
- [Device & Driver -1- (Basic) (Korean)](http://jake.dothome.co.kr/device-driver-1/)
- [리눅스 USB 호스트 컨트롤러 드라이버에 대해서 (Korean)](http://hajesoft.co.kr/archives/37445)
- [What actually happens when you plug in a USB device?](https://www.technovelty.org/linux/what-actually-happens-when-you-plug-in-a-usb-device.html)
