---
layout: post
title: Implementing Kubernetes C++ Client Library using Go Client Library
date: 2019-11-28 21:09
category: 
author: Insu Jang
tags: [study, go]
summary: 
---

# Linking Go and C

Since Go 1.5, Go supports packaging Go codes into a shared or static library, which can be linked in C programs [^1].

```go
package main	// buildmode=[c-archive|c-shared] requires exactly one main package

import "C"
import "fmt"

//export hello
func hello(name string) {
	fmt.Printf("Hello from Go, %s!\n", name);
}

func main() {}
```

```shell
# as c-shared library
go build -buildmode=c-shared -o libtest.so test.go
```

```shell
# as c-archive(static) library
go build -buildmode=c-static -o libtest.a test.go
```

With the command above, [cgo](https://golang.org/cmd/cgo/) automatically generates a header file and a library file:

```shell
$ ls
libtest.a  libtest.h  test.go
```

```c++
#include <iostream>
#include <string.h>
#include "libtest.h"

int main() {
    std::cout << "This is a cpp application calling a Go function." << std::endl;
    GoString name = {"insu", strlen("insu")};
    hello(name);
    return 0;
}
```

Now link the library to the c++ code above:

```shell
g++ -o test test.cpp -L. -ltest -lpthread
```

> When you use a static library (libtest.a), you need to explicitly link pthread library.

```
$ ./test 
This is a cpp application calling a Go function.
Hello from Go, insu!
```

# Incorporating with CMake

Using CMake and Go is quite wired; Go build system supports out-of-source build and cross-platform build that CMake would also aims. Here, I would like to use CMake to make a build system for a program implemented by *both* Go and C++. Luckily, we do not have to take care of Go workspace hierarchy since we only use `go build` command.

> To understand how go build system works, refer to this [^2].
>
> I am not familiar with how CMake works yet, so please leave a comment if a better solution exists. Thank you.

```cmake
cmake_minimum_required(VERSION 3.0)
project(test)

set(TARGET_OUT test.out)
set(TARGET_LIB test.lib)

# Go configurations

set(GO_SRCS
  test.go)
set(GO_LIBNAME libtest.a)

# Custom command for 'go build -buildmode=c-archive ...'
# to create a library from Go codes.
add_custom_command(OUTPUT ${GO_LIBNAME}
  DEPENDS ${GO_SRCS}
  WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
  COMMAND env go build -buildmode=c-archive
  -o "${CMAKE_CURRENT_BINARY_DIR}/${GO_LIBNAME}"
  ${CMAKE_GO_FLAGS} ${GO_SRCS}
  COMMENT "Building Go library")

# Add a custom target for the library.
add_custom_target(${TARGET_LIB} DEPENDS ${GO_LIBNAME})

# C++ configurations

set(CPP_SRCS
  test.cpp)

# A library and a header are generated in the binary directory.
include_directories(${CMAKE_CURRENT_BINARY_DIR})
link_directories(${CMAKE_CURRENT_BINARY_DIR})

add_executable(${TARGET_OUT} ${CPP_SRCS})
add_dependencies(${TARGET_OUT} ${TARGET_LIB})
target_link_libraries(${TARGET_OUT} test pthread)
```

Now build a program out of source directory..
```shell
$ mkdir build && cd build && cmake .. && make
-- The C compiler identification is GNU 7.4.0
-- The CXX compiler identification is GNU 7.4.0
-- Check for working C compiler: /usr/bin/cc
-- Check for working C compiler: /usr/bin/cc -- works
-- Detecting C compiler ABI info
-- Detecting C compiler ABI info - done
-- Detecting C compile features
-- Detecting C compile features - done
-- Check for working CXX compiler: /usr/bin/c++
-- Check for working CXX compiler: /usr/bin/c++ -- works
-- Detecting CXX compiler ABI info
-- Detecting CXX compiler ABI info - done
-- Detecting CXX compile features
-- Detecting CXX compile features - done
-- Configuring done
-- Generating done
-- Build files have been written to: <path>
Scanning dependencies of target test.lib
[ 33%] Building Go library
[ 33%] Built target test.lib
Scanning dependencies of target test.out
[ 66%] Building CXX object CMakeFiles/test.out.dir/test.cpp.o
[100%] Linking CXX executable test.out
[100%] Built target test.out

$ ./test.out
This is a cpp application calling a Go function.
Hello from Go, insu!
```

# Implement C++ Shim Layer with Kubernetes Go Library

Now the basic step is done. Let's move into Kubernetes area.

For a test, clone Client-go library and execute it[^3].

> I'm using microk8s for tests.

```shell
$ cd create-update-delete-deployment
$ go build -o ./app
$ ./app -kubeconfig=/var/snap/microk8s/current/credentials/client.config
Creating deployment...
Created deployment "demo-deployment".
-> Press Return key to continue.

Updating deployment...
Updated deployment...
-> Press Return key to continue.

Listing deployments in namespace "default":
 * demo-deployment (1 replicas)
-> Press Return key to continue.

Deleting deployment...
Deleted deployment.
```

Works like a charm. Now imitate the example `main.go` to create a C++ interface.

```go
package main	// buildmode=[c-archive|c-shared] requires exactly one main package

import "C"

import (
  "fmt"
  "encoding/json"

  appsv1 "k8s.io/api/apps/v1"
  apiv1 "k8s.io/api/core/v1"
  metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
  "k8s.io/client-go/kubernetes"
  "k8s.io/client-go/tools/clientcmd"
)

//export createPod
func createPod() int {
  var kubeconfig string = "/var/snap/microk8s/current/credentials/client.config"
  config, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
  if err != nil {
    panic(err)
  }
  clientset, err := kubernetes.NewForConfig(config)
  if err != nil {
    panic(err)
  }

  deploymentsClient := clientset.AppsV1().Deployments(apiv1.NamespaceDefault)
  deployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name: "demo-deployment",
		},
		Spec: appsv1.DeploymentSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{
					"app": "demo",
				},
			},
			Template: apiv1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{
						"app": "demo",
					},
				},
				Spec: apiv1.PodSpec{
					Containers: []apiv1.Container{
						{
							Name:  "web",
							Image: "nginx:1.12",
							Ports: []apiv1.ContainerPort{
								{
									Name:          "http",
									Protocol:      apiv1.ProtocolTCP,
									ContainerPort: 80,
								},
							},
						},
					},
				},
			},
		},
  }
  
  fmt.Println("Creating deployment...")
  result, err := deploymentsClient.Create(deployment)
  if err != nil {
    panic(err)
  }
  fmt.Printf("Created deployment %q.\n", result.GetObjectMeta().GetName())

  return 0
}

//export getPodsList
func getPodsList() *C.char {
  var kubeconfig string = "/var/snap/microk8s/current/credentials/client.config"
  config, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
  if err != nil {
    panic(err)
  }
  clientset, err := kubernetes.NewForConfig(config)
  if err != nil {
    panic(err)
  }

  deploymentsClient := clientset.AppsV1().Deployments(apiv1.NamespaceDefault)
  fmt.Printf("Listing deployments in namespace %q:\n", apiv1.NamespaceDefault)
  list, err := deploymentsClient.List(metav1.ListOptions{})
  if err != nil {
		panic(err)
	}
	for _, d := range list.Items {
		fmt.Printf(" * %s (%d replicas)\n", d.Name, *d.Spec.Replicas)
  }
  
  json, _ := json.Marshal(list.Items)
  json_string := string(json)
  return C.CString(json_string);
}

func main() {}
```

```cpp
#include <iostream>
#include <stdlib.h>
#include "libtest.h"

int main() {
    // createPod();
    char* pods = getPodsList();
    std::cout << pods << std::endl;
    free(pods);
    return 0;
}
```

The result comes from Go code, printed in C++.

```
$ ./test.out
Listing deployments in namespace "default":
 * demo-deployment (1 replicas)
[
  {
    "metadata": {
      "name": "demo-deployment",
      "namespace": "default",
      "selfLink": "/apis/apps/v1/namespaces/default/deployments/demo-deployment",
      "uid": "616346d4-7d52-40b6-a7dc-5de0e7d7d42f",
      "resourceVersion": "17555",
      "generation": 1,
      "creationTimestamp": "2019-11-28T15:27:49Z",
      "annotations": {
        "deployment.kubernetes.io/revision": "1"
      }
    },
    "spec": {
      "replicas": 1,
      "selector": {
        "matchLabels": {
          "app": "demo"
        }
      },
      "template": {
        "metadata": {
          "creationTimestamp": null,
          "labels": {
            "app": "demo"
          }
        },
        "spec": {
          "containers": [
            {
              "name": "web",
              "image": "nginx:1.12",
              "ports": [
                {
                  "name": "http",
                  "containerPort": 80,
                  "protocol": "TCP"
                }
              ],
              "resources": {},
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File",
              "imagePullPolicy": "IfNotPresent"
            }
          ],
          "restartPolicy": "Always",
          "terminationGracePeriodSeconds": 30,
          "dnsPolicy": "ClusterFirst",
          "securityContext": {},
          "schedulerName": "default-scheduler"
        }
      },
      "strategy": {
        "type": "RollingUpdate",
        "rollingUpdate": {
          "maxUnavailable": "25%",
          "maxSurge": "25%"
        }
      },
      "revisionHistoryLimit": 10,
      "progressDeadlineSeconds": 600
    },
    "status": {
      "observedGeneration": 1,
      "replicas": 1,
      "updatedReplicas": 1,
      "readyReplicas": 1,
      "availableReplicas": 1,
      "conditions": [
        {
          "type": "Available",
          "status": "True",
          "lastUpdateTime": "2019-11-28T15:27:51Z",
          "lastTransitionTime": "2019-11-28T15:27:51Z",
          "reason": "MinimumReplicasAvailable",
          "message": "Deployment has minimum availability."
        },
        {
          "type": "Progressing",
          "status": "True",
          "lastUpdateTime": "2019-11-28T15:27:51Z",
          "lastTransitionTime": "2019-11-28T15:27:49Z",
          "reason": "NewReplicaSetAvailable",
          "message": "ReplicaSet \"demo-deployment-6f7656cc59\" has successfully progressed."
        }
      ]
    }
  }
]
```

[^1]: Sharing Golang packages to C and Go: [http://blog.ralch.com/tutorial/golang-sharing-libraries/](http://blog.ralch.com/tutorial/golang-sharing-libraries/)

[^2]: How to Write Go Code: [https://golang.org/doc/code.html](https://golang.org/doc/code.html)

[^3]: Go client for Kubernetes: [https://github.com/kubernetes/client-go](https://github.com/kubernetes/client-go)