---
layout: post
title: Programming Kubernetes CRDs
date: 2020-02-13 10:13
category: 
author: Insu Jang
tags: [kubernetes, study, go]
summary: 
---

In [[previous post]](/2020-02-11/kubernetes-custom-resource/), I briefly introduced a custom resource definition and how to create it through CLI.
In this post, I introduce how to implement Go code that programatically specifies a CRD and a custom controllers that handles CRD events.

Many tutorials are exist, but not perfect [^code_generation_tutorial] [^tutorial1] [^tutorial2] [^tutorial3] [^tutorial4]. I by myself implement a new custom controller to fully understand how it works, and introduce almost full details here.

> Example code used in this post is uploaded in [[my Github repository]](https://github.com/insujang/kubernetes-test-controller).

Kubernetes provides a set of options to build a custom controller; using [Operator SDK](https://github.com/operator-framework/operator-sdk), [kubebuilder](https://github.com/kubernetes-sigs/kubebuilder), or [code-generator](https://github.com/kubernetes/code-generator).
I think each has its advantages, this post only explains how to implement a controller using **code-generator**, since it requires deeper understanding regarding how Kubernetes works. I wanted to *understand* how Kubernetes is internally working, it is the best option for me.

Implementing a custom controller with code-generator involves two Kubernetes libraries:

- client-go: Go client library that provides all helper functions to access the Kubernetes apiserver.
- code-generator: Go library that generates some components that are required to implement a custom controller, based on our CRD specification.

![kubernetes controller diagram](/assets/images/200213/client-go-controller-interaction.jpeg){: width="800px" .center-image #diagram} [^controller_diagram]

The diagram consists of two parts, but actual implementation has three parts.

- client-go library provides **a communication channel between the controller and the kube-apiserver, a workqueue for events from the kube-apiserver, and a local shared cache**. client-go provides more functionalities, but for custom controllers it is okay to know about these.
- client-go provides a communication channel, but we need to specify *the types of objects* that we are interested in. This should be Go-types, but is hard to implement *manually*. **This is what code-generator provides**; if we provide our CRD specification to Go struct, code-generator generates Go codes that can be used with client-go.
- In custom controller part, we need to **manually implement control logics** (do something when an add/update/delete event arrives).

In implementation, we first generate a Go code using code-generator, and then implement our custom controller using client-go and the generated code.

# 1. Generating Go code with code-generator

[^code_generation_tutorial] well explains how to use code-generator, however, **it assumes all Go projects be in `$GOPATH` (your input Go code, your genearted code)**, since there was no Go module concept at that time (October 2017). I would like to know how to use it outside `GOPATH`, but I could not. Here, I show you how to do it. You **can** generate code outside `GOPATH` using Go module system.

```shell
$ tree ~/kubernetes-test-controller
/root/kubernetes-test-controller
|-- cmd
|   `-- controller
|-- go.mod
`-- lib
    `-- testresource

$ cat go.mod
module insujang.github.io/kubernetes-test-controller

go 1.13

require k8s.io/client-go v0.17.0 // indirect
```

Note that generated code and our sample controller will be the same module named `insujang.github.io/kubernetes-test-controller`. I also explicitly added dependency to `client-go` via `GO111MODULE=on go get k8s.io/client-go@v0.17.0`.

## Prerequisites

Download code-generator. In the old post, I introduced `GO111MODULE=off go get k8s.io/code-generator`, to download it in `$GOPATH`, **but it is not necessary, since we do not use this repository as a Go dependent package.** Download it anywhere you want.

```shell
$ git clone https://github.com/kubernetes/code-generator
$ cd code-generator; git checkout v0.17.0
```

> Note that you need to change the branch of the repository to specific version, not master, because with the master branch our generated Go code is **incompatible** to current Kubernetes cluster.


## Write template code

To use code-generator, you must write three files: `doc.go`, `register.go`, and `types.go`.

![package_tree](https://www.openshift.com/hs-fs/hubfs/Imported_Blog_Media/Screen-Shot-2017-10-16-at-17_58_28.png?width=580&height=502&name=Screen-Shot-2017-10-16-at-17_58_28.png)

The tree above comes from [^code_generation_tutorial]. Although it is better to keep the tree structure (doing so the path of package looks more naturally like the existing Kubernetes objects: `apis/example.com/v1`), **it is not necessary to keep this structure**. Instead, I use the following directory tree.

```shell
tree ~/kubernetes-test-controller/lib/testresource/v1beta1
/root/kubernetes-test-controller/lib/testresource/v1beta1
|-- doc.go
|-- register.go
`-- types.go
```

> all the other directories, such as client/clientset, informers, listers, are generated by code-generator. You do not have to manually generate them.
> Also, pkg/apis/example.com/register.go is not mandatory.

> The only requirement you should follow is to put those files in `<version>` directory, such as `v1beta1` in my example. `v1`, `v1alpha1`, whatever you want is ok.

### doc.go
```go
// +k8s:deepcopy-gen=package
// +groupName=insujang.github.io

package v1beta1
```

`//+tag-name=value` is a tag that code-generator uses for generating Go code. For detailed explanation, refer to [^programming_kubernetes] or [^code_generation_tutorial]. I stronglly recommend to buy [^programming_kubernetes] as it explains those in detail.

For `groupName`, you should specify the group name that you used as a part of module name. I initialized a Go module at the root directory of the Go project named `insujang.github.io/kubernetes-test-controller`, so my `groupName` should be `insujang.github.io`.

### types.go

```go
package v1beta1

import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

// These const variables are used in our custom controller.
const (
	GroupName string = "insujang.github.io"
	Kind      string = "TestResource"
	Version   string = "v1beta1"
	Plural    string = "testresources"
	Singluar  string = "testresource"
	ShortName string = "ts"
	Name      string = Plural + "." + GroupName
)

// TestResourceSpec specifies the 'spec' of TestResource CRD.
type TestResourceSpec struct {
	Command        string `json:"command"`
	CustomProperty string `json:"customProperty"`
}

// +genclient
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// TestResource describes a TestResource custom resource.
type TestResource struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   TestResourceSpec `json:"spec"`
	Status string           `json:"status"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// TestResourceList is a list of TestResource resources.
type TestResourceList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata"`

	Items []TestResource `json:"items"`
}
```

`types.go` mainly specifies how a Go-type version of your CRD looks like.
code-generator uses `TypeResource` and `TypeResourceList` struct to generate a code, and custom controller will use these structure to communicate with kube-apiserver (specifically, when generating HTTP requests).

> **Complex Status structure**: My `TestResource` has a `Status` typed `string`, however, it can be a complex structure. For instance, the `Status` of Pod is defined as [[this]](https://github.com/kubernetes/kubernetes/blob/v1.17.3/staging/src/k8s.io/apiserver/pkg/apis/example/v1/types.go#L56). It works as long as you match this Go-typed spec and actual CRD.

> **NoStatus**: If you do not want to make `Status` in your CRD, erase the field and add `// +noStatus` tag to indicate to code-generator that this has no Status.

Also note that you have to be careful for naming. You **should capitalize** all the fields so that your controller and the generated code can access those fields. In other words, for json names, you **should not** capitalize to make it work with HTTP APIs. For instance, `TestResourceSpec.CustomProperty` is a public field in Go, but its json name should be `customProperty`, not `CustomProperty`.

### register.go

```go
package v1beta1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var (
	// SchemeBuilder initializes a scheme builder
	SchemeBuilder = runtime.NewSchemeBuilder(addKnownTypes)
	// AddToScheme is a global function that registers this API group & version to a scheme
	AddToScheme = SchemeBuilder.AddToScheme
)

// SchemeGroupVersion is group version used to register these objects.
var SchemeGroupVersion = schema.GroupVersion{
	Group:   GroupName,
	Version: Version,
}

func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}

func addKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(SchemeGroupVersion,
		&TestResource{},
		&TestResourceList{},
	)
	metav1.AddToGroupVersion(scheme, SchemeGroupVersion)
	return nil
}
```

The global variables are used by the generated-code internally, so you have to define all the variables, unless your controller will not be compiled.

## Get generated Go code with code-generator

Now code for code-generator is ready. Let's get our generated code.
But first, as code-generator assumes all our Go code is located based on `$GOPATH`, we have to fake the code-generator.

code-generator and our Go module are at:

```shell
~ $ tree -d -L 1 ~
/root
|-- code-generator
`-- kubernetes-test-controller
```

Then, we specify our module's location to code-generator as:

```shell
~/code-generator $ go mod edit -replace=insujang.github.io/kubernetes-test-controller=../kubernetes-test-controller
```

This will indicate code-generator that any modules in `insujang.github.io` will be replaced by those with the same name in `..`. For instance, the module named `insujang.github.io/kubernetes-test-controller/lib/testresource/v1beta1` is replaced by `../kubernetes-test-controller/lib/testresource/v1beta1`.

This trick is a key that you can implement a custom controller outside `$GOPATH`. The code-generator works with the old legacy GOPATH mode, assuming all code is in `$GOPATH`. So, its input is a relative path from `$GOPATH/src`, and the generated code imports packages using the path. For instance, if you just use `../kubernetes-test-controller/lib/testresource` as an input of code-generator, the generated code all contains `import "../kubernetes-test-controller/lib/testresource/<subpath/to/packages>"`, which makes the generated code not usable in other modules, if you want to use the generated code as dependent packages.

With the module path replacement, the following command will generate code.

```shell
~/code-generator $ ./generate-groups.sh all insujang.github.io/kubernetes-test-controller/lib/testresource/generated insujang.github.io/kubernetes-test-controller/lib testresource:v1beta1 --go-header-file ./hack/boilerplate.go.txt --output-base ..
Generating deepcopy funcs
Generating clientset for testresource:v1beta1 at insujang.github.io/lib/testresource/generated/clientset
Generating listers for testresource:v1beta1 at insujang.github.io/lib/testresource/generated/listers
Generating informers for testresource:v1beta1 at insujang.github.io/lib/testresource/generated/informers
```

- For third and fourth argument, you should match your directory structure with these arguments. In my case, the input code are in `~/kubernetes-test-controller/lib/testresource/v1beta1`. `insujang.github.io/lib` will be replaced `../kubernetes-test-controller/lib` due to `go mod edit -replace` operation that we did. A combination of this path and the target CRD `testresource:v1beta1` should be same with the actual directory containing the input code.
- For second argument, you can specify anything, but after specifying the path, you cannot modify the structure;
I specified `insujang.github.io/lib/testresource/generated`. All packages in the directory should be imported with this path, such as `import "insujang.github.io/lib/testresource/generated/clientset/versioned"`.
- `--go-header-file` is necessary, unless code generation fails.
- `--output-base ..` indicates code-generator to generate code in `~/code-generator/../insujang.github.io/lib`. Without the flag, the generated code would be in `$GOPATH`.

The generated code consists of two parts:
- `testresource/generated/*` (as indicated through the second argument)
- `testresource/v1beta1/zz_generated.deepcopy.go`

### Move the generated code

The input code (types.go, register.go, and doc.go) are still necessary for the generated code to work. Currently the generated code and the input code is dividened, let's merge them.

Simply, copy all the generated code into our project.

```shell
$ cp -r ~/insujang.github.io/kubernetes-test-controller/lib/testresource/* ~/kubernetes-test-controller/lib/testresource/
$ rm -r ~/insujang.github.io
```

The result of the generated code looks like:

```shell
~/kubernetes-test-controller $ tree -L 4 .
.
|-- cmd
|   `-- controller
|-- go.mod
|-- go.sum
`-- lib
    `-- testresource
        |-- generated
        |   |-- clientset
        |   |-- informers
        |   `-- listers
        `-- v1beta1
            |-- doc.go
            |-- register.go
            |-- types.go
            `-- zz_generated.deepcopy.go
```

The generated code, although it is outside `$GOPATH`, can be accessed via `insujang.github.io/lib/testresource/*` in this Go project!

# 2. Implementing custom controller based on the generated code and client-go

Now let's implement our custom controller with the generated code at `~/kubernetes-test-controller/cmd/controller`.

Sample-controller is well illustrated in [[here]](https://github.com/kubernetes/sample-controller/blob/master/controller.go).

Explaining it simply, all we have to do is to register our custom resource objects into watcher, and add a control logic.

## Implementing a custom resource object watcher

```go
package main

import (
	"os"
	"time"

	corev1 "k8s.io/api/core/v1"
	apiextensionsclientset "k8s.io/apiextensions-apiserver/pkg/client/clientset/clientset"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/kubernetes"
	typedcorev1 "k8s.io/client-go/kubernetes/typed/core/v1"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/record"
	"k8s.io/client-go/util/workqueue"
	"k8s.io/klog"

	testresourceclienteset "insujang.github.io/kubernetes-test-controller/lib/testresource/generated/clientset/versioned"
	testresourecescheme "insujang.github.io/kubernetes-test-controller/lib/testresource/generated/clientset/versioned/scheme"
	testresourceinformers "insujang.github.io/kubernetes-test-controller/lib/testresource/generated/informers/externalversions"
	testresourcelisters "insujang.github.io/kubernetes-test-controller/lib/testresource/generated/listers/testresource/v1beta1"
	testresourcev1beta1 "insujang.github.io/kubernetes-test-controller/lib/testresource/v1beta1"
)

type Controller struct {
	kubeclientset          kubernetes.Interface
	apiextensionsclientset apiextensionsclientset.Interface
	testresourceclientset  testresourceclienteset.Interface
	informer               cache.SharedIndexInformer
	lister                 testresourcelisters.TestResourceLister
	recorder               record.EventRecorder
	workqueue              workqueue.RateLimitingInterface
}

func NewController() *Controller {
	kubeconfig := os.Getenv("KUBECONFIG")

	config, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {
		klog.Fatalf(err.Error())
	}

	kubeClient := kubernetes.NewForConfigOrDie(config)
	apiextensionsClient := apiextensionsclientset.NewForConfigOrDie(config)
	testClient := testresourceclienteset.NewForConfigOrDie(config)

	informerFactory := testresourceinformers.NewSharedInformerFactory(testClient, time.Minute*1)
	informer := informerFactory.Insujang().V1beta1().TestResources()
	informer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(object interface{}) {
			klog.Infof("Added: %v", object)
		},
		UpdateFunc: func(oldObject, newObject interface{}) {
			klog.Infof("Updated: %v", newObject)
		},
		DeleteFunc: func(object interface{}) {
			klog.Infof("Deleted: %v", object)
		},
	})
	informerFactory.Start(wait.NeverStop)

	utilruntime.Must(testresourcev1beta1.AddToScheme(testresourecescheme.Scheme))
	eventBroadcaster := record.NewBroadcaster()
	eventBroadcaster.StartLogging(klog.Infof)
	eventBroadcaster.StartRecordingToSink(&typedcorev1.EventSinkImpl{Interface: kubeClient.CoreV1().Events("")})
	recorder := eventBroadcaster.NewRecorder(testresourecescheme.Scheme, corev1.EventSource{Component: "testresource-controller"})

	workqueue := workqueue.NewRateLimitingQueue(workqueue.DefaultControllerRateLimiter())

	return &Controller{
		kubeclientset:          kubeClient,
		apiextensionsclientset: apiextensionsClient,
		testresourceclientset:  testClient,
    informer:               informer.Informer(),
    lister:                 informer.Lister(),
		recorder:               recorder,
		workqueue:              workqueue,
	}
}

```

It should have been hard to manually implement `testresourceclientset.NewforConfig()`, `testresourceinformers.NewSharedInformerFactory()`, etc. Thanks to code-generator, all these are automatically generated.
You can easily find out that you just implement the line 50~52 to handle object.

## Running the watcher

Before we use the controller, we first sync the local cache. Then we can use an event loop, handling events.

```go
func (c *Controller) Run() {
	defer utilruntime.HandleCrash()
	defer c.workqueue.ShutDown()

	klog.Infoln("Waiting cache to be synced.")
	// Handle timeout for syncing.
	timeout := time.NewTimer(time.Second * 30)
	timeoutCh := make(chan struct{})
	go func() {
		<-timeout.C
		timeoutCh <- struct{}{}
	}()
	if ok := cache.WaitForCacheSync(timeoutCh, c.informer.HasSynced); !ok {
		klog.Fatalln("Timeout expired during waiting for caches to sync.")
	}

	klog.Infoln("Starting custom controller.")
	select {}
}

func main() {
  controller := NewController()
  controller.Run()
}
```

However, currently CRD is not registered, the code will print the following error:

```
I0406 17:19:45.234148   28602 types.go:85] Waiting cache to be synced.
E0406 17:19:45.239971   28602 reflector.go:178] pkg/mod/k8s.io/client-go@v0.18.0/tools/cache/reflector.go:125: Failed to list *v1beta1.TestResource: the server could not find the requested resource (get testresources.insujang.github.io)
```

## Register a CRD programmatically

It is okay to use a yaml file for CRD registration, but here I want to register it programatically.

[^code_generation_tutorial] mentions how to do it, but explanation is so insufficiant that I could not implement a new one.

Here is an example of how to register TestResource CRD into Kubernetes.

```go
package main

import (
	"fmt"
	"time"

	testresourcev1beta1 "insujang.github.io/kubernetes-test-controller/lib/testresource/v1beta1"
	apiextensions "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1beta1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/klog"
)

func (c *Controller) waitCRDAccepted() error {
	err := wait.Poll(1*time.Second, 10*time.Second, func() (bool, error) {
		crd, err := c.apiextensionsclientset.ApiextensionsV1beta1().CustomResourceDefinitions().Get(testresourcev1beta1.Name, metav1.GetOptions{})

		if err != nil {
			return false, err
		}

		for _, condition := range crd.Status.Conditions {
			if condition.Type == apiextensions.Established &&
				condition.Status == apiextensions.ConditionTrue {
				return true, nil
			}
		}

		return false, fmt.Errorf("CRD is not accepted")
	})

	return err
}

func (c *Controller) CreateCRD() error {
	crd := &apiextensions.CustomResourceDefinition{
		ObjectMeta: metav1.ObjectMeta{
			Name: testresourcev1beta1.Name,
		},
		Spec: apiextensions.CustomResourceDefinitionSpec{
			Group:   testresourcev1beta1.GroupName,
			Version: testresourcev1beta1.Version,
			Scope:   apiextensions.NamespaceScoped,
			Names: apiextensions.CustomResourceDefinitionNames{
				Plural:     testresourcev1beta1.Plural,
				Singular:   testresourcev1beta1.Singluar,
				Kind:       testresourcev1beta1.Kind,
				ShortNames: []string{testresourcev1beta1.ShortName},
			},
			Validation: &apiextensions.CustomResourceValidation{
				OpenAPIV3Schema: &apiextensions.JSONSchemaProps{
					Type: "object",
					Properties: map[string]apiextensions.JSONSchemaProps{
						"spec": {
							Type: "object",
							Properties: map[string]apiextensions.JSONSchemaProps{
								"command":        {Type: "string", Pattern: "^(echo).*"},
								"customProperty": {Type: "string"},
							},
							Required: []string{"command", "customProperty"},
						},
					},
				},
			},
			AdditionalPrinterColumns: []apiextensions.CustomResourceColumnDefinition{
				{
					Name:     "command",
					Type:     "string",
					JSONPath: ".spec.command",
				},
			},
		},
	}

	_, err := c.apiextensionsclientset.ApiextensionsV1beta1().CustomResourceDefinitions().Create(crd)

	if err != nil {
		klog.Fatalf(err.Error())
	}

	return c.waitCRDAccepted()
}
```

> Note that you have to check whether the CRD registration succeeded after creating a CRD.

> I specified a pattern to `command` so that any value not satisfying the pattern will be rejected.

> If you want to specify objects for your custom properties, use recursive `apiextensions.JsonSchemaProps`.
> 
> For array types, use the following code:
>
> ```go
> "customProperty": {
>   Type: "array",
>   Items: &apiextensions.JsonSchemaPropsOrArray{
>      Schema: &apiextensions.JsonSchemaProps{Type: "string"},
>   },
>}
>```
>The `customProperty` will have string array.

Review `TestResourceSpec`:

```go
type TestResourceSpec struct {
	Command        string `json:"command"`
	CustomProperty string `json:"customProperty"`
}
```

- It has two properties: `command` and `customProperty`. This kind of specifications should be in Validation field of `apiextensions.CustomResourceDefinition`.
- I added both fields are required when creating a custom resource typed `TestResource` CRD. When creating a `TestResource` custom resource, it will fail if we do not put values for both fields.
- I specified `AdditionalPrinterColumns`. it is for kubectl: when `kubectl get testresources`, additional columns specified are shown together with their names.

> To investigate more, refer to [^jsonschemaprops].

```shell
$ kubectl describe crds testresources.insujang.github.io
Namespace:    
Labels:       <none>
Annotations:  <none>
API Version:  apiextensions.k8s.io/v1
Kind:         CustomResourceDefinition
...
Spec:
  Conversion:
    Strategy:  None
  Group:       insujang.github.io
  Names:
    Kind:       TestResource
    List Kind:  TestResourceList
    Plural:     testresources
    Short Names:
      tr
    Singular:               testresource
  Preserve Unknown Fields:  true
  Scope:                    Namespaced
  Versions:
    Additional Printer Columns:
      Json Path:  .spec.command
      Name:       command
      Type:       string
    Name:         v1beta1
    Schema:
      openAPIV3Schema:
        Properties:
          Spec:
            Properties:
              Command:
                Pattern:  ^(echo).*
                Type:     string
              Custom Property:
                Type:  string
            Required:
              command
              customProperty
            Type:  object
        Type:      object
    Served:        true
    Storage:       true
Status:
  Accepted Names:
    Kind:       TestResource
    List Kind:  TestResourceList
    Plural:     testresources
    Short Names:
      tr
    Singular:  testresource
  Conditions:
    Last Transition Time:  2020-04-06T09:00:02Z
    Message:               no conflicts found
    Reason:                NoConflicts
    Status:                True
    Type:                  NamesAccepted
    Last Transition Time:  2020-04-06T09:00:02Z
    Message:               the initial names have been accepted
    Reason:                InitialNamesAccepted
    Status:                True
    Type:                  Established
  Stored Versions:
    v1beta1
```

Test it with the following yaml!

```shell
$ cat create_cr.yaml
apiVersion: insujang.github.io/v1beta1
kind: TestResource
metadata:
        name: example-tr
spec:
        command: "echo Hello World!"
        customProperty: "asdasd=1234"

$ kubectl apply -f create_custom_resource.yaml 
testresource.insujang.github.io/example-tr created

$ kubectl get testresources
NAME         COMMAND
example-tr   echo Hello World!
```

## Create s custom resource programmatically

Right above, we create a TestResource using yaml.
Creating a custom resource is not different from creating Kubernetes native resources.

Here, the input code for code-generator is used to specify an object' spec.

```go
func (c *Controller) CreateObject() error {
	object := &testresourcev1beta1.TestResource{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "example-tr2",
			Namespace: corev1.NamespaceDefault,
		},
		Spec: testresourcev1beta1.TestResourceSpec{
			Command:        "echo Hello World!",
			CustomProperty: "asdasd=1234",
		},
	}

	_, err := c.testresourceclientset.InsujangV1beta1().TestResources(corev1.NamespaceDefault).Create(object)
	return err
}
```

## Implementing a control logic

Meanwhile, our custom controller receives **added event** from kube-apiserver when you create objects.

```shell
go run .
I0406 18:08:49.084638   13160 types.go:85] Waiting cache to be synced.
I0406 18:08:49.184743   13160 types.go:97] Starting custom controller.
I0406 18:08:55.036674   13160 types.go:52] Added: &{... {example-tr  default /apis/insujang.github.io/v1beta1/namespaces/default/testresources/example-tr f0d66c6f-c843-40e7-921a-6f7eae726417 21342187 1 2020-04-06 18:08:55 +0900 KST <nil> <nil> map[] map[kubectl.kubernetes.io/last-applied-configuration:{"apiVersion":"insujang.github.io/v1beta1","kind":"TestResource","metadata":{"annotations":{},"name":"example-tr","namespace":"default"},"spec":{"command":"echo Hello World!","customProperty":"asdasd=1234"}} ...}}
```

In [[here]](#implementing-a-custom-resource-object-watcher), we only implemented a **watcher**. It does not have modification functionality. Imagine that after Kubelet runs a container, the corresponding Pod's status is changed from `PENDING` to `RUNNING`.

Now we modify the added callback function:

```go
...
c.informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(object interface{}) {
			klog.Infof("Added: %v", object)
		},
    ...
})
```

```go
func (c *Controller) objectAddedCallback(object interface{}) {
		// You can get TestResource type as this
	resource := object.(*testresourcev1beta1.TestResource)

	// or this
	key, _ := cache.MetaNamespaceKeyFunc(object)
	namespace, name, _ := cache.SplitMetaNamespaceKey(key)
  resource, _ := c.lister.TestResources(namespace).Get(name)
  
	copy := resource.DeepCopy()
	copy.Status = "HANDLED"
	_, err := c.testresourceclientset.InsujangV1beta1().TestResources(corev1.NamespaceDefault).Update(copy)
	if err != nil {
		klog.Errorf(err.Error())
		return
	}

	klog.Infoln(copy)

	c.recorder.Event(copy, corev1.EventTypeNormal, "ObjectHandled", "Object is handled by custom controller.")
}
```

This callback function is called when an object is added into Kubernetes cluster. What the callback function does is to modify its Status to `"HANDLED"`, and update it to kube-apiserver.

client-go passes object itself as an argument of the callback. But sample controller [^sample_controller] uses the second way to get an object, which is useless and inefficient I think. If you tries to access another object in the callback, you should use, however, if not, just asserting and casting the given argument would be more efficient.

Note that you should not directly modify the object.
The object is a refernece of locally stored cache, managed internally by client-go. It could break consistency between the local cache and actual data in Kubernetes cluster, so you **should always copy the object, modify it, and transfer it to kube-apiserver to update an object**.

When update succeeded, kube-apiserver will publish an update event for the object. Then, the local shared cache would be updated.

[^controller_diagram]: [Kubernetes sample-controller diagram](https://github.com/kubernetes/sample-controller)
[^programming_kubernetes]: [Programming Kubernetes: Developing Cloud-Native Applications](https://books.google.co.kr/books/about/Programming_Kubernetes.html?id=7VKjDwAAQBAJ)
[^3]: [Stay informed with Kubernetes Informers](https://www.firehydrant.io/blog/stay-informed-with-kubernetes-informers/)
[^4]: [Kubernetes code-generator](https://github.com/kubernetes/code-generator)

[^code_generation_tutorial]: [Kubernetes Deep Dive: Code Generation for CustomResources](https://blog.openshift.com/kubernetes-deep-dive-code-generation-customresources/)
[^tutorial1]: [How to write Kubernetes custom controllers in Go](https://medium.com/speechmatics/how-to-write-kubernetes-custom-controllers-in-go-8014c4a04235)
[^tutorial2]: [How to generate client code for Kubernetes Custom Resource Definitions (CRD)](https://itnext.io/how-to-generate-client-code-for-kubernetes-custom-resource-definitions-crd-b4b9907769ba)
[^tutorial3]: [Extending Kubernetes: Create Controllers for Core and Custom Resources](https://medium.com/@trstringer/create-kubernetes-controllers-for-core-and-custom-resources-62fc35ad64a3)
[^9]: [Golang Standard: Project layout](https://github.com/golang-standards/project-layout)
[^10]: [Intro to Modules on Go - Part 1](https://dev.to/prassee/intro-to-modules-on-go-part-1-1k77)
[^jsonschemaprops]: [JSONSchemaProps: Kubernetes apiextensions-apiserver](https://github.com/kubernetes/apiextensions-apiserver/blob/master/pkg/apis/apiextensions/v1beta1/types_jsonschema.go)
[^sample_controller]: [Kubernetes sample controller](https://github.com/kubernetes/sample-controller)