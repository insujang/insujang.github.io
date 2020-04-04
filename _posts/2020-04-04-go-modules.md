---
layout: post
title: "Go Modules: an Alternative to GOPATH for Package Distribution"
date: 2020-04-04 19:27
category: 
author: Insu Jang
tags: [study, go]
summary: 
---

This post introduces Go modules, introduced in Go version 1.11.

# Go Modules?

Go 1.11 introduces a new dependency mangement system, *Go modules* (That's why Go uses the environment variable name `GO111MODULE`: indicating to use Go 1.11 module).

Google introduced Go module as *an alternative to GOPATH for versioning and package distribution*. At first I did not understand what does it means specifically. Here is my explanaion.

# Importing Packages without Go Modules

Go programmers can import third-party packages (i.e. libraries in C/C++) in their programs. For example, you can use Google's comparison package `github.com/google/go-cmp/cmp` as:

```go
package main

import "fmt"
import "github.com/google/go-cmp/cmp"

func main() {
  fmt.Println(cmp.Diff("Hello World", "Hello Go"))
}
```

Without Go module enabled, the module `go-cmp` should be in `GOPATH`, so that Go build system knows where the imported packages are [^gocodegopath].

`GOPATH` has a hierarchical directory structure. It is called *Go Workspace*.

```
$GOPATH
  bin/                       # Directory where executable binaries are stored
  src/                       # Directory where Go source files of the dependent packages are stored
    github.com/google/go-cmp/
      ...
  pkg/                       # Directory where compiled Go object files are stored
    ...
```

Here is an example of GOPATH structure:
```shell
$ docker run -it golang:1.13 /bin/bash
$ GO111MODULE=off go get github.com/google/go-cmp/cmp
$ tree -d -L 5 $GOPATH   # assume tree is installed
/go
|-- bin
|-- pkg/linux_amd64/github.com/google/go-cmp
`-- src/github.com/google/go-cmp/cmp
```

> `GO111MODULE=off` indicates Go runtime to use legacy GOPATH mode, not Go module. Hence, `go get` will download `github.com/google/go-cmp/cmp` package following the legacy GOPATH mode.
> Note: legacy versions of golang Dockerfile are being deleted from Docker hub. In the future, Go may no longer support GO111MODULE for compatibility in the future.

## Why we have to know this? It is obsolete.

This is because you are still using GOPATH, and should know differences how we use `GOPATH` now and how we *used `GOPATH` for packages in the past*.

What Google said when they released Go 1.11 is:
> This release adds preliminary support for a new concept called “modules,” **an alternative to GOPATH** with integrated support for versioning and package distribution.
>
> *[Go 1.11 is released.](https://blog.golang.org/go1.11) August 24, 2018*

But you can find out that you are still using `GOPATH` even with Go module enabled:

```
$ GO111MODULE=on go get github.com/google/go-cmp/cmp
$ tree -d -L 5 $GOPATH
/go
`-- pkg
    |-- mod
    |   |-- cache
    |   |   `-- download
    |   |       |-- github.com
    |   |       |-- golang.org
    |   |       `-- sumdb
    |   `-- github.com
    |       `-- google
    |           `-- go-cmp@v0.4.0
    `-- sumdb
        `-- sum.golang.org
```

The structure is different from that without Go module enabled, but Go runtime still downloads files in `$GOPATH`.

# What Changed Exactly for Package Management

As mentioned above, Go runtime still *does* use `$GOPATH` as a download directory of Go packages. To make the Google's saying correct, Go module **does not entirely replace** `GOPATH`, but replaces `GOPATH` **for version control and package distribution**.

> Regarding version control, please refer to [^versioning].

For package distribution, what Go module contributed is that **Go projects are no longer confined to GOPATH**, if it is a Go module.

## Go projects were required to be in `$GOPATH` without Go module

### Working Scenario: Go project with one package, outside `$GOPATH`

Prior to Go 1.11, All projects, not just dependent packages, must be in `GOPATH` directory. For example, I am implementing a project named `testproject`, with one package `main` with two files `main.go` and `test_func.go` as follows:

main.go:
```go
package main

func main() {
        TestFunc()
}
```

test_func.go:
```go
package main

import "k8s.io/klog"

func TestFunc() {
        klog.Infoln("Hello Go Modules!")
}
```

```shell
$ GO111MODULE=off go get k8s.io/klog
$ GO111MODULE=off go run .
I0404 14:58:55.589292    1445 test_func.go:6] Hello Go Modules!
```

Surprisingly, it runs, even the project is **outside `$GOPATH`**. The reason all projects must be in `$GOPATH` is subpackages. One `main` package is not the case, so that it is not confined by this limitation.

### Problematic Scenario: Go project with more than one packages, outside `$GOPATH`
Let's modify it to have one subpackage `test`:

```
$ tree testproject
testproject
|-- main.go
`-- test
    `-- func.go
```

main.go:
```go
package main

import "XXX"

func main() {
        XXX.TestFunc()
}
```

test/func.go:
```go
package test

import "k8s.io/klog"

func TestFunc() {
        klog.Infoln("Hello Go Modules!")
}
```

### Solution for Problem: Move Go project into `$GOPATH`
Without Go module, We cannot specify our `test` package in `main` package. We cannot build this project. The only way without Go modules was to move the project into `$GOPATH`, like:

```
$ tree $GOPATH/src/insujang.github.io
/go/src/insujang.github.io
`-- testproject
    |-- main.go
    `-- test
        `-- func.go
```
Now we can specify the path of `test` package: `insujang.github.io/testproject/test`. So main.go can be modified to:

```go
package main

import "insujang.github.io/testproject/test"

func main() {
        test.TestFunc()
}
```

which makes our project be able to run:

```shell
$ GO111MODULE=off go run $GOPATH/src/insujang.github.io/testproject
I0404 15:09:40.239612    2034 func.go:6] Hello Go Modules!
```

## With Go modules, Go projects are no longer confined to `$GOPATH`

The example illustrated above shows how Go restricts the structure and location of Go projects. Go module alleviates this constraints, enabling Go projects be outside `$GOPATH`.

Let's go back to the problematic scenario. Instead of moving the directory into `$GOPATH`, we now use Go module.
```shell
~/testproject $ go mod init insujang.github.io/testproject
~/testproject $ GO111MODULE=on go run .
I0404 15:18:36.553399    2303 func.go:6] Hello Go Modules!
```

main.go
```go
package main

import "insujang.github.io/testproject/test"

func main() {
        test.TestFunc()
}
```

We initialize the project as a module named `insujang.github.io/testproject`. Even the directory is outside `$GOPATH`, `go run` command now searches `insujang.github.io/testproject/test` package in **its subdirectory, not `$GOPATH`**.

> Note that with no Go module support, it returns an error:
>
> ```shell
> ~/testproject# GO111MODULE=off go run .
> main.go:3:8: cannot find package "insujang.github.io/testproject/test" in any of:
>         /usr/local/go/src/insujang.github.io/testproject/test (from $GOROOT)
>         /go/src/insujang.github.io/testproject/test (from $GOPATH)
> ```

Aside from versioning support, this is one of main advantages of using Go module.

# GO111MODULE: Behaviors

Until now, I explicitly set `GO111MODULE` environment variable for every Go operations. Without variable set, the default value of `GO111MODULE` is `auto`, which behaves as follows:

![go111module](/assets/images/200404/go111module.png){: width="800px"} [^go113]

As Go version increases, it seems Google is *incrementally* adopting Go module in default circumstance. Since Go 1.13, if the project has `go.mod` file, Go uses Go module regardless of whether it is in `$GOPATH` or not. Before that, Go used the legacy GOPATH mode if the project is in `$GOPATH`.

[^gocodegopath]: How to Write Go Code (with GOPATH): [https://golang.org/doc/gopath_code.html](https://golang.org/doc/gopath_code.html)
[^versioning]: The Principles of Versioning in Go: [https://research.swtch.com/vgo-principles](https://research.swtch.com/vgo-principles)
[^go113]: Go 1.13 Release Note: [https://golang.org/doc/go1.13#modules](https://golang.org/doc/go1.13#modules)