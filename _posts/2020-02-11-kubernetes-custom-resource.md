---
layout: post
title: Kubernetes Custom Resource Definition (CRD)
date: 2020-02-11 17:23
category: 
author: Insu Jang
tags: [kubernetes, study]
summary: 
---

One of main advantages of Kubernetes API is flexibility; users can add a custom resource to the Kubernetes cluster, and Kubernetes apiserver manages defined custom resources like standard resources (e.g. ReplicaSet, etc).
Main introduction in Kubernetes document is in [[here]](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/).

A major confusing point comes from ambiguous distinction between Custom Resource Definition (CRD) and Aggregated APIserver (AA).
Even the document explains some differences of two types of implementation, it is not clearly understandable.

**A main difference is whether (an) additional user-defined api server is required (AA) or not (CRD)**. In both cases custom controllers are needed to handle operations for custom resources, but for CRD, Kubernetes apiserver handles data store and operation management, there is no need for CRD to build a new apiserver.

![apiserver internal architecture](/assets/images/200211/apiserver.png)
[^1]

For any operations registered for **aggregation**, kube-apiserver forwards them to the registered aggregated apiserver. Following picture from Kubediscovery illustrates that an additional kubediscovery-apiserver receives aggregated api requests from kube-apiserver, following **aggregation path**.

![kubediscovery apiserver example](/assets/images/200211/kubediscovery_apiserver.jpeg){: width="800px"} [^2]

CRD operations, however, are handled *inside* kube-apiserver, by **apiextensions-apiserver** module. This is not a seperate process but a module integrated in the kube-apiserver. Data for CRDs are stored in etcd, similar to all other standard Kubernetes objects.


Although aggregated apiserver has less limitations, however, CRDs are more widely deployed. This post only covers CRD.

# Operator Pattern

The primitive definition of CRD was at first proposed by CoreOS, a company that develops many Kubernetes components (etcd, flanneld, etc), as **operator pattern** [^3].

> The Operator **simulates human operator behaviors** in three steps: Observe, Analyze, and Act.
> First, it observes the current cluster state by using the Kubernetes API. Second, it finds the differences between the desired state and current state. Last, it fixes the difference through one or both of the cluster management API or the Kubernetes API.
>
> *Introducing Operators: Putting Operational Knowledge into Software. [^3]*

Operator pattern defines (1) resources, and (2) controllers. (You can imagine Model and Controller in MVC pattern) controllers, running as a process, run specified functionalties based on resource's current state. For instance, If the desired state of a Pod (a resource) is *running* state, and the current state if *scheduled* state. *A Kubelet (a controller of Pods)*, creates containers, assigns memory and storage, etc, to make the state as desired.

# Custom Resource Definitions (CRD)

Kubernetes adopted **Custom Resource Definitions (CRD)** as one of its official object types. You can check which CRDs are registered in the cluster:

```shell
$ kubectl get crds
NAME                              CREATE AT
testresource.insujang.github.io   2020-02-11T07:34:21Z
```

The relationship of CRDs and CRD objects is similar to *classes* and *class instances* in object oriented languages. CRD is a template so that users can create a custom resources with predefined structure in CRD.

To use a custom resource in the Kubernetes cluster, you should do:

1. Specify a custom resource definition and register it to the apiserver. (This information will be shown as a result of `$ kubectl get crds`.)
2. Implement a custom controller that wathces changes of the custom resources.
3. Create a custom resource. The apiserver will store this creation information into etcd and broadcasts the change, then the custom controller will catach it and works as implemented. (Assuming the name of custom resource is `testresource`, you can see created resources by `$ kubectl get testresources`.)

> In order to know how to install Kubernetes, please refer to [[the official document]](https://kubernetes.io/docs/tasks/tools/install-kubectl/) or [[my post]](/2019-11-21/installing-kubernetes-and-crio-in-debian/).

### Specifying a custom resource definition

Kubernetes provides a node agent called *kubelet* that manages the node. By using kubelet, we can apply a yaml file that specifies a custom resource definition [^4].

```shell
$ cat test_resource.yaml
apiVersion: apiextensions.k8s.io/v1beta1
kind: CustomResourceDefinition
metadata:
  # name must be in the form: <spec.plural>.<group>.
  name: testresources.insujang.github.io
spec:
  # group name to use for REST API: /apis/<spec.group>/<spec.version>
  # This example a format of REST API would be: /apis/insujang.github.io/v1beta1
  # apiVersion in yaml files to create this CRD type should be same with this value.
  group: insujang.github.io
  names:
    kind: TestResource
    listKind: TestResourceList
    # plural name to be used in the URL: /apis/<spec.group>/<spec.version>/<plural>
    # This example a format of the URL would be: /apis/insujang.github.io/v1beta1/testresources
    plural: testresources
    # signalur name to be used as an alias on the CLI and for the display
    singular: testresource
  # either "Namespaced" or "Cluster" (unnamespaced object such as CRD itself).
  # You can specify which resources in a namespace by $ kubectl api-resources --namespaced=true
  # or not in a namespace by $ kubectl api-resources --namespaced=false.
  scope: Namespaced
  subresources:
    status: {}
  # By specifying OpenAPI v3.0 validation schema, we can add some restrictions on CRD objects,
  # such like any objects with this CRD type are required to have some properties,
  # or its pattern should be match with a regular expression, etc. [^5]
  # This CRD requires to have two properties: "command" and "custom_property".
  validation:
    openAPIV3Schema:
      type: object
      properties:
        apiVersion:
          type: string
        kind:
          type: string
        metadata:
          type: object
        spec:
          properties:
            command:
              type: string
            customProperty:
              type: string
              pattern: "thisshouldmatchwiththisstring"
          required:
          - command
          - customProperty
          type: object
      required:
      - apiVersion
      - kind
      - spec
  versions:
  - name: v1beta1
    # Each version can be enabled/disabled by served flag.
    served: true
    # OPne any only one version must be marked as the storage version.
    storage: true

$ kubectl create -f test_resource.yaml
customresourcedefinition.apiextensions.k8s.io/testresources.insujang.github.io created

$ kubectl get crds
NAME                               CREATED AT
testresources.insujang.github.io   2020-02-12T00:14:13Z
```

### Creating an object as custom resource based on CRD

With this CRD registered, the apiserver would accept the following yaml for a TestResource object creation:

```shell
$ cat create_testresource.yaml
apiVersion: insujang.github.io/v1beta1
kind: TestResource
metadata:
  name: example-resource
spec:
  command: "Hello Kubernetes CRD!"
  customProperty: "thisshouldmatchwiththisstring"

$ kubectl apply -f create_testresource.yaml 
testresource.insujang.github.io/example-resource created

$ kubectl get testresources
NAME               AGE
example-resource   16s
```

while the apiserver would not accept the following yaml due to validation failure:
```shell
$ cat create_testresource2.yaml 
apiVersion: insujang.github.io/v1beta1
kind: TestResource
metadata:
  name: example-resource2
spec:
  command: "Hello Kubernetes CRD!"
  customProperty: "thisisanotherpropertythatshouldnotbeaccepted"

$ kubectl apply -f create_testresource2.yaml 
The TestResource "example-resource2" is invalid: spec.customProperty: Invalid value: "": spec.customProperty in body should match 'thisshouldmatchwiththisstring'
```

> Note that the URL for an `TestResource` object creation is `/apis/insujang.github.io/v1`.
> And it is a namespaced resource, the full URL is `/apis/insujang.github.io/v1/namespaces/default/testresources` as shown below:
>
> ```shell
> $ kubectl apply -f create_testresource.yaml --v=6
> GET https://127.0.0.1:6443/openapi/v2?timeout=32s 200 OK in 13 milliseconds
> GET https://127.0.0.1:6443/apis/insujang.github.io/v1beta1/namespaces/default/testresources/example-resource 404 Not Found in 4 milliseconds
> POST https://127.0.0.1:6443/apis/insujang.github.io/v1beta1/namespaces/default/testresources 201 Created in 7 milliseconds
> ```

It is required that you must check the status of the registered CRD before creating any CRD typed objects, since it would not be accepted due to name confliction, etc.
the `apiextensions-apiserver` reports the status to the cluster.

``` shell
$ kubectl describe crds testresources
Name:         testresources.insujang.github.io
Namespace:    
Labels:       <none>
Annotations:  <none>
API Version:  apiextensions.k8s.io/v1
Kind:         CustomResourceDefinition

<omitted>

Status:
  Accepted Names:
    Kind:       TestResource
    List Kind:  TestResourceList
    Plural:     testresources
    Singular:   testresource
  Conditions:
    Last Transition Time:  2020-02-12T00:55:29Z
    Message:               no conflicts found
    Reason:                NoConflicts
    Status:                True
    Type:                  NamesAccepted
    Last Transition Time:  2020-02-12T00:55:29Z
    Message:               the initial names have been accepted
    Reason:                InitialNamesAccepted
    Status:                True
    Type:                  Established
  Stored Versions:
    v1beta1
Events:  <none>
```

There was no name conflictions in this example.

[^0]: [Example Kubernetes Constroller: cnat](https://github.com/programming-kubernetes/cnat)
[^1]: [SIG API Machinery Deep Dive](https://schd.ws/hosted_files/kccnceu18/4b/Sig%20API%20Machinery%20Deep%20Dive.pdf)
[^2]: [Kubediscovery: Aggregated API Server to learn more about Kubernetes Custom Resources](https://itnext.io/kubediscovery-aggregated-api-server-to-learn-more-about-kubernetes-custom-resources-18202a1c4aef)
[^3]: [Introducing Operators: Putting Operational Knowledge into Software](https://coreos.com/blog/introducing-operators.html)
[^4]: [Extending the Kubernetes API with CustomResourceDefinitions: Create a CRD](https://kubernetes.io/docs/tasks/access-kubernetes-api/custom-resources/custom-resource-definitions/#create-a-customresourcedefinition)
[^5]: [Extending the Kubernetes API with CustomResourceDefinitions: Validation](https://kubernetes.io/docs/tasks/access-kubernetes-api/custom-resources/custom-resource-definitions/#validation)