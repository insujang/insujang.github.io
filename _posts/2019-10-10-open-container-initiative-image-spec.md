---
layout: post
title: Open Container Initiative (OCI) Standard, Image Spec
date: 2019-10-10 20:35
category: 
author: Insu Jang
tags: [linux, research]
---

The Open Container Initiative (OCI) standard is an open standard for Linux containers. As born in 2013, [Docker](https://www.docker.com) has been a de-facto standard of Linux container framework, but the OCI standard was born for a need of open standard, based on the Docker manifest.
As the standard is based on Docker manifest, its specifications and structures are very similar to Dockers', enabling providing compatibilities between Docker and OCI-based container frameworks.

The official website says it contains two specifications (the Image Spec and the Runtime Spec), however, its Github repository actually contains three specification: [the Image Spec](https://github.com/opencontainers/image-spec), [the Runtime Spec](https://github.com/opencontainers/runtime-spec), and [the Distribution Spec](https://github.com/opencontainers/distribution-spec). That may be because that distribution is currently out of scope on the OCI Scope Table [\[link\]](https://github.com/opencontainers/image-spec#faq).

# Image Spec

The OCI Image Spec is based on [Docker Image Manifest Version 2.2](https://cloud.google.com/container-registry/docs/image-formats). The architecture is very similar; hence docker images are convertible to the corresponding OCI image by using [skopeo utility](https://github.com/containers/skopeo).

![skopeo copy](/assets/images/191010/skopeo_copy.png){: width="800px"}
*The OCI image layout of [the Debian image from Docker Hub](https://hub.docker.com/_/debian).*

The OCI image consists of:

- `blobs/sha256`: this directory contains information about image manifests and image layers, and compressed layer archives.
- `index.json`: this JSON plaintext contains information about the list of image manifests.
- `oci-layout`: this JSON plaintext contains the version of OCI layout... To be honest, I do not know how to use it.

![debian_index](/assets/images/191010/debian_index.png){: width="800px"}
*The contents of `index.json` of Debian OCI image.*

`anntations:org.opencontainers.image.ref.name` usually represents a tag name [\[link\]](https://github.com/opencontainers/image-spec/blob/e562b04403929d582d449ae5386ff79dd7961a11/image-layout.md#indexjson-file).
Therefore, each OCI image directory can contain several image tags, all layers, manifests, configs of which are mixed in `blobs/sha256` directory.

![debian_blobs](/assets/images/191010/debian_blobs.png){: width="800px"}
*The contents of `debian/blobs/sha256` directory. As indicated there is a file named with the digest `sha256:0578...` from `index.json` file.*

![debian_config](/assets/images/191010/debian_config.png){: width="800px"}
*Contents of the image manifest `0578e4...`. It explicitly defines the name of image config and layers.* Those files are stored in the same directory with this manifest file.

As there is one tag in the image, contents of the directory `blobs/sha256` is quite simple.

![oci layout](/assets/images/191010/oci_layout.png){: width="800px"}
*Simple summarized diagram of OCI image directory layout.*

# Runtime Spec
The OCI Image Spec is much similar to Docker images. Similar to Docker framework, where a container needs to be created from an image, **a runtime bundle** should be generated from the OCI image.

Detailed explanations are out of this post, just leave a link about it.
There are several tools to unpack an OCI image and to generate an OCI runtime bundle.

- [umoci](https://github.com/openSUSE/umoci)
- [OCI image tool](https://github.com/opencontainers/image-tools)
- [runc](https://github.com/opencontainers/runc)

With `umoci` or `OCI image tool`, we can unpack an OCI image to make a OCI runtime. And then, we can run a container with `runc`.

![umoci_runc](/assets/images/191010/umoci_runc.png){: width="800px"}
*As the environment is already running in an unprivileged Docker container, running a new container inside the container is impossible due to the restricted permission. It is supposed to run normally, executing a new shell in a container.*

## References

- [Docker](https://www.docker.com)
- [OCI standard home](https://www.opencontainers.org)
- [The OCI image spec](https://github.com/opencontainers/image-spec)
- [The OCI runtime spec](https://github.com/opencontainers/runtime-spec)
- [The OCI distribution spec](https://github.com/opencontainers/distribution-spec)