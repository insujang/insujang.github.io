---
layout: post
title: "udev: Device Passthrough into Containers"
date: "2018-11-28 14:33:32 +0900"
author: "Insu Jang"
tags: [research, linux]
---

This post analyzes the relationship between udev and lxc device passthrough.

## LXC device passthrough

In LXC, the command `lxc-device --name=NAME -- add|del DEV` is used to dynamically passthrough the device `DEV` to a container with the name `NAME`.
`lxc-device` is contained in [\[lxc source code\]](https://github.com/lxc/lxc/blob/master/src/lxc/tools/lxc_device.c).
Simply, it uses functions defined in `lxc/src/lxc/lxccontainer.c`, which liblxc also uses.

```c
lxc/src/lxc/tools/lxc_device.c

int main(int argc, char *argv[])
{
  ...

  if (strncmp(cmd, "add", strlen(cmd)) == 0) {
    if (is_interface(dev_name, 1))
      ret = c->attach_interface(c, dev_name, dst_name);
    else
      ret = c->add_device_node(c, dev_name, dst_name);
  }

  ...
}
```

Two functions are defined as
```c
lxc/src/lxc/lxccontainer.c

struct lxc_container *lxc_container_new(const char*name, const char *configpath)
{
  ...

  /* Assign the member functions. */
  ...
  c->add_device_node = lxcapi_add_device_node;
  c->attach_interface = lxcapi_attach_interface;
  ...
}
```
If the given device is a network interface, `lxcapi_attach_interface()` is used, otherwise `lxcapi_add_device_node()` is used.

`lxcapi_add_device_node()` actually calls a static function `add_remove_device_node()`.
```c
lxc/src/lxc/lxccontainer.c

static bool add_remove_device_node(struct lxc_container *c, const char *src_path, const char *dest_path, bool add)
{
  ...

  /* use src_path if dest_path is NULL otherwise use dest_path */
  p = dest_path ? dest_path : src_path;

  /* make sure we can access p */
  if(access(p, F_OK) < 0 || stat(p, &st) < 0)
    return false;

  if (!do_add_remove_node(do_lxcapi_init_pid(c), p, add, &st))
    return false;

  /* add or remove device to/from cgroup access list */
  if (add) {
    if (!do_lxcapi_set_cgroup_item(c, "devices.allow", value)) {
      ERROR("set_cgroup_item failed while adding the device node");
      return false;
    }
  }
  ...
}

static bool do_add_remove_node(pid_t init_pid, const char *path, bool add, struct stat *st)
{
  /* prepare the path */
  snprintf(chrootpath, PATH_MAX, "/proc/%d/root", init_pid);
  chroot(chrootpath);
  chdir("/");

  /* remove path if it exists */
  ret = faccessat(AT_FDCWD, path, F_OK, AT_SYMLINK_NOFOLLOW);
  if (ret == 0) {
    unlink(path);
    ...
  }

  /* create any missing directores */
  ...

  /* create the device node */
  mknod(path, st->st_mode, st->st_rdev);
  ...
}
```

So adding the device into a container does
1. change the root path into the container by using the container's init PID
2. remove the device if it already exists
3. create a device node by calling `mknod()` system call.

<!--
```
lxc.config

lxc.cgroup.devices.allow = c ?:* rw
```

```
lxc/src/lxc/lxccontainer.c

static bool add_remove_device_node(struct lxc_container *c, const char *src_path, const char *dest_path, bool add)
```
-->

## mknod() and kernel device management

What the kernel actually does when `lxc-device` calls `mknod()` system call?

Actually, udev does nothing for `mknod()` system calls.
Device nodes that are created though `mknod()` system calls are just special devide node files,
and the actual connection between the device node and the device is evaluated when userspace processes open the device node via `open()`.

[http://jake.dothome.co.kr/devtmpfs/](http://jake.dothome.co.kr/devtmpfs/)
[http://jake.dothome.co.kr/kobject/](http://jake.dothome.co.kr/kobject/)

A device node with its major number and minor number is created when the device driver is loaded, finally through `vfs_mknod()` kernel function.
