---
layout: post
title: Programming Kubernetes CRDs
date: 2020-02-13 10:13
category: 
author: Insu Jang
tags: [kubernetes, study]
summary: 
---

In [[previous post]](/2020-02-11/kubernetes-custom-resource/), I briefly introduced a custom resource definition and how to create it through CLI.
In this post, I introduce how to implement Go code that programatically specifies a CRD and a custom controllers that handles CRD events.

> Example code used in this post is uploaded in [[my Github repository]](https://github.com/insujang/kubernetes-test-controller).

# client-go

Kubernetes provides **[[client-go]](https://github.com/kubernetes/client-go)**, which includes a set of APIs to watch objects' status from the apiserver.
Thanks to client-go library, implementing an informer or a controller becomes easy.
The picture below illustrates how a controller works, and how components in client-go and our implementation divide roles.

![kubernetes controller diagram](/assets/images/200213/client-go-controller-interaction.jpeg){: width="800px" .center-image #diagram} [^1]

client-go watches events from the kube-apiserver (1) and passes them to informer (2, 3). The internal indexer stores data in its local thread safe cache (5).
Then, client-go invokes user-implemented event handlers. The example below does until this step (so no operations for step 7, 8, and 9). Those steps will be discussed [later](#4-implement-a-custom-controller-with-the-generated-code-and-client-go-library).

## Example: implementing an event watcher (informer)

If we implement until step 7, this process will work as a event watcher (informer).
The following Go code is a basic example that watches *Pod events* from the apiserver.

> - Note that it is **an informer, not a controller**, so does not do anything when it gets events.
> - You can see similar event handler logic in kube-scheduler (https://github.com/kubernetes/kubernetes/blob/master/pkg/scheduler/scheduler.go).
> - I am not familiar with Go, so some comments seem ridiculous. Those are for my personal understanding.
> - Code adopted from [^1] [^2] [^3]

```go
package main

import (
  "time"
  "fmt"

  v1 "k8s.io/api/core/v1"
  "k8s.io/client-go/tools/clientcmd"
  "k8s.io/client-go/informers"
  "k8s.io/client-go/kubernetes"
  "k8s.io/client-go/tools/cache"
  "k8s.io/apimachinery/pkg/util/wait"
)

func main() {
  var configFile string = "/etc/kubernetes/admin.conf"

  config, err := clientcmd.BuildConfigFromFlags("", configFile)
  if err != nil {
    panic(err)
  }

  // Create a client set from config
  // https://github.com/kubernetes/client-go/blob/kubernetes-1.17.3/kubernetes/clientset.go#L370
  // func NewForConfig(c *rest.Config) (*Clientset, error)
  // Return type: Clientset struct (https://github.com/kubernetes/client-go/blob/kubernetes-1.17.3/kubernetes/clientset.go#L115)
  clientset, err := kubernetes.NewForConfig(config)
  if err != nil {
    panic(err)
  }

  // Create an informer from client
  // https://github.com/kubernetes/client-go/blob/kubernetes-1.17.3/informers/factory.go#L97
  // func NewSharedInformerFactory(client kubernetes.Interface, defaultResync time.Duration) SharedInformerFactory
  // Return type: SharedInformerFactory struct (from packege k8s.io/client-go/informers)
  informerFactory := informers.NewSharedInformerFactory(clientset, time.Second*30)

  // https://github.com/kubernetes/client-go/blob/kubernetes-1.17.3/informers/factory.go#L200
  // informerFactory.Core() returns core.Interface (from package k8s.io/client-go/informers/core)

  // https://github.com/kubernetes/client-go/blob/kubernetes-1.17.3/informers/core/interface.go#L29
  // informerFactory.Core().V1() returns v1.Interface (from package k8s.io/client-go/informers/core/v1)
  // v1.Interface interface (https://github.com/kubernetes/client-go/blob/kubernetes-1.17.3/informers/core/v1/interface.go#L26)

  // https://github.com/kubernetes/client-go/blob/kubernetes-1.17.3/informers/core/v1/interface.go#L46
  // informerFactory.Core().V1().Pods() returns podInformer (from package k8s.io/client-go/informers/core/v1)
  // podInformer interface (https://github.com/kubernetes/client-go/blob/kubernetes-1.17.3/informers/core/v1/pod.go#L36)

  // This will inform pod information received from the apiserver.
  podInformer := informerFactory.Core().V1().Pods()

  // https://github.com/kubernetes/client-go/blob/master/tools/cache/shared_informer.go#L163
  // podInformer.Informer() returns cache.SharedIndexInformer
  // SharedIndexInformer interface (https://github.com/kubernetes/client-go/blob/kubernetes-1.17.3/tools/cache/shared_informer.go#L125)

  // AddEventHandler takes ResourceEventHandler as its argument.
  // ResourceEventHandler interface (https://github.com/kubernetes/client-go/blob/kubernetes-1.17.3/tools/cache/controller.go#L180)
  // cache.ResourceEventHandlerFuncs is an adapter of REsourceEventHandler
  // to let you easily specific as many or as few of the notification functions.
  // In other words, you do not have to specify all three functions (AddFunc, DeleteFunc, UpdateFunc).
  
  // Add event handler callbacks that will be called when it receives events.
  podInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
    AddFunc: func(object interface{}) {
      newPod := object.(*v1.Pod)
      fmt.Printf("new Pod added: %v.\n", newPod.GetName())
    },
    DeleteFunc: func(object interface{}) {
      pod := object.(*v1.Pod)
      fmt.Printf("Pod deleted: %v.\n", pod.GetName())
    },
    UpdateFunc: func(old, new interface{}) {
      pod := old.(*v1.Pod)
      fmt.Printf("Pod %v update.\n", pod.GetName())
    },
  })

  // A comment from https://github.com/kubernetes/sample-controller
  // No need to run Start methods in a separate goroutine (i.e. go informerFactory.Start(stopCh))
  // informerFactory.Start method is non-blocking and runs all registered informers in a dedicated goroutine.
  informerFactory.Start(wait.NeverStop)

  // If it an informer, not a controller, so we do not create a controller instance here.
  // Main thread waits forever. Goroutine worker will handle events.
  // Later I will extend this example to a custom controller. At that time, creating a new controller will be here.
  select {}
}
```

```shell
$ go mod init insujang.github.io/sample-pod-informer
go: creating new go.mod: module insujang.github.com/sample-pod-informer

$ GO111MODULE=on go get k8s.io/client-go@kubernetes-1.17.3
go: finding k8s.io kubernetes-1.17.3
go: finding k8s.io/client-go kubernetes-1.17.3
go: downloading k8s.io/client-go v0.17.3
go: extracting k8s.io/client-go v0.17.3

$ go build main.go
...

$ ./main
new Pod added: test-pod.
Pod test-pod update.
Pod test-pod update.
...
```

> Note that I explicitly get client-go library with **version kubernetes-1.17.3**. To enable this we need `GO111MODULE` environment variable as `on`.
> **This is important** that without version specification, go automatically pulls default branch (which current is v11.0.0 that is indicated as incompatible) that cannot be used with current deploying Kubernetes cluster.
>
> **With no version specified you will see errors as follows**:
> ```shell
> $ go mod init insujang.github.io/sample-pod-informer
> $ go build main.go
> go: finding k8s.io/api v0.17.3
> go: finding k8s.io/client-go v11.0.0+incompatible            <- This is the problem
> go: finding k8s.io/apimachinery v0.17.3
> go: downloading k8s.io/api v0.17.3
> go: downloading k8s.io/client-go v11.0.0+incompatible
> ...
>    k8s.io/client-go/rest
> /root/go/pkg/mod/k8s.io/client-go@v11.0.0+incompatible/rest/request.go:598:31: not enough arguments in call to watch.NewStreamWatcher
>         have (*versioned.Decoder)
>         want (watch.Decoder, watch.Reporter)
> ```

# code-generator

To create a **custom controller**, we need to manually implement types, informers, and other helpers, which is burdensome.
Kubernetes team, therefore, provides **code-generator** to create CRD related Go code that can be used to implement a custom controller [^4].
[^2] is actaully an example of code-generator, i.e., contains auto-generated code by code-generator.

Hence, steps for creating a working custom controller in Go are:
1. Prepare some Go files for code generation
2. Get auto-generated Go code with code-generator.
3. Implement a controller logic with the generated code and client-go library.

Unfortunately, at the time of writing this post, tutorials are not perfect [^5] [^6] [^7] [^8]; so I aggregate and summarize them to make a complete example in the post.

Here I create a CRD that same with the one defined in [[the previous post]](/2020-02-11/kubernetes-custom-resource/#creating-an-object-as-custom-resource-based-on-crd).

> In this post, I tried not to post just example code with no explanations; I encountered so many problems using code-generator. I introduce them and understandings I got.

## 1. Prepare some Go files for code generation

### Prerequisites

Install source code of Go packages with the following command.

```shell
$ GO111MODULE=off go get k8s.io/code-generator
package k8s.io/code-generator: build constraints exclude all Go files in /home/insujang/go/src/k8s.io/code-generator
$ cd $GOPATH/src/k8s.io/code-generator; git checkout kubernetes-1.17.3
```
I explicitly change the branch of the repository to `kubernets-1.17.3`, because the master branch uses `client-go@v11.0+incompatible` library, which is not usable with the currently deploying Kubernetes cluster.

> Note that GO111MODULE should be off, so `go get` pulls package sources. The sources are installed in `$GOPATH/src`.

> I use `/home/insujang/go` as `$GOPATH` in this post.

### Write template code

To use code-generator, we should prepare some Go files with tags (i.e. `\\ +tag-name=value`) that indicates some information to code generator. (I do not know how to call these files.. I just call a collection of the files used for code generation as **template files** here.) For more detailed information regarding tags, visit the Openshift tutorial [^5].

The script `generate-groups.sh` that is used for code generation from [[the repository]](https://github.com/kubernetes/code-generator) **requires** prewritten files (`doc.go, register.go, types.go`).
In this substep, I only show how those files should look like; the location of files will be handled in [[step 2]](#2-get-auto-generated-go-code-with-code-generator).

#### doc.go
```go
// +k8s:deepcopy-gen=package
// +groupName=insujang.github.io

package v1beta1
```
code-generator parses comments to know how to generate code.
This example uses group name as `insujang.github.io`, which should be same as the value of `spec.group` in CRD yaml file (refer to [[the previous post]](/2020-02-11/kubernetes-custom-resource/#specifying-a-custom-resource-definition) how CRD yaml should be).
What makes me confused is that this data are all different from example to example; so here I only specifiy minimal and basic information.

If you want to specify different version, for instance, `v1`, for your CRD objects, Go files must be in `/pkg/apis/testresource/v1/` and all Go files must be in `package v1`. If not, auto-generated code would not work (not tested though :/ )

This package value will be your CRD's version. Refer to [[the previous post]](/2020-02-11/kubernetes-custom-resource/#creating-an-object-as-custom-resource-based-on-crd) that we specify `apiVersion` of CRD object as `insujang.github.io/v1beta1`. If you specify version as `v1`, your object creation yaml must contain `apiVersion: insujang.github.io/v1`, not `insujang.github.io/v1beta1`.

#### types.go
```go
package v1beta1

import (
  metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// This const variables are used in our CRD operator and a custom controller.
const (
  GroupName    string = "insujang.github.io"
  Kind         string = "TestResource"
  GroupVersion string = "v1beta1"
  Plural       string = "testresources"
  Singular     string = "testresource"
  Name         string = Plural + "." + GroupName
)

// TestResourceSpec specify the 'spec' in CRD yaml.
type TestResourceSpec struct {
  Command        string `json:"command"`
  CustomProperty string `json:"customproperty"`
}

// +genclient
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// TestResource describes a TestResource resource.
// This will be your custom resource's name used in the generated code.
type TestResource struct {                 
  metav1.TypeMeta `json:",inline"`
  metav1.ObjectMeta `json:"metadata,omitempty"`

  Status TestResourceStatus `json:"status"`
  Spec TestResourceSpec `json:"spec"`
}

// TestResourceStatus is a TestResource resources.
type TestResourceStatus struct {
  Name string
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// TestResourceList is a list of TestResource resources.
// Note that we specified "spec.listKind" in CRD yaml file.
// The following struct refers to it.
type TestResourceList struct {
  metav1.TypeMeta `json:",inline"`
  metav1.ListMeta `json:"metadata"`

  Items []TestResource `json:"items"`
}
```

types.go defines a CRD object and the corresponding list object. Its status and spec are defined together as `TestResourceSpec` and `TestResourceStatus` struct in the code, as specified in [[the previous post](/2020-02-11/kubernetes-custom-resource/#creating-an-object-as-custom-resource-based-on-crd).

Here, you should match the name of struct `TestResource` with our CRD object name `testresource`. The generated code will use this for generating URLs for communication with the apiserver later.

This example uses a custom Status struct `TestResourceStatus`. If you just want to use one string for status, it is not necessary to implement a struct for Status; following code will be enough:
```go
type TestResource struct {
  metav1.TypeMeta `json:",inline"`
  metav1.ObjectMeta `json:"metadata,omitempty"`

  Status string `json:"status"`
  Spec TestResourceSpec `json:"spec"`
}
```

#### register.go

```go
package v1beta1

import (
  metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
  "k8s.io/apimachinery/pkg/runtime"
  "k8s.io/apimachinery/pkg/runtime/schema"
)

// localSchemeBuilder and AddToScheme will stay in k8s.io/kubernetes.
var (
  // SchemeBuilder initializes a scheme builder
  SchemeBuilder = runtime.NewSchemeBuilder(addKnownTypes)
  // AddToScheme is a global function that registers this API group & version to a scheme
  AddToScheme = SchemeBuilder.AddToScheme
)

// SchemeGroupVersion is group version used to register these objects.
var SchemeGroupVersion = schema.GroupVersion{
  Group: GroupName,
  Version: GroupVersion,
}

// Adds the list of known types to api.Scheme.
func addKnownTypes(scheme *runtime.Scheme) error {
  scheme.AddKnownTypes(SchemeGroupVersion,
                       &TestResource{},
                       &TestResourceList{},
                      )
  metav1.AddToGroupVersion(scheme, SchemeGroupVersion)
  return nil
}
```

I do not understand why those variables should be defined as global. Maybe the code generator does inside with it as the comment indicates?

For more detailed understanding for tags (`// +tag-name=value` such as `// +k8s:deepcopy-gen=package`), refer to [^5], [^7], and [^8].

## 2. Get auto-generated Go code with code-generator

My directory structure is as follows.
```shell
/home/insujang $ tree .
.
├── go                                  # gopath
│   └── src
│       └── k8s.io
│           ├── apimachinery            # package source
│           └── code-generator          # package source
└── testresource                        # our template code
    └── v1beta1
        ├── doc.go
        ├── register.go
        └── types.go
```

Three Go template code must be in `<resource_name>/<version>` directory. `<resource_name>` is actually not relevent to your CRD that will be registered to the apiserver, your custom controller will import the generated code which will contain this directory name. So it is recommended to match it with your CRD name.

### Wrong: using relative path for code generation

> **CAUTION: This should not work so you must use a URL to generate code. Following contents are for introducing why it is failed.**

The script `generate-groups.sh` assumes inputs are Go module URLs. At first time, I wanted to use it with Go files in my local system, but the script does not take the absolute path of the directory. **The reason the script accepts relative paths is actually a bug**; as mentioned, the input check mechanism of the script assumes inputs are Go modules URLs, but it only checks whether a dot (.) exists in the first path of the inputs (e.g. github.com contains a dot), which let relative paths be accepted as input arguments (e.g. ./this/is/a/relative/path also contains a dot in the first path).

Below is my trials to make it work (failed anyway) for the purpose of archive, so do not follow it.

Assume we launch the script in working directory `/home/insujang/go/src/k8s.io/code-generator`.
As the relative path of our template from this directory is `../../../../`, you should launch the script as follows:
```shell
/home/insujang/go/src/k8s.io/code-generator $ ./generate-groups.sh all ./output ../../../.. testresource:v1beta1
```
The script internally builds Go binaries (`client-gen, deepcopy-gen, defaulter-gen, informer-gen, lister-gen`) and passes the calculated arguments to them (`../../../..` + `testresource:v1beta1` -> `../../../../testresource/v1beta1`).
Before executing Go binaries, the script changes its current working directory to the directory that the script itself exists, so the Go binaries are launched with the current working directory as `$GOPATH/src/k8s.io/code-generator` and the input argument `../../../../testresource/v1beta1` and output argument `./output`.

Code files are generated in `/home/insujang/go/src/output`:
```shell
$ tree /home/insujang/go/src/output -d
/home/insujang/go/src/output
├── clientset
│   └── versioned
│       ├── fake
│       ├── scheme
│       └── typed
│           └── testresource
│               └── v1beta1
│                   └── fake
├── informers
│   └── externalversions
│       ├── internalinterfaces
│       └── testresource
│           └── v1beta1
└── listers
    └── testresource
        └── v1beta1
```
Here is why files are stored in this directory. For `informer-gen`, for example, the passed input and output arguments are: `../../../../testrsource/v1beta` and `./output/informers`, respectively.
In `$GOPATH/src/k8s.io/code-generator/cmd/informer-gen/main.go`, the variable `genericArgs` is defined as:

```go
import generatorargs "k8s.io/code-generator/cmd/informer-gen/args"

genericArgs, customArgs := generatorargs.NewDefaults()
```

```go
import "k8s.io/gengo/args"

func NewDefaults() (*args.GeneratorArgs, *CustomArgs) {
  genericArgs := args.Default().WithoutDefaultFlagParsing()
  ...
  return genericArgs, customArgs
}
```

The type `args.GeneratorArgs` look like (code from [[gengo Github]](https://github.com/kubernetes/gengo/blob/master/args/args.go#L52)):
```go
type GeneratorArgs struct {
  InputDirs []string
  OutputBase string
  OutputPackagePath string
  OutputFileBaseName string
  GoHeaderFilePath string
  GeneratedByCommentTemplate string
  VerifyOnly bool
  IncludeTestFiles bool
  GeneratedBuildTag string
  CustomArgs interface{}
  defaultCommandLineFlags bool
}
```
where `OutputBase` is defined as `DefaultSourceTree()`, which returns `$GOPATH/src`.
Combined with `OutputPackagePath`, `./output/informers`, for `informer-gen` binary, the output directory is `$GOPATH/src/./output/informers`.

And, not all generated files are in the output directory. `deepcopy-gen` Go binary generates the code named `zz_generated.deepcopy.go` based on **the input directory**.
Similar to `informer-gen`, it calculates the path `OutputBase/InputDirs[0]/OutputFileBaseName`, which will be `/home/insujang/go/src/../../../../testresource/v1beta1/zz_generated.deepcopy.go`, i.e., `/testresource/v1beta1/zz_generated.deepcopy.go`.

To be summarized, the generated files are:

- all files in `$GOPATH/src/<output-directory>` (in the above example, `$GOPATH/src/./output` -> `/home/insujang/go/src/output`)
- `zz_generated.deepcopy.go` in `$GOPATH/src/<name>/<version>/<input-directory>` (in the above example, `$GOPATH/src/../../../../testresource/v1beta1` -> `/testresource/v1beta1`)

Sadly, these generated files cannot be used, since `<input-directory` and `<output-directory>` are embedded into import paths in the generated code.

For example, `output/clientset/clientset.go`:
```go
// Code generated by client-gen. DO NOT EDIT.

package versioned

import (
  insujangv1beta1 "output/clientset/versioned/typed/testresource/v1beta1"
)
...
```

`output/clientset/typed/testresource_client.go`:
```go
package v1beta1

import (
  v1beta1 "../../../../testresource/v1beta1"
)
...
```


### Right: using Go modules for code generation

> There are already many examples using a Go module posted in remote repositories. Actually there is no examples using the generated code as local Go modules...
> I tried to make the code as local Go modules and use them *without a remote repository*.

Now I understand that I should use an URL of Go modules, but what made me annoying is that `generate-groups.sh` keeps try to access the *remote repository* if you use well-known remote repository URL such as `github.com` as a module path:

```shell
F0213 14:35:28.447759   11832 main.go:85] Error: Failed making a parser: unable to add directory "github.com/insujang/test/apis/test/v1": unable to import "github.com/insujang/test/apis/test/v1": go/build: importGo github.com/insujang/test/apis/test/v1: exit status 1
can't load package: package github.com/insujang/test/apis/test/v1: git ls-remote -q origin in /home/insujang/go/pkg/mod/cache/vcs/17cdf13fc91f7befb3cd95cb1700a7065b2eb64d1649d793d8948d32d578b9aa: exit status 128:
        fatal: could not read Username for 'https://github.com': terminal prompts disabled
Confirm the import path was entered correctly.
If this is a private repository, see https://golang.org/doc/faq#git_https for additional information.
```


What I figured out is that we can use another URL for our local Go modules, other than well-known remote repository, then Go binaries do not try to call `git` command.
I use `insujang.github.io` as a URL for my Go modules.

Manually create a Go package tree structure in `$GOPATH` as follows [^9]. In order to make your CRD be used by others, files are in `/pkg`, `/internal` otherwise..

```shell
/home/insujang/go/src $ tree insujang.github.io
insujang.github.io
└── kubernetes-custom-controller-api
    ├── api
    │   └── testresource
    │       └── v1beta1
    │           ├── doc.go
    │           ├── register.go
    │           └── types.go
    └── go.mod
```

Where go.mod is created by `insujang.github.io/kubernetes-custom-controller-api $ go mod init insujang.github.io/kubernetes-custom-controller-api`.

> In [[my informer example]](#example-implementing-an-event-watcher-informer), I imported corev1 from `"k8s.io/api/core/v1"`.
> Similar to this, we can import our custom resource by importing `insujang.github.io/kubernetes-custom-controller-api/api/testresource/v1beta1`.
> The official tutorial [^5] follows the standard Go package by putting it into `/pkg` directory, but I do not understand why `[[Kubernetes API repository]](https://github.com/kubernetes/api) does not follow this rule. So that I followed Kubernete's way.

We create a local module but it is not published, we need to modify `$GOPATH/src/k8s.io/code-generator/go.mod` to make the code generator look at our local Go module [^10]. The replaced path should be match your local Go module path.

```shell
/home/insujang/go/src/k8s.io/code-generator $ go mod edit -replace=insujang.github.io/kubernetes-custom-controller-api=../../insujang.github.io/kubernetes-custom-controller-api
```

Verify whether the following line is added into its `go.mod`:
```shell
/home/insujang/go/src/k8s.io/code-generator $ cat go.mod
...
replace insujang.github.io/kubernetes-custom-controller-api => ../../insujang.github.io/kubernetes-custom-controller-api
```

Now generate the code!

```shell
/home/insujang/go/src/k8s.io/code-generator $ ./generate-groups.sh all insujang.github.io/kubernetes-custom-controller-api/client insujang.github.io/kubernetes-custom-controller-api/api testresource:v1beta1
Generating deepcopy funcs
Generating clientset for testresource:v1beta1 at insujang.github.io/kubernetes-custom-controller-api/client/clientset
Generating listers for testresource:v1beta1 at insujang.github.io/kubernetes-custom-controller-api/client/listers
Generating informers for testresource:v1beta1 at insujang.github.io/kubernetes-custom-controller-api/client/informers
```

### Playing with output directory

The output directory is `insujang.github.io/kubernetes-custom-controller-api/**client**`. Don't understand why it would be **`client`**; Maybe it is not necessarily be... Can we just generate code at `api` diretory at all? So I changed the output directory to `insujang.github.io/kubernetes-custom-controller-api/api`.
The generated code resides in our Go module directory as follows:

```shell
home/insujang/go/src $ tree -L 5 insujang.github.io/kubernetes-custom-controller-api/
insujang.github.io/kubernetes-custom-controller-api/
├── api
│   ├── clientset
│   │   └── versioned
│   │       ├── clientset.go
│   │       ├── doc.go
│   │       ├── fake
│   │       │   ├── clientset_generated.go
│   │       │   ├── doc.go
│   │       │   └── register.go
│   │       ├── scheme
│   │       │   ├── doc.go
│   │       │   └── register.go
│   │       └── typed
│   │           └── testresource
│   ├── informers
│   │   └── externalversions
│   │       ├── factory.go
│   │       ├── generic.go
│   │       ├── internalinterfaces
│   │       │   └── factory_interfaces.go
│   │       └── testresource
│   │           ├── interface.go
│   │           └── v1beta1
│   ├── listers
│   │   └── testresource
│   │       └── v1beta1
│   │           ├── expansion_generated.go
│   │           └── testresource.go
│   └── testresource
│       └── v1beta1
│           ├── doc.go
│           ├── register.go
│           ├── types.go
│           └── zz_generated.deepcopy.go
└── go.mod
```

### One more step: dividing modules

Advancing what I just figured out, now I divide the module into two parts: `insujang:github.io/custom-controller-code-template`, which contains the template code and `zz_generated_deepcopy.go` file, and `insujang.github.io/custom-controller-code-generated`, which contains generated code by code generator.

This should give you *more clear understanding of the generated code*.

```shell
$ cat /home/insujang/go/src/k8s.io/code-generator/go.mod
...
replace insujang.github.io/custom-controller-code-template => ../../insujang.github.io/custom-controller-code-template
```

My module structure before code generation:

```shell
/home/insujang/go/src/insujang.github.io $ tree .
.
└── custom-controller-code-template
    ├── go.mod    # module insujang.github.io/custom-controller-code-template
    └── pkg
        └── apis
            └── testresource
                └── v1beta1
                    ├── doc.go
                    ├── register.go
                    └── types.go
```

My module structure after code generation:

```shell
/home/insujang/go/src/k8s.io/code-generator $ ./generate-groups.sh all insujang.github.io/custom-controller-code-generated/pkg/client insujang.github.io/custom-controller-code-template/pkg/apis testresource:v1beta1
...

/home/insujang/go/src/insujang.github.io $ tree .
.
├── custom-controller-code-generated
│   └── pkg
│       └── client
│           ├── clientset
│           ├── informers
│           └── listers
└── custom-controller-code-template
    ├── go.mod
    └── pkg
        └── apis
            └── testresource
                └── v1beta1
                    ├── doc.go
                    ├── register.go
                    ├── types.go
                    └── zz_generated.deepcopy.go
```

> Note that the module structure above is similar to Kubernetes':
> - `k8s.io/apimachinery/pkg/apis/meta/v1` => `insujang.github.io/custom-controller-code-template/pkg/apis/testresource/v1beta1`
> - `k8s.io/apiextensions-apiserver/pkg/client/clientset/clientset` => `insujang.github.io/custom-controller-code-generated/pkg/client/clientset/versioned`

Of course code-generator does not initialize the generated code as a module. Initialize `custom-controller-code-generate` module as well ():

```shell
/home/insujang/go/src/insujang.github.io/custom-controller-code-generated $ go mod init insujang.github.io/custom-controller-code-generated
```

These Go modules I will use for the next step.

## 3. Implement a CRD operator with the generated code and client-go library

Here I implement a CRD operator (i.e. creates a CRD type and object, gets CRD objects, and watches the changes of CRD objects).

> **Note that from here I use my Github repository code, the structure of which is different from those above.**
>
> ```shell
>/home/insujang/go/src/insujang.github.io/kubernetes-test-controller $ tree -d .
> .
> ├── code-generated
> │   └── pkg
> │       └── client
> │           ├── clientset
> │           │   └── versioned
> │           │       ├── fake
> │           │       ├── scheme
> │           │       └── typed
> │           │           └── testresource
> │           │               └── v1beta1
> │           │                   └── fake
> │           ├── informers
> │           │   └── externalversions
> │           │       ├── internalinterfaces
> │           │       └── testresource
> │           │           └── v1beta1
> │           └── listers
> │               └── testresource
> │                   └── v1beta1
> └── code-template
>     └── pkg
>         └── apis
>             └── testresource
>                 └── v1beta1
> ```

### Register a CRD programatically

In [[the previous post]](/2020-02-11/kubernetes-custom-resource), I introduced how to create a CRD using CLI and a yaml file.
Here, I show you how to create a CRD *programmatically in Go*. This is not a mandatory step and using yaml for creating a CRD is still valid for our custom controller to run (if and only if the definition is same).

The program will be implemented with client-go and auto-generated code that you created in [[2]](#2-get-auto-generated-go-code-with-code-generator).

Create a new module named `crd-operator` in `$GOPATH/src/insujang.github.io/kubernetes-test-controller`.

Initialize module and explicitly get `client-go`. **It is important to explicitly get specific verion of the library**, otherwise Go pulls incompatible library, invoking build errors. Also we use our local modules, so add `replace` statements in the module file to use our generated code.

```shell
/home/insujang/go/src/insujang.github.io/crd-operator $ go mod init insujang.github.io/crd-operator
/home/insujang/go/src/insujang.github.io/crd-operator $ GO111MODULE=on go get k8s.io/client-go@kubernetes-1.17.3
/home/insujang/go/src/insujang.github.io/crd-operator $ go mod edit -replace=insujang.github.io/kubernetes-test-controller/code-template=../kubernetes-test-controller/code-template
/home/insujang/go/src/insujang.github.io/crd-operator $ go mod edit -replace=insujang.github.io/kubernetes-test-controller/code-generated=../kubernetes-test-controller/code-generated
```

Below is the key code for CRD type generation.

```go
import (
  "k8s.io/klog"
  metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
  apiextensions "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1beta1"
  apiextensionsclientset "k8s.io/apiextensions-apiserver/pkg/client/clientset/clientset"
  testresourcev1beta1 "insujang.github.io/kubernetes-test-controller/code-template/pkg/apis/testresource/v1beta1"
)

// Create a CRD and send it to the apiserver.
func CreateCustomResourceDefinition(clientSet apiextensionsclientset.Interface) {
  klog.Infof("Creating a CRD: %s\n", testresourcev1beta1.Name)
  
  crd := &apiextensions.CustomResourceDefinition{
      ObjectMeta: metav1.ObjectMeta {
        Name: testresourcev1beta1.Name,
        Namespace: "default",
      },
      Spec: apiextensions.CustomResourceDefinitionSpec {
        Group: testresourcev1beta1.GroupName,
        Version: testresourcev1beta1.GroupVersion,
        Scope: apiextensions.NamespaceScoped,
        Names: apiextensions.CustomResourceDefinitionNames{
          Plural: testresourcev1beta1.Plural,
          Kind: testresourcev1beta1.Kind,
        },
      },
  }

  _, err := clientSet.ApiextensionsV1beta1().CustomResourceDefinitions().Create(crd)

  if err != nil {
    panic(err)
  }

  klog.Infoln("The CRD created. Need to wait whether it is confirmed.")
}
```

Also, you need to wait an event that the CRD is successfully created from the apiserver. The following code does it:

```go
import (
  "time"

  "k8s.io/klog"
  "k8s.io/apimachinery/pkg/util/wait"
  apiextensions "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1beta1"
  apiextensionsclientset "k8s.io/apiextensions-apiserver/pkg/client/clientset/clientset"
  testresourcev1beta1 "insujang.github.io/kubernetes-test-controller/code-template/pkg/apis/testresource/v1beta1"
)

// Wait for CRD creation event.
func WaitCustomResourceDefinition(apiClientSet apiextensionsclientset.Interface) {
  klog.Infof("Waiting for a CRD to be created: %s\n", testresourcev1beta1.Name)

  err := wait.Poll(1*time.Second, 30*time.Second, func()(bool, error) {
    // get CRDs by name
    crd, err := apiClientSet.ApiextensionsV1beta1().CustomResourceDefinitions().Get(testresourcev1beta1.Name, metav1.GetOptions{})
    if err != nil {
      panic(err)
    }

    for _, condition := range crd.Status.Conditions {
      if (condition.Type == apiextensions.Established && condition.Status == apiextensions.ConditionTrue) {
        // CRD successfully created.
        klog.Infoln("Confirmed that the CRD successfully created.")
        return true, err
      } else if (condition.Type == apiextensions.NamesAccepted && condition.Status == apiextensions.ConditionFalse) {
        klog.Fatalf("Name conflict while wait for CRD creation: %s, %v\n", condition.Reason, err)
      }
    }

    return false, err
  })
  if err != nil {
    panic(err)
  }
}
```

### Create a CRD programmatically

When the CRD type is created, you can create a CRD **object**.

```go
import (
  "k8s.io/klog"
  testresourceclientset "insujang.github.io/custom-controller-code-generated/pkg/client/clientset/versioned"
  testresourcev1beta1 "insujang.github.io/custom-controller-code-template/pkg/apis/testresource/v1beta1"
)

func CreateCustomResourceDefinitionObject(clientSet testresourceclientset.Interface) {
  object_name := "example-testresource"
  klog.Infof("Creating a CRD object: %s\n", object_name)

  exampleInstance := &testresourcev1beta1.TestResource {
    ObjectMeta: metav1.ObjectMeta {
      Name: object_name,
    },
    Spec: testresourcev1beta1.TestResourceSpec {
      Command: "Hello Kubernetes CRD!",
      CustomProperty: "thisshouldmatchwiththisstring",
    },
    Status: testresourcev1beta1.TestResourceStatus {
      Name: "Pending",
    },
  }

  _, err := clientSet.InsujangV1beta1().TestResources("default").Create(exampleInstance)
  if err != nil {
    panic(err)
  }
  klog.Infoln("The CRD object is created.")
}
```

This `Create()` function is an auto-generated by code-generator, which is defined in `code-generated/pkg/client/clientset/typed/testresource.go`.
Default CRUDs are all generated (`Create, Update, Delete, Get, List, Watch, etc`) so that we simply use them.

> If you decided to make Status as a string, not a struct, the definition of TestResource would be:
> ```go
> exampleInstance := &testresourcev1beta1.TestResource {
>     ObjectMeta: metav1.ObjectMeta {
>       Name: object_name,
>     },
>     Spec: testresourcev1beta1.TestResourceSpec {
>       Command: "Hello Kubernetes CRD!",
>       CustomProperty: "thisshouldmatchwiththisstring",
>     },
>     Status: "Pending",
>   }
> ```

### Get CRD objects

The list of CRD objects are defined as `TestResourceList` (we defined it in `code-template/pkg/apis/testsource/v1beta1/types.go` :) )

```go
// TestResourceList is a list of TestResource resources.
// Note that we specified "spec.listKind" in CRD yaml file.
// The following struct refers to it.
type TestResourceList struct {
  metav1.TypeMeta `json:",inline"`
  metav1.ListMeta `json:"metadata"`

  Items []TestResource `json:"items"`
}
```

Use `Get()` function to get the list of CRD objects.

```go
func ListCustomResourceDefinitionObjects(clientSet testresourceclientset.Interface) *testresourcev1beta1.TestResourceList {
  list, err := clientSet.InsujangV1beta1().TestResources("default").List(metav1.ListOptions{})
  if err != nil {
    panic(err)
  }
  return list
}
```

### Watch CRD objects

Finally, we can implement an event watcher (informer), not for Pod, but for our custom resource.

```go

import (
  "time"

  "k8s.io/klog"
  testresourcev1beta1 "insujang.github.io/kubernetes-test-controller/code-template/pkg/apis/testresource/v1beta1"
  testresourceclientset "insujang.github.io/kubernetes-test-controller/code-generated/pkg/client/clientset/versioned"
  testresourceinformers "insujang.github.io/kubernetes-test-controller/code-generated/pkg/client/informers/externalversions"
  "k8s.io/client-go/tools/cache"
)

func WatchCustomResourceObjects(clientSet testresourceclientset.Interface) {
  klog.Infoln("Adding an event handler for CRD objects.")
  
  informerFactory := testresourceinformers.NewSharedInformerFactory(clientSet, time.Second*30)
  testresourceInformer := informerFactory.Insujang().V1beta1().TestResources()

  testresourceInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
    AddFunc: func(object interface{}) {
      newResource := object.(*testresourcev1beta1.TestResource)
      klog.Infof("new TestResource added: %s\n", newResource.GetName())
    },
    DeleteFunc: func(object interface{}) {
      resource := object.(*testresourcev1beta1.TestResource)
      klog.Infof("TestResource %s deleted.\n", resource.GetName())
    },
  })

  informerFactory.Start(wait.NeverStop)

  // Main thread waits forever here
  select{}
}
```

Note that this would not be built; showing unexpected errors from the generated code:
```shell
go build main.go
  insujang.github.io/kubernetes-test-controller/code-generated/pkg/client/listers/testresource/v1beta1
../code-generated/pkg/client/listers/testresource/v1beta1/testresource.go:91:34: undefined: v1beta1.Resource
root@DESKTOP-XLTLXSS:/home/insujang/go/src/insujang.github.io/kubernetes-test-controller/crd-operator# go build main.go
  insujang.github.io/kubernetes-test-controller/code-generated/pkg/client/listers/testresource/v1beta1
../code-generated/pkg/client/listers/testresource/v1beta1/testresource.go:91:34: undefined: v1beta1.Resource
```

Now I understand why we have to add the definition of `Resource()` function in `code-template/pkg/apis/testresource/v1beta1/register.go` (some examples contain the function but I do not understand why it exists due to lack of explanation).
So we add a function to `code-template/pkg/apis/testresource/v1beta1/register.go`:

```go
// Resource takes an unqualified resource and returns a Group qualified GroupResource.
// It is used by the generated code listers.
func Resource(resource string) schema.GroupResource {
  return SchemeGroupVersion.WithResource(resource).GroupResource()
}
```

```shell
...
0214 13:44:59.249026   23889 main.go:121] new TestResource added: example-testresource
```

Now we can receive events about changes of our CRD objects from the apiserver.

The fully implemented code prints the following messages. You can see the code in [[here]](https://github.com/insujang/kubernetes-test-controller).

```shell
I0214 13:44:58.192788   23889 main.go:27] Creating a CRD: testresources.insujang.github.io
I0214 13:44:58.210999   23889 main.go:51] The CRD created. Need to wait whether it is confirmed.
I0214 13:44:58.211013   23889 main.go:56] Waiting for a CRD to be created: testresources.insujang.github.io
I0214 13:44:59.227611   23889 main.go:68] Confirmed that the CRD successfully created.
I0214 13:44:59.227645   23889 main.go:84] Creating a CRD object: example-testresource
I0214 13:44:59.240627   23889 main.go:103] The CRD object is created.
I0214 13:44:59.246328   23889 main.go:169] [0] Found CRD object: {
  "kind": "TestResource",
  "apiVersion": "insujang.github.io/v1beta1",
  "metadata": {
    "name": "example-testresource",
    "namespace": "default",
    "selfLink": "/apis/insujang.github.io/v1beta1/namespaces/default/testresources/example-testresource",
    "uid": "9fd41f07-bb89-4bfa-b443-2557b92f7664",
    "resourceVersion": "2044581",
    "generation": 1,
    "creationTimestamp": "2020-02-14T04:44:59Z"
  },
  "status": "Pending",
  "spec": {
    "command": "Hello Kubernetes CRD!",
    "customproperty": "thisshouldmatchwiththisstring"
  }
}
I0214 13:44:59.249026   23889 main.go:121] new TestResource added: example-testresource
```



## 4. Implement a custom controller with the generated code and client-go library

The implementation of [sample controller](https://github.com/kubernetes/sample-controller/blob/master/controller.go) is soooo great and clearly understandable that I do not have much things to explain.

Let us review [[the diagram]](#diagram). We implemented a resource event handler in informer implementation, but (7), (8), and (9) are missing, which are roles of a controller.
On top of the informer code, we need to work queue operations, objects handling operations, and indexer related operations.
Here, the corresponding code for (7), (8), and (9) is explained.

The structure of our custom controller looks like:
```go
import (
  "k8s.io/client-go/kubernetes"
  "k8s.io/client-go/util/workqueue"
  "k8s.io/client-go/tools/cache"
  "k8s.io/client-go/tools/record"
  testresourceclientset "insujang.github.io/kubernetes-test-controller/code-generated/pkg/client/clientset/versioned"
  testresourcelisters "insujang.github.io/kubernetes-test-controller/code-generated/pkg/client/listers/testresource/v1beta1"
)

type TestResourceController struct {
  kubernetesClient kubernetes.Interface
  testresourceClient testresourceclientset.Interface
  workqueue workqueue.RateLimitingInterface
  informer cache.SharedIndexInformer
  lister testresourcelisters.TestResourceLister
  recorder record.EventRecorder
}
```

Each entry will be used and explained in each subchapter.

### (7) Enqueue object key

In [[the informer code]](#example-implementing-an-event-watcher-informer), we just print information that we received. In controller, instead, our event handler implementation should eneueue the object into custom controller's **queue**. For this, we have to create a queue first.
`workqueue` (type: `workqueue.RateLimitingInterface`) in our custom controller is **the queue** that we use for this purpose.

```go
func CreateCustomController(...) *TestResourceController {
  queue := workqueue.NewRateLimitingQueue(workqueue.DefaultControllerRateLimiter())
  ...
  return &TestResourceController {
    ...
    workqueue: queue,
  }
}
```

And the event handler adds an object key when it receives events.

```go
import (
  "k8s.io/klog"
  testresourceinformers "insujang.github.io/kubernetes-test-controller/code-generated/pkg/client/informers/externalversions"
  testresourcelisters "insujang.github.io/kubernetes-test-controller/code-generated/pkg/client/listers/testresource/v1beta1"
)

func CreateCustomController(..., informerFactory testresourceinformers.SharedInformerFactory) *TestResourceController {
  ...
  testresourceInformer := informerFactory.Insujang().V1beta1().TestResources()
  testresourceInformer.Informer().AddEventHandler(cache.ResourceHandlerFuncs{
    AddFunc: func(object interface{}) {
      // key looks like: "namespace/name"
      key, err := cache.MetaNamespaceKeyFunc(object)
      if err == nil {
        // add the key to the queue.
        klog.Infof("TestResource added: %s\n", key)
        queue.Add(key)
      }
    },
    UpdateFunc: func(oldObject, newObject interface{}) {
      key, err := cache.MetaNamespaceKeyFunc(newObject)
      if err == nil { 
        klog.Infof("TestResource updated: %s\n", key)
        queue.Add(key)
      }
    },
    DeleteFunc: func(object interface{}) {
      // DeletionHandlingMetanamespaceKeyFunc is a helper function that allows
      // us to check the DeletedFinalSTateUnknwon existence in the event that
      // a resource was deleted but it is still contained in the index.
      // Source: https://github.com/trstringer/k8s-controller-core-resource/blob/master/main.go#L94
      key, err := cache.DeletionHandlingMetaNamespaceKeyFunc(object)
      if err != nil {
        klog.Infof("TestResource deleted: %s\n", key)
        queue.Add(key)
      }
    }
  })

  return &TestResourceController {
    ...
    informer: testresourceInformer.Informer(),
    lister: testresourceInformer.Lister()
  }
}
```



### (8) Get key and process items and (9) Get object for key

The sample controller uses workers running several threads that handle work items for efficiency. I'm not sure it is necessary, but definitely agree that it is a great approach. Hence I also follow this architecture.

First implement a worker function.

```go
import (
  "k8s.io/klog"
  utilruntime "k8s.io/apimachinery/pkg/util/runtime"
)

func (controller* TestResourceController) runWorker() {
  for controller.processNextWorkItem() {}
}

func (controller* TestResourceController) processNextWorkItem() bool {
  // This is step 8: Get a key.
  object, shutdown := controller.workqueue.Get()

  if shutdown {
    return false
  }

  var key string
  var ok bool
  if key, ok = object.(string); !ok {
    controller.workqueue.Forget(object)
    utilruntime.HandleError(fmt.Errorf("Expected string but got %#v", object))
    return false
  }

  err := func(key string) error {
    // We can Done() here so the workqueue knows
    // we have finished processing this item.
    // Call Forget() if we do not want this work item being re-queued.
    defer controller.workqueue.Done(key)

    // Run the syncHandler.
    if err := controller.syncHandler(key); err != nil {
      // Put the item back on the workqueue to handle any transient errors.
      controller.workqueue.AddRateLimited(key)
      return fmt.Errorf("Error syncing '%s': %s, requeueing", key, err.Error())
    }

    // Finally, if no error occurs we Forget this item.
    controller.workqueue.Forget(key)
    klog.Infof("Successfully synced '%s'", key)
    return nil
  }(key)

  if err != nil {
    utilruntime.HandleError(err)
    return true
  }

  return true
}

// syncHandler compares the actual state with the desired,
// and attempts to converge the two.
// It then updates the Status block of the TestResource
// with the current status of the resource.
func (controller *TestResourceController) syncHandler(key string) error {
  namespace, name, err := cache.SplitMetaNamespaceKey(key)
  if err != nil {
    utilruntime.HandleError(fmt.Errorf("Invalid resource key: %s", key))
    return nil
  }

  // Get the TestResource. This is step 9.
  testresource, err := controller.lister.TestResources(namespace).Get(name)
  if err != nil {
    if errors.IsNotFound(err) {
      utilruntime.HandleError(fmt.Errorf("'%s' in work queue no longer exists", key))
      return nil
    }

    return nil
  }

  // Do something here to change fields of the resource...
  // e.g. create a Pod, or some another CRD object, etc.
  // Here we only update "Status" field of the CRD object.
  if testresource.Status == "Controlled" {
    return nil
  }
  // NEVER modify objects directly (it is in read-only local cache.)
  // We use DeepCopy() and modify this copy.
  resourceCopy := resource.DeepCopy()
  resourceCopy.Status = "Controlled"
  _, err = controller.testresourceClient.InsujangV1beta1().TestResources("default").Update(resourceCopy)
  if err != nil {
    // https://github.com/kubernetes/client-go/blob/master/tools/record/event.go#L100
    // argument type: runtime.Object, eventtype, reason, message
    controller.recorder.Event(resource, corev1.EventTypeNormal, "controlled", "This is a message")
  }
  return err
}

func (controller* TestResourceController) Run(threadiness int, stopCh <- chan struct{}) {
  // Called when the function reaches end.
  defer utilruntime.HandleCrash()
  defer controller.workqueue.ShutDown()

  klog.Infoln("Waiting for informer caches to sync.")
  if ok := cache.WaitForCacheSync(stopCh, controller.informer.HasSynced); !ok {
    klog.Fatalln("Failed to wait for caches to sync.")
  }

  for i := 0; i < threadiness; i++ {
    go wait.Until(controller.runWorker, time.Second*5, stopCh)
  }
  
  klog.Infoln("Started TestResource controller.")	
  <-stopCh
  klog.Infoln("Shutting down workers.")
}
```

First, ignore the `Event()` function call at line 89. This will be explained in the next subsection.

- **`processNextWorkItem()` is called for every item in the queue by a worker** (line 101). It first checks whether the item got from the queue is a valid item (line 18~24), run `syncHandler()` that is an actual object handling function in our custom controller (line 33), and remove it from the queue (line 40, without `Forget()` call, the item will be automatically re-enqueued.).
> Note that the workqueue works as follows:
1. We dequeue an object by calling `object, _ := workqueue.Get()`.
2. If we complete handling the object, we must call `workqueue.Done(object)`. Our implementation always calls it by `defer controller.workqueue.Done(object)`.
3. The workqueue check whether `workqueue.Forget(object)` is called for the object. If not, the workqueue automatically enqueues the item.
4. If we call `workqueue.Forget(object)` before calling `workqueue.Done(object)`, object handling for `object` is done.
- **`syncHandler()` is an actual object handing function in our custom controller**. In this example our handler only checks whether the `status` is in our desired status: `Controlled`. And If not, change the object `Status`.
- **`controller.testresourceClient.InsujangV1beta1().TestResources("default").Update(resourceCopy)` does update our CRD object in the etcd through the apiserver**. We modified `Status` from `Pending` to `Controlled` (line 83~85).
`$ kubectl get testresources example-testresource` will print the output after changing the stauts:
```shell
$ kubectl describe testresources example-testresource
Name:         example-testresource
Namespace:    default
Labels:       <none>
Annotations:  <none>
API Version:  insujang.github.io/v1beta1
Kind:         TestResource
Metadata:
  Creation Timestamp:  2020-02-17T00:49:16Z
  Generation:          3
  Resource Version:    2575394
  Self Link:           /apis/insujang.github.io/v1beta1/namespaces/default/testresources/example-testresource
  UID:                 21478d48-d191-42a8-ad03-e4bf3bc3a2dd
Spec:
  Command:         Hello Kubernetes CRD!
  Customproperty:  thisshouldmatchwiththisstring
Status:            Controlled                            <-- This is what we changed
Events:
  Type    Reason      Age                From                     Message
  ----    ------      ----               ----                     -------
  Normal  controlled  36s                testresource-controller  This is a message <-- This is an event that we pushed at line 89.
```

for `stopCh`, an argument for `Run()` function, refer to [[this]](https://github.com/kubernetes/sample-controller/blob/master/pkg/signals/signal.go).

### Another step: Post an event

`$ kubectl get testresources example-testresource` prints `Events`.
An event entry is added by our custom controller `testresource-controller` with line 89.
This is not necessary (so that it is not illustrated in the diagram), but would be helpful for cluster managers to see what happens in this object by the custom controller.


[^1]: [client-go demo Pod informer](https://github.com/nelvadas/podinformer)
[^2]: [Kubernetes sample-controller](https://github.com/kubernetes/sample-controller)
[^3]: [Stay informed with Kubernetes Informers](https://www.firehydrant.io/blog/stay-informed-with-kubernetes-informers/)
[^4]: [Kubernetes code-generator](https://github.com/kubernetes/code-generator)

[^5]: [Kubernetes Deep Dive: Code Generation for CustomResources](https://blog.openshift.com/kubernetes-deep-dive-code-generation-customresources/)
[^6]: [How to write Kubernetes custom controllers in Go](https://medium.com/speechmatics/how-to-write-kubernetes-custom-controllers-in-go-8014c4a04235)
[^7]: [How to generate client code for Kubernetes Custom Resource Definitions (CRD)](https://itnext.io/how-to-generate-client-code-for-kubernetes-custom-resource-definitions-crd-b4b9907769ba)
[^8]: [Extending Kubernetes: Create Controllers for Core and Custom Resources](https://medium.com/@trstringer/create-kubernetes-controllers-for-core-and-custom-resources-62fc35ad64a3)
[^9]: [Golang Standard: Project layout](https://github.com/golang-standards/project-layout)
[^10]: [Intro to Modules on Go - Part 1](https://dev.to/prassee/intro-to-modules-on-go-part-1-1k77)