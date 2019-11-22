---
layout: post
title: Installing Kubernetes and cri-o in Debian
date: 2019-11-21 18:32
category: 
author: Insu Jang
tags: [kubernetes, linux]
summary: 
---

This post summarizes how to install cri-o container runtime and initialize a Kubernetes master node in Debian machine.
Tested with Debian 10 running on a VirtualBox VM.

```shell
root@kubernetesdebian:/etc# cat os-release 
PRETTY_NAME="Debian GNU/Linux 10 (buster)"
NAME="Debian GNU/Linux"
VERSION_ID="10"
VERSION="10 (buster)"
VERSION_CODENAME=buster
ID=debian
HOME_URL="https://www.debian.org/"
SUPPORT_URL="https://www.debian.org/support"
BUG_REPORT_URL="https://bugs.debian.org/"
```

# Installing cri-o

### 0. Prerequiste for using cri-o with Kubernetes

Kubernetes requires the following configurations be set before using cri-o container runtime [\[link\]](https://kubernetes.io/docs/setup/production-environment/container-runtimes/#cri-o):

```shell
modprobe overlay
modprobe br_netfilter

cat > /etc/sysctl.d/99-kubernetes-cri.conf <<EOF
net.bridge.bridge-nf-call-iptables  = 1
net.ipv4.ip_forward                 = 1
net.bridge.bridge-nf-call-ip6tables = 1
EOF

sysctl --system
```

### 1. Adding PPA

There are not cri-o related packages in default apt repository; we should add Project Atomic Personal Package Archives (PPA) [^1].
But you will show errors when using `add-apt-repository ppa:projectatomic/ppa`:

```shell
$ add-apt-repository ppa:projectatomic/ppa -y && apt update
gpg: keybox '/tmp/tmp51iyzqdm/pubring.gpg' created
gpg: /tmp/tmp51iyzqdm/trustdb.gpg: trustdb created
gpg: key 8BECF1637AD8C79D: public key "Launchpad PPA for Project Atomic" imported
gpg: Total number processed: 1
gpg:               imported: 1
gpg: no valid OpenPGP data found.
Hit:2 http://deb.debian.org/debian buster InRelease
Hit:3 http://security.debian.org/debian-security buster/updates InRelease
Hit:4 http://deb.debian.org/debian buster-updates InRelease
Hit:1 https://packages.cloud.google.com/apt kubernetes-xenial InRelease
Ign:5 http://ppa.launchpad.net/projectatomic/ppa/ubuntu focal InRelease
Err:6 http://ppa.launchpad.net/projectatomic/ppa/ubuntu focal Release
  404  Not Found [IP: 91.189.95.83 80]
Reading package lists... Done
E: The repository 'http://ppa.launchpad.net/projectatomic/ppa/ubuntu focal Release' does not have a Release file.
N: Updating from such a repository can't be done securely, and is therefore disabled by default.
N: See apt-secure(8) manpage for repository creation and user configuration details.
```

Instead, you should manually add a public key, and add apt repositories in `/etc/apt/sources.list`.

Create a source new file `/etc/apt/sources.list.d/projectatomics.list` as
```
deb http://ppa.launchpad.net/projectatomic/ppa/ubuntu bionic main
deb-src http://ppa.launchpad.net/projectatomic/ppa/ubuntu bionic main
```
*You can use any other Ubuntu distributions that ProjectAtomic supports. Currently, it supports Xenial (16.04), Bionic (18.04), Disco (19.04), and Eoan (19.10).*

You can see the following error when you type `apt update` after writing the source file:
```shell
...
Get:4 http://ppa.launchpad.net/projectatomic/ppa/ubuntu bionic InRelease [21.3 kB]
Err:4 http://ppa.launchpad.net/projectatomic/ppa/ubuntu bionic InRelease
  The following signatures couldn't be verified because the public key is not available: NO_PUBKEY 8BECF1637AD8C79D
Reading package lists... Done
W: GPG error: http://ppa.launchpad.net/projectatomic/ppa/ubuntu bionic InRelease: The following signatures couldn't be verified because the public key is not available: NO_PUBKEY 8BECF1637AD8C79D
E: The repository 'http://ppa.launchpad.net/projectatomic/ppa/ubuntu bionic InRelease' is not signed.
N: Updating from such a repository can't be done securely, and is therefore disabled by default.
N: See apt-secure(8) manpage for repository creation and user configuration details.
```

You can solve this problem by adding the public key as:
```shell
$ apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 8BECF1637AD8C79D
Executing: /tmp/apt-key-gpghome.3pmgjRnYte/gpg.1.sh --keyserver keyserver.ubuntu.com --recv-keys 8BECF1637AD8C79D
gpg: key 8BECF1637AD8C79D: public key "Launchpad PPA for Project Atomic" imported
gpg: Total number processed: 1
gpg:               imported: 1
$ apt update
Hit:1 http://security.debian.org/debian-security buster/updates InRelease
Hit:2 http://deb.debian.org/debian buster InRelease         
Hit:4 http://deb.debian.org/debian buster-updates InRelease
Get:5 http://ppa.launchpad.net/projectatomic/ppa/ubuntu bionic InRelease [21.3 kB]
Get:6 http://ppa.launchpad.net/projectatomic/ppa/ubuntu bionic/main Sources [3,916 B]
Get:7 http://ppa.launchpad.net/projectatomic/ppa/ubuntu bionic/main amd64 Packages [2,936 B]
Get:8 http://ppa.launchpad.net/projectatomic/ppa/ubuntu bionic/main Translation-en [1,496 B]
Fetched 29.6 kB in 3s (9,200 B/s)           
Reading package lists... Done
Building dependency tree       
Reading state information... Done
All packages are up to date.
```

### 2. Installing cri-o

Now you can install cri-o with apt. Currently the latest version of in apt repository is cri-o is 1.15.
```shell
$ apt install cri-o-1.15 -y
...
```

Although it suggests to install `containernetworking-plugins` package together, it will be uninstalled during Kubernetes installation, so we don't have to install it.

### 3. Configuring cri-o

By default, cri-o finds conmon in `/usr/libexec/crio`, which does not exist. Hence, when you start cri-o, it says it could not find conmon.
Change the configuration file of cri-o `/etc/crio/crio.conf`:
```
# Path to the conmon binary, used for monitoring the OCI runtime.
# originally it was "/usr/libexec/crio/conmon". Following path comes from $which conmon, which may be different from other environments.
conmon = "/usr/bin/conmon"
```

Also, you have to add repositores to pull images. This configuration can be either `/etc/crio/crio.conf` or `/etc/containers/registries.conf` like:
```
...
[registries.search]
registries = ['docker.io', 'registry.fedoraproject.org', 'registry.access.redhat.com']
...
```
Or easily pull the content from Project Atomic by `curl https://raw.githubusercontent.com/projectatomic/registries/master/registries.fedora -o /etc/containers/registries.conf`.

You can now start cri-o by `systemctl start crio`.

```shell
$ systemctl status crio
● crio.service - Container Runtime Interface for OCI (CRI-O)
   Loaded: loaded (/lib/systemd/system/crio.service; disabled; vendor preset: enabled)
   Active: active (running) since Thu 2019-11-21 18:30:16 KST; 32min ago
     Docs: https://github.com/cri-o/cri-o
 Main PID: 12181 (crio)
    Tasks: 13
   Memory: 23.2M
   CGroup: /system.slice/crio.service
           └─12181 /usr/bin/crio

Nov 21 18:30:16 kubernetesdebian systemd[1]: Starting Container Runtime Interface for OCI (CRI-O)...
Nov 21 18:30:16 kubernetesdebian systemd[1]: Started Container Runtime Interface for OCI (CRI-O).
```


# Installing Kubernetes

Installing Kubernetes in Debian is quite explained well[^2].

### 1. Add PPA and installing packages

At first add a public key for Kubernetes.
```shell
$ apt install curl -y && curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key add -
...
```

Then add a apt repository by creating a file `/etc/apt/sources.list.d/kubernetes.list` as:
```
deb https://apt.kubernetes.io/ kubernetes-xenial main
```

And then install packages.

```shell
$ apt update && apt install kubelet kubeadm kubectl -y
...
```

### 2. Configuring kubelet

Kubelet automatically starts, however, it repeatedly fails due to lack of configurations.
```shell
$ systemctl status kubelet
...
Nov 21 18:06:02 kubernetesdebian systemd[1]: Started kubelet: The Kubernetes Node Agent.
Nov 21 18:06:03 kubernetesdebian kubelet[9249]: F1121 18:06:03.006915    9249 server.go:196] failed to Kubelet config file /var/lib/kubelet/config.yaml, error failed to read kubelet config file "/var/lib/kubelet/config.yaml", error: open /var/lib/kubelet/config.yaml: no such file or directory
Nov 21 18:06:03 kubernetesdebian systemd[1]: kubelet.service: Main process exited, code=exited, status=255/EXCEPTION
Nov 21 18:06:03 kubernetesdebian systemd[1]: kubelet.service: Failed with result 'exit-code'.
```

First, add arguments to connect kubelet and cri-o by creating a file `/etc/default/kubelet`:
```
KUBELET_EXTRA_ARGS=--cgroup-driver=systemd --container-runtime=remote --container-runtime-endpoint="unix:///var/run/crio/crio.sock"
```

Then type `systemctl daemon-reload` to apply the changed configurations.

> Note that, using --cgroup-driver is deprecated. We have to pass the information with --config argument. Here, we just use it for simplicity.

### 3. Configuring Kubernetes

Now initialize a control-plane node by `kubeadm init`, with proper arguments as you want[^3].

```shell
$ kubeadm init
...
[bootstrap-token] configured RBAC rules to allow Node Bootstrap tokens to post CSRs in order for nodes to get long term certificate credentials
[bootstrap-token] configured RBAC rules to allow the csrapprover controller automatically approve CSRs from a Node Bootstrap Token
[bootstrap-token] configured RBAC rules to allow certificate rotation for all node client certificates in the cluster
[bootstrap-token] Creating the "cluster-info" ConfigMap in the "kube-public" namespace
[addons] Applied essential addon: CoreDNS
[addons] Applied essential addon: kube-proxy

Your Kubernetes control-plane has initialized successfully!

To start using your cluster, you need to run the following as a regular user:

  mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config


You should now deploy a pod network to the cluster.
Run "kubectl apply -f [podnetwork].yaml" with one of the options listed at:
  https://kubernetes.io/docs/concepts/cluster-administration/addons/

You can now join any number of machines by running the following on each node as root:

  kubeadm join <control-plane-host>:<control-plane-port> --token <token> --discovery-token-ca-cert-hash sha256:<hash>
```

Then, make kubectl work for you. For non-root user:
```shell
$ mkdir -p $HOME/.kube
$ sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
$ sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

or root user:
```shell
$ export KUBECONFIG=/etc/kubernetes/admin.conf
```

You now have a working Kubernetes control-plane node in Debian.

```shell
$ kubectl describe nodes
Name:               kubernetesdebian
Roles:              master
Labels:             beta.kubernetes.io/arch=amd64
                    beta.kubernetes.io/os=linux
                    kubernetes.io/arch=amd64
                    kubernetes.io/hostname=kubernetesdebian
                    kubernetes.io/os=linux
                    node-role.kubernetes.io/master=
Annotations:        kubeadm.alpha.kubernetes.io/cri-socket: /var/run/crio/crio.sock
                    node.alpha.kubernetes.io/ttl: 0
                    volumes.kubernetes.io/controller-managed-attach-detach: true
CreationTimestamp:  Thu, 21 Nov 2019 18:14:01 +0900
Taints:             <none> 
Unschedulable:      false
Conditions:
  Type             Status  LastHeartbeatTime                 LastTransitionTime                Reason                       Message
  ----             ------  -----------------                 ------------------                ------                       -------
  MemoryPressure   False   Thu, 21 Nov 2019 19:22:02 +0900   Thu, 21 Nov 2019 18:13:59 +0900   KubeletHasSufficientMemory   kubelet has sufficient memory available
  DiskPressure     False   Thu, 21 Nov 2019 19:22:02 +0900   Thu, 21 Nov 2019 18:13:59 +0900   KubeletHasNoDiskPressure     kubelet has no disk pressure
  PIDPressure      False   Thu, 21 Nov 2019 19:22:02 +0900   Thu, 21 Nov 2019 18:13:59 +0900   KubeletHasSufficientPID      kubelet has sufficient PID available
  Ready            True    Thu, 21 Nov 2019 19:22:02 +0900   Thu, 21 Nov 2019 18:13:59 +0900   KubeletReady                 kubelet is posting ready status. AppArmor enabled
Addresses:
  InternalIP:  10.0.2.15
  Hostname:    kubernetesdebian
Capacity:
 cpu:                2
 ephemeral-storage:  59599788Ki
 hugepages-2Mi:      0
 memory:             2043052Ki
 pods:               110
Allocatable:
 cpu:                2
 ephemeral-storage:  54927164530
 hugepages-2Mi:      0
 memory:             1940652Ki
 pods:               110
System Info:
 Machine ID:                 3734a41935384d118cfc280d87d803c1
 System UUID:                c9945cb0-9f07-42cb-a91d-927b6b2ff039
 Boot ID:                    1b69c8ce-2296-41b6-8964-17c11ca1224c
 Kernel Version:             4.19.0-6-amd64
 OS Image:                   Debian GNU/Linux 10 (buster)
 Operating System:           linux
 Architecture:               amd64
 Container Runtime Version:  cri-o://1.15.3-dev
 Kubelet Version:            v1.16.3
 Kube-Proxy Version:         v1.16.3
...
```


### Some test with a single node cluster

By default, any control-plane nodes pods are not schedulable; therefore, when you try to schedule a pod, it should be in pending status.
Following command will make Kubernetes be able to schedule pods in control-plane nodes as well[^4].

```shell
$ kubectl taint nodes <node_name> node-role.kubernetes.io/master-
node/<node_name> untainted
```

Try to deploy a new pod `test_pod.yaml`:
```
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
  labels:
    app: myapp
spec:
  containers:
  - name: myapp-container
    image: busybox
    command: ['sh', '-c', 'echo Hello Kubernetes! && sleep 3600']
```

```shell
$ kubectl apply -f test_pod.yaml
pod/myapp-pod created
$ kubectl describe pods
Name:         myapp-pod
Namespace:    default
Priority:     0
Node:         kubernetesdebian/10.0.2.15
Start Time:   Thu, 21 Nov 2019 19:41:59 +0900
Labels:       app=myapp
Annotations:  kubectl.kubernetes.io/last-applied-configuration: ...
Status:       Running
IP:           10.88.0.7
IPs:
  IP:  10.88.0.7
Containers:
  myapp-container:
    Container ID:  cri-o://5b9038e1687d1a9c8c58ac7879d92c3f42089b93fd947cc7f02dc440a1c510e3
    Image:         busybox
    Image ID:      docker.io/library/busybox@sha256:679b1c1058c1f2dc59a3ee70eed986a88811c0205c8ceea57cec5f22d2c3fbb1
    Port:          <none>
    Host Port:     <none>
    Command:
      sh
      -c
      echo Hello Kubernetes! && sleep 3600
    State:          Running
      Started:      Thu, 21 Nov 2019 19:42:03 +0900
    Ready:          True
    Restart Count:  0
    Environment:    <none>
    Mounts:
      /var/run/secrets/kubernetes.io/serviceaccount from default-token-vwt85 (ro)
Conditions:
  Type              Status
  Initialized       True
  Ready             True
  ContainersReady   True
  PodScheduled      True
...
```

> This is not recommended by Kubernetes for security reasons. To undo this setting, do:
>
> `$ kubectl taint nodes kubernetesdebian node-role.kubernetes.io/master=:NoSchedule`


[^1]: Project Atomic PPA: [https://launchpad.net/~projectatomic/+archive/ubuntu/ppa](https://launchpad.net/~projectatomic/+archive/ubuntu/ppa)
[^2]: Installing kubeadm: [https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm/](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm/)
[^3]: Creating a single control-plane cluster with kubeadm: [https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/#instructions)
[^4]: Control plane node isolation: [https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/#control-plane-node-isolation)