---
layout: post
title: "Kubernetes Authentication: Client Certificate"
date: 2019-12-18 09:26
category: 
author: Insu Jang
tags: ["kubernetes", "study"]
summary: 
---

![kubernetes api access control](https://d33wubrfki0l68.cloudfront.net/673dbafd771491a080c02c6de3fdd41b09623c90/50100/images/docs/admin/access-control-overview.svg)[^1]

For access control, Kubernetes steps the procedures above for each API operation: authentication (who can access), authorization (what can be accessed), and admisssion control.
This post is about Kubernetes **authentication**.

All API accesses are handled by Kubernetes api server. All accesses have to be authenticated by the API server for Kubernetes operations.
Kubernetes API server serve on 2 ports: one for testing, and the other for all other cases.
By default, these ports are:

- `http://localhost:8080`: intended for testing, no TLS, **request bypasses authentication and authorization modules**, handled by admission control modules (the last module in the above figure)
- `https://<ip>:6443`: use TLS (and certificate), `<ip>` is the first non-localhost network interface, request are handled by authentication and authorization modules

The HTTP request moves to the authentication step when users access to the API server through the port 6443 and establishes a TLS connection.

# Kubernetes authentication strategies [^2][^3]

Kubernetes provides the following modules for authentication.

- client certificates (default)
- bearer tokens (authentication proxy)
- HTTP basic auth


### Client certificate

By default, Kubernetes set by `kubeadm` uses X509 based client certificate for authentication.

Official documentation[^5] says:

> To enable X509 client certificate authentication to the kubelet’s HTTPS endpoint:
>
> - start the kubelet with the --client-ca-file flag, providing a CA bundle to verify client certificates with
>
> - start the apiserver with --kubelet-client-certificate and --kubelet-client-key flags
>
> - see the apiserver authentication documentation for more details

Let's see how thiese configurations are set by default.

`kubeadm` initialize kubelet as a systemd service:

```
$ cat /etc/systemd/system/kubelet.service.d/10-kubeadm.conf 
# Note: This dropin only works with kubeadm and kubelet v1.11+
[Service]
Environment="KUBELET_KUBECONFIG_ARGS=--bootstrap-kubeconfig=/etc/kubernetes/bootstrap-kubelet.conf --kubeconfig=/etc/kubernetes/kubelet.conf"
Environment="KUBELET_CONFIG_ARGS=--config=/var/lib/kubelet/config.yaml"
# This is a file that "kubeadm init" and "kubeadm join" generates at runtime, populating the KUBELET_KUBEADM_ARGS variable dynamically
EnvironmentFile=-/var/lib/kubelet/kubeadm-flags.env
# This is a file that the user can use for overrides of the kubelet args as a last resort. Preferably, the user should use
# the .NodeRegistration.KubeletExtraArgs object in the configuration files instead. KUBELET_EXTRA_ARGS should be sourced from this file.
EnvironmentFile=-/etc/default/kubelet
ExecStart=
ExecStart=/usr/bin/kubelet $KUBELET_KUBECONFIG_ARGS $KUBELET_CONFIG_ARGS $KUBELET_KUBEADM_ARGS $KUBELET_EXTRA_ARGS
```
that uses `/etc/kubernetes/kubelet.confg` as a value of `--kubeconfig` flag, which contains:
```
authentication:
  anonymous:
    enabled: false
  x509:
    clientCAFile: /etc/kubernetes/pki/ca.crt
```

The client certificate authority (CA) file is stored in `/etc/kubernetes/pki`, the default path of certificates.

Kubernetes api-server runs on kubernetes master node as a static pod. Inspecting it, we know `--kubelet-client-certificate` and `--kubelet-client-key` flags are set as well.
```
$ kubectl describe pods kube-apiserver-kube-test --namespace=kube-system
Name:                 kube-apiserver-kube-test
Namespace:            kube-system
Priority:             2000000000
Priority Class Name:  system-cluster-critical
Node:                 kube-test/ip
Start Time:           Wed, 18 Dec 2019 16:21:10 +0900
Status:               Running
Containers:
  kube-apiserver:
    Container ID:  cri-o://4537833ae99fca1fcf26f4ec3b9bcb6da99ef2b2e7da88d9674881c3c25e2f9a
    Image:         k8s.gcr.io/kube-apiserver:v1.16.4
    Image ID:      k8s.gcr.io/kube-apiserver@sha256:b24373236fff6dcc0e154433b43d53a9b2388cdf39f05fbc46ac73082c9b05f9
    Port:          <none>
    Host Port:     <none>
    Command:
      kube-apiserver
      ...
      --kubelet-client-certificate=/etc/kubernetes/pki/apiserver-kubelet-client.crt
      --kubelet-client-key=/etc/kubernetes/pki/apiserver-kubelet-client.key
      ...
```

### kubectl access

When we use `kubectl`, everything works fine. This does not mean `kubectl` is special, nor bypasses authentication module.
With `KUBECONFIG` environment variable, `kubectl` automatically loads a configuration file with certificate information before accessing the api server.
With higher level of verbose, you can see this flow.

```
$ echo $KUBECONFIG
/etc/kubernetes/admin.conf
$ kubectl --v=7 get pods
I1218 16:27:24.481836   11192 loader.go:375] Config loaded from file:  /etc/kubernetes/admin.conf
I1218 16:27:24.485689   11192 round_trippers.go:420] GET https://ip:6443/api/v1/namespaces/default/pods?limit=500
I1218 16:27:24.485700   11192 round_trippers.go:427] Request Headers:
I1218 16:27:24.485704   11192 round_trippers.go:431]     User-Agent: kubectl/v1.16.3 (linux/amd64) kubernetes/b3cbbae
I1218 16:27:24.485708   11192 round_trippers.go:431]     Accept: application/json;as=Table;v=v1beta1;g=meta.k8s.io, application/json
I1218 16:27:24.505055   11192 round_trippers.go:446] Response Status: 200 OK in 19 milliseconds
No resources found in default namespace.
```
In this node `kubectl` uses `/etc/kubernetes/admin.conf` as its credentials, which contains:

```
clusters:
- cluster:
    certificate-authority-data: LS0tLS1CRU...
    server: https://ip:6443
  name: kubernetes
...
users:
- name: kubernetes-admin
  user:
    client-certificate-data: LS0tLS1CRU...
    client-key-data: LS0tLS1CRU...
```

`certificate-authority-data` is a base64-encoded string of `/etc/kubernetes/ca.crt` [^8]. `client-certificate-data` and `client-key-data` are base64-encoded kubernetes-admin certificate and key, respectively.
This admin certificate is automatically created and managed by kubeadm.

```
$ kubeadm alpha certs check-expiration
CERTIFICATE                EXPIRES                  RESIDUAL TIME   EXTERNALLY MANAGED
admin.conf                 Dec 17, 2020 07:20 UTC   364d            no      
apiserver                  Dec 17, 2020 07:20 UTC   364d            no      
apiserver-etcd-client      Dec 17, 2020 07:20 UTC   364d            no      
apiserver-kubelet-client   Dec 17, 2020 07:20 UTC   364d            no      
controller-manager.conf    Dec 17, 2020 07:20 UTC   364d            no      
etcd-healthcheck-client    Dec 17, 2020 07:20 UTC   364d            no      
etcd-peer                  Dec 17, 2020 07:20 UTC   364d            no      
etcd-server                Dec 17, 2020 07:20 UTC   364d            no      
front-proxy-client         Dec 17, 2020 07:20 UTC   364d            no      
scheduler.conf             Dec 17, 2020 07:20 UTC   364d            no  
```
`kubeadm alpha certs` command shows the client certificates in the `/etc/kubernetes/pki`[^9] and the client certificate embedded in `KUBECONFIG` files (admin.conf, controller-manager.conf, and scheduler.conf).

For more details, refer to [^5], [^6], and [^7].

[^1]: Controlling access: [https://kubernetes.io/docs/reference/access-authn-authz/controlling-access/](https://kubernetes.io/docs/reference/access-authn-authz/controlling-access/)
[^2]: Authentication strategies: [https://kubernetes.io/docs/reference/access-authn-authz/authentication/#authentication-strategies](https://kubernetes.io/docs/reference/access-authn-authz/authentication/#authentication-strategies)
[^3]: 쿠버네티스 #16: 보안 계정 인증과 권한 인가 [https://bcho.tistory.com/1272](https://bcho.tistory.com/1272)
[^4]: Kubernetes PKI certificates [https://kubernetes.io/docs/setup/best-practices/certificates/](https://kubernetes.io/docs/setup/best-practices/certificates/)
[^5]: Understanding Kubernetes Authentication and Authorization [http://cloudgeekz.com/1045/kubernetes-authentication-and-authorization.html](http://cloudgeekz.com/1045/kubernetes-authentication-and-authorization.html)
[^6]: Authentication and Authorization in Kubernetes [https://www.sovsystems.com/blog/authentication-and-authorization-in-kubernetes](https://www.sovsystems.com/blog/authentication-and-authorization-in-kubernetes)
[^7]: 쿠버네티스 인증 [https://arisu1000.tistory.com/27847](https://arisu1000.tistory.com/27847)
[^8]: Access Kubernetes API with Client Ceritifcate. [https://codefarm.me/2019/02/01/access-kubernetes-api-with-client-certificates/](https://codefarm.me/2019/02/01/access-kubernetes-api-with-client-certificates/)
[^9]: Certificate Management with kubeadm. [https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-certs/](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-certs/)