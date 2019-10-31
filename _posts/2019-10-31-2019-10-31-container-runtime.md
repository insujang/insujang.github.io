---
layout: post
title: Container Runtime
date: 2019-10-31 21:36
category: 
author: Insu Jang
tags: [container, research]
summary: 
---

From Docker to Kubernetes, these days container solutions are emerging.

![docker](/assets/images/191031/docker.png){: .center-image width="1000px"}
*Why Docker? source: [https://www.docker.com](https://www.docker.com/products/container-runtime). They clear state that Docker is a Container Runtime.*

In the era of Docker the term "Container runtime" was quite clear; **the software that runs and manages containers**.
but as the internal architecture is being complicated and various container frameworks are introduced, this definition becomes unclear.

Here are very clear explanations what is container runtime exactly, written by [Ian Lewis](https://www.ianlewis.org):

- [Container Runtimes Part 1: An Introduction to Container Runtimes](https://www.ianlewis.org/en/container-runtimes-part-1-introduction-container-r)
- [Container Runtimes Part 2: Anatomy of a Low-Level Container Runtime](https://www.ianlewis.org/en/container-runtimes-part-2-anatomy-low-level-contai)
- [Container Runtimes Part 3: High-Level Runtimes](https://www.ianlewis.org/en/container-runtimes-part-3-high-level-runtimes)
- [Container Runtimes Part 4: Kubernetes Container Runtimes & CRI](https://www.ianlewis.org/en/container-runtimes-part-4-kubernetes-container-run)

Remaining parts of this post is a summary of those four posts and supplements for better understanding.

## Why the definition becomes unclear?

Here is a quote from Part 1.

> When you run a Docker container, these are the steps Docker actually goes through:
> 1. Download the image
> 2. Unpack the image into a "bundle". This flattens the layers into a single filesystem.
> 3. Run the container from the bundle
>
> What docker standardized was only #3. Until that was clarified, **everyone thought of a container runtime as supporting all of the features Docker supported.**
> Eventually, Docker folks clarified that the original spec stated that **only the running the container part that made up the runtime.**
> This is a disconnect that continues even today, and makes "container runtimes" such a confusing topic.
>
> *Container Runtimes Part 1: An Introduction to Container Runtime*

![docker_sf](/assets/images/191031/docker_dockersfmeetup.jpg){: width="1000px"}
*Docker Internal Architecture since 1.11. Source: [Docker SF meetup 2016](https://www.slideshare.net/Docker/docker-111-docker-sf-meetup)*

"Disconnection" is like this:

Hmm. Okay. Following the revised definition, runc should be a container runtime, because it actually spwans and runs containers!

![docker](/assets/images/191031/docker.png){: width="800px"}
![containerd](/assets/images/191031/containerd.png){: width="800px"}
![runc](/assets/images/191031/runc.png){: width="800px"}

No it's not. So container runtime does *NOT* specify the framework that directly run containers.
Here comes definitions **low-level runtimes** and **high-level runtimes**.

> Some, like containerd and cri-o, actually use runc to run the container but implement image management and APIs on top.
> You can think of these features -- which include image transport, image management, image unpacking, and APIs -- as high-level features as compared to runc's low-level implementation.
>
> Each runtime covers different parts of this low-level to high-level spectrum.
>
> ![diagram](/assets/images/191031/runtimes.png){: .center-image width="700px"}
>
> Actual container runtimes that focus on just running containers are usually referred to as "low-level container runtimes".
> Low-level runtimes support using these operating system features\[namespaces and cgroups\].
>
> Runtimes that support more high-level features, like image management and gRPC/Web APIs, are usually referred to as "high-level container runtimes" or usually just "container runtimes".
>
> *Container Runtimes Part 1: An Introduction to Container Runtime*


For this reason, containerd or docker call themselves as just "container runtimes".
Therefore from figure Docker Internal Architecture,

- Docker Engine (dockerd) may be a (high-level) container runtime due to the existence of their drivers; storage driver, networking driver, etc. Honestly, I am not sure whether docker engine itself, without containerd, should be regarded as a container runtime.
- Containerd is a (high-level) container runtime, as it manages images and roles as a centralized daemon for container management.
- runc is a low-level container runtime, as it directly uses namespace and cgroups to create containers.

> runc was originally developed as part of Docker and was later extracted out as a separate tool and library.
>
> *Container Runtimes Part 2: Anatomy of a Low-Level Container Runtime*

![runtime_architecture](/assets/images/191031/runtime-architecture.png)
* A conceptual diagram how the components fit together. Source: Container Runtimes Part 3: High-Level Runtimes*

## CRI-O and Podman
This wonder actually comes from the relationship between Kubernetes and Podman; what is Podman? What are differences between Podman and CRI-O, which is a container runtime for Kubenetes?

![kubernetes](/assets/images/191031/kubernetes.png)
![podman](/assets/images/191031/podman.png)

The origin of Podman was CRI-O; a container runtime for Kubernetes. Kubenetes, at first, uses Docker as its container runtime and manages cluster nodes running Docker. As more runtimes users have requested to support in Kubernetes, the team implements an interface connecting Kubelet and container runtime; Container Runtime Interface (CRI). But Docker does not understand CRI calls, `dockershim`, a layer for CRI translation is added between kubelet and Docker.

First let's see how CRI-O is born for Kubernetes.

As Docker uses containerd for container management, Kubernetes started to use containerd directly for container management, with cri-containerd plugin.

![cri-containerd](/assets/images/191031/cri-containerd.png)
-----------------------------
![cri-containerd2](/assets/images/191031/cri-containerd2.png)
* Kubernetes Architecture changes. Communication hopes are reduced as architecture evolves. [\[image source\]](https://kubernetes.io/blog/2018/05/24/kubernetes-containerd-integration-goes-ga/)*

Now Red Hat created a new Kubernetes container runtime, cri-o, more tightly coupled with Kubernetes and CRI architecture: Leaving just as a plugin for containerd, cri-o directly manages containers and OCI-compatible images, and provides CRI interface as well.

![cri-o](/assets/images/191031/cri-o.png)
*[\[image source\]](https://www.hwchiu.com/kubernetes-runtime-crio.html)*

As CRI-O is tightly integrated with Kubernetes (Configuration files are generated by Kubelet, a node agent of Kubernetes and cannot run stand-alone), Red Hat extracts container and image management to another Container Runtime, [Podman](https://podman.io), in order to replace Docker itself. (Note that Kubernetes is a competitor of Docker-Swarm, as an orchestration tool, not Docker itself.)

A good not from Red Hat blog why they are implementing them seperately: [\[link\]](https://www.redhat.com/en/blog/why-red-hat-investing-cri-o-and-podman)

> We realized that the tooling for building and running Linux containers was only part of the picture.
> We needed to focus on **container orchestration** as well. We looked to find the best way to develop container tools for single hosts and in clusters, standardizing on Kubernetes.
>
> We heard from customers that small modular tools which **allowed for quicker experimentation and development of features like rootless were priorities**, and decided that investing in CRI-O and Podman were the best way to meet these needs for customers and the community.
>
> Red Hat decided to invest in Podman because it’s an easy change for anyone used to the Docker command line, but doesn’t require a daemon to be running when one isn’t needed.

Another blog post from Red Hat Openshift explains subtle differences: [\[link\]](https://blog.openshift.com/crictl-vs-podman/)

> This is not one or the other — these tools are complementary, and this article attempts to explain the tools and examine when it is best to use each of these tools.
>
> Podman is a tool designed for managing pods and containers without requiring a container daemon.
> **Podman does NOT speak CRI. It does not communicate directly with CRI-O.**  However Podman, like Buildah, shares the same backend datastores as CRI-O.
>
> Podman is fully independent of CRI-O but can manage CRI-O’s storage back end. Eventually it will be able to work fully with CRI-O data and be able to manage the content behind the scenes.

Although Podman and CRI-O share the same backend structures and definitions (such as Pod), they are complementary; for container runtime with Kubernetes (hence use CRI), use CRI-O. For stand-alone container runtime, use Podman.