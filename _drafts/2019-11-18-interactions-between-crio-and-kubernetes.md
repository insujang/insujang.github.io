---
layout: post
title: Interactions between cri-o and Kubernetes
date: 2019-11-18 23:07
category: 
author: "Insu Jang"
tags: [kubernetes, research]
summary: 
---

# cri-o

![crio](https://cri-o.io/logo/crio-logo.svg)

[cri-o](https://cri-o.io) is a lightweight container runtime framework for Kubernetes.
After introducing Open Container Initiative (OCI) container standard, Red Hat implemented cri-o to support the OCI standard and optimize performances by getting rid of unuseful features from Docker for Kubernetes; hence it is lightweight and *for Kubernetes*.

![crio-architecture](https://cri-o.io/assets/images/architecture.png){: width="1000px"}
*cri-o Archituecture. It manages containers under the supervison of Kubelet, a node agent of Kubernetes.*

Okay... What are noticable differences from Docker?

## conmon: Container Monitor

> Each container is monitored by a separate `conmon` process. The conmon process holds the pty of the PID1 of the container process. It handles logging for the container and records the exit code for the container process.
>
> *cri-o architectural components explanation.*

Why this is a strength of cri-o? In Docker, `dockerd` itself manages all of its containers and handles loggings for the containers. dockerd captures all outputs from the standard output streams (`stdout` and `stderr`) of the containers with Docker log drivers.

It seems to be efficient as one `dockerd` process handles all container's logs, however, it also does mean that it can occur **single point failure**. When `dockerd` is terminated, the standard output streams of the containers are *blocked*, which might put containers in a critical state.

> Though Docker provides non-blocking log message delivery mode, default mode is blocked mode [\[link\]](https://docs.docker.com/config/containers/logging/configure/).

For this reason, when `dockerd` receives a `SIGTERM` signal, it explicitly terminates all of its containers before terminating itself. This is default, where Docker also provides an alternative `live-restore` option, however, it is not recommended to keep containers alive during downtime [\[link\]](https://docs.docker.com/config/containers/live-restore/).

If logging is not responsible for a centralized container runtime daemon, the problem can be solved. `conmon` is the answer of cri-o team as a solution.

cri-o executes `conmon`, which creates a container process by using runc or Kata container (whatever low level container runtime). `stdout` and `stderr` streams of the container process are connected to `conmon`, where one `conmon` is launched per container, and are handled by it. Therefore, even during the downtime of cri-o daemon, conmon safely handles containers' logs.

[\[source\]](https://github.com/cri-o/cri-o/blob/2ce5b4b07a81f85bb59dc28148f2a38507bf3648/internal/oci/runtime_oci.go#L76)
```
func (r *runtimeOCI) CreateContainer(c *Container, cgroupParent string) (err error) {
  ...
  cmd := exec.Command(r.config.Conmon, args...)
  ...
  err = cmd.Start()
  ...

```