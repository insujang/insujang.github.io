---
layout: post
title: "Implementing a New Custom Netlink Family Protocol"
date: "2019-02-07 17:00:00 +0900"
author: "Insu Jang"
tags: [research, linux]
---

## Netlink Protocol

Netlink is a communication protocol between kernel and userspace.
Unlike `ioctl()`, netlink is based on socket, which enables notification from the kernel to userspace.
With `ioctl()`, the kernel can only send a response regarding to a user request.
With netlink socket, however, user processes can be blocked via blocking functions such as `recv()`
to receive any messages from the kernel.

```c
#include <asm/types.h>
#include <sys/socket.h>
#include <linux/netlink.h>

netlink_socket = socket (AF_NETLINK, socket_type, netlink_family);
```

There are some predefined famous netlink protocol family:
for instance, `NETLINK_ROUTE` for routing and link updates,
`NETLINK_KOBJECT_UEVENT` for device events, and so on.
Predefined family protocols merged into Linux mainline can be found in [netlink.h](https://elixir.bootlin.com/linux/latest/source/include/uapi/linux/netlink.h#L9).

Without the use of generic netlink protocol, the maximum number of unique protocol families is 32: (`#define MAX_LINKS 32`).
This is one of the main reasons that the generic netlink family was created.
In this post, we use the existing netlink protocol (not generic netlink protocol).
As there are 23 protocol families exist in the latest kernel, we can implement up to 9 custom protocol families (23~31) so far.

## Basic Implementation with Custom Netlink

### Kernel Module

The following is a basic kernel module that creates a custom netlink protocol family, the value of which is 25, using the kernel function `netlink_kernel_create()`.
Note that the signature of the function was changed since kernel version 2.6.
[\[link\]](https://elixir.bootlin.com/linux/latest/source/include/linux/netlink.h#L58)

```c
static inline struct sock *
netlink_kernel_create(struct net *net, int unit, struct netlink_kernel_cfg *cfg)
{
  return __netlink_kernel_create(net, unit, THIS_MODULE, cfg);
}
```

```c
#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/netlink.h>
#include <net/netlink.h>
#include <net/net_namespace.h>

#define NETLINK_TESTFAMILY 25

struct sock *socket;

static void test_nl_receive_message(struct sk_buff *skb) {
  printk(KERN_INFO "Entering: %s\n", __FUNCTION__);

  struct nlmsghdr *nlh = (struct nlmsghdr *) skb->data;
  printk(KERN_INFO "Received message: %s\n", (char*) nlmsg_data(nlh));
}

static int __init test_init(void) {
  struct netlink_kernel_cfg config = {
    .input = test_nl_receive_message,
  };

  socket = netlink_kernel_create(&init_net, NETLINK_TESTFAMILY, &config);
  if (socket < 0) {
    return -1;
  }

  return 0;
}

static void __exit test_exit(void) {
  if (socket) {
    netlink_kernel_release(socket);
  }
}

module_init(test_init);
module_exit(test_exit);
```

This creates a kernel module that listens netlink protocol family with the number 25.
When any process creates a netlink socket and send a message, `test_nl_receive_message()` will be called.
Note that netlink is aware of network namespace, so the first argument for the function `netlink_kernel_create()` is the pointer of a network namespace (type: `struct net *`).
Linux kernel, by default, has at least one network namespace: `init_net`.
You can use the variable for creation or your own network namespace variable.
Also note that since netlink is aware of network namespace, netlink multicast, by default, can only be received from within the specified network namespace.
For instance, if two network namespaces are available (namely initial netns and ns1), and the above kernel module sends a multicast message to the initial network namespace, every processes in the other network namespace ns1 will not receive the message.

### Userspace Program

The below code is a userspace program that can send and receive messages with the kernel
through `NETLINK_TESTFAMILY` family protocol.

```c
#include <linux/netlink.h>
#include <sys/socket.h>
#include <stdio.h>
#include <unistd.h>

#define NETLINK_TESTFAMILY 25
#define MAX_PAYLOAD 1024

int main(int argc, char *argv[]) {
  int fd = socket(AF_NETLINK, SOCK_RAW, NETLINK_TESTFAMILY);
  if (fd < 0) ...

  struct sockaddr_nl addr; memset(&addr, 0, sizeof(addr));
  addr.nl_family = AF_NETLINK;
  addr.nl_pid = 0;  // For Linux kernel
  addr.nl_groups = 0;

  struct nlmsghdr *nlh = (struct nlmsghdr *) malloc(NLMSG_SPACE(MAX_PAYLOAD));
  memset(nlh, 0, NLMSG_SPACE(MAX_PAYLOAD));
  nlh->nlmsg_len = NLMSG_SPACE(MAX_PAYLOAD);
  nlh->nlmsg_pid = getpid();
  nlh->nlmsg_flags = 0;
  strcpy((char *) NLMSG_DATA(nlh), "Hello");

  struct iovec iov;
  iov.iov_base = (void *) nlh;
  iov.iov_len = nlh->nlmsg_len;

  struct msghdr msg;
  msg.msg_name = (void *) &addr;
  msg.msg_namelen = sizeof(addr);
  msg.msg_iov = &iov;
  msg.msg_iovlen = 1;

  printf("Sending message to kernel\n");
  sendmsg(fd, &msg, 0);

  return 0;
}

```

When you execute the program, you should see the following message in your kernel message via `dmesg`:

```
Entering: test_nl_receive_message
Received message: Hello
```

### Unicast from Kernel Module

Let us make the kernel module send a response for a request.

```c
static void test_nl_receive_message(struct sk_buff *skb) {
  struct nlmsghdr *nlh = (struct nlmsghdr *) skb->data;
  pid_t pid = nlh->nlmsg_pid; // pid of the sending process

  char *message = "Hello from kernel unicast";
  size_t message_size = strlen(message) + 1;
  struct sk_buff *skb_out = nlmsg_new(message_size, GFP_KERNEL);
  if (!skb_out) {
    printk(KERN_ERR "Failed to allocate a new skb\n");
    return;
  }

  nlh = nlmsg_put(skb_out, 0, 0, NLMSG_DONE, message_size, 0);
  NETLINK_CB(skb_out).dst_group = 0;
  strncpy(nlmsg_data(nlh), message, message_size);

  int result = nlmsg_unicast(socket, skb_out, pid);
}
```

The userspace process will receive a netlink message with `NLMSG_DONE` type.
It seems that the newly created `struct sk_buffer` variable is deleted
when it is sent through `nlmsg_unicast()`, hence calling `nlmsg_unicast()`
contains the memory management [\[link\]](https://stackoverflow.com/a/10138935).
Therefore, calling `nlmsg_free()` is forbidden, otherwise a kernel panic would be occured.

### Multicast from Kernel Module

The kernel module can also send a multicast netlink message, a broadcast for a specific group in netlink family.

```c
#define NETLINK_MYGROUP 2

static void test_nl_send_user (void) {
  char *message = "Hello from kernel multicast";
  size_t message_size = strlen(message) + 1;

  struct sk_buffer *skb = nlmsg_new(NLMSG_ALIGN(message_size), GFP_KERNEL);
  if (!ksb) {
    printk(KERN_ERR "Failed to allocate a new skb\n");
    return;
  }

  struct nlmsghdr *nlh = nlmsg_put(skb, 0, 1, NLMSG_DONE, message_size, 0);
  strncpy(nlmsg_data(nlh), message, message_size);

  int result = nlmsg_multicast(socket, skb, 0, NETLINK_MYGROUP, GFP_KERNEL);
}
```
