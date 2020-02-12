---
layout: post
title: Interactions between cri-o and conmon in Kubernetes
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

# conmon: Container Monitor

## How conmon is used in cri-o
cri-o executes `conmon` when it receives a request for container creation, which creates a container process by using runc or Kata container (whatever a low level container runtime).
`stdout` and `stderr` streams of the container process are connected to `conmon`, where one `conmon` is launched per container, and are handled by it. Therefore, even during the downtime of cri-o daemon, conmon safely handles containers' logs.
This flow is different from the existing Dockerd or containerd: in containerd, daemon itself creates a container process directly.

[\[source\]](https://github.com/cri-o/cri-o/blob/2ce5b4b07a81f85bb59dc28148f2a38507bf3648/internal/oci/runtime_oci.go#L76)
```go
func (r *runtimeOCI) CreateContainer(c *Container, cgroupParent string) (err error) {
  ...
  cmd := exec.Command(r.config.Conmon, args...)
  ...
  cmd.ExtraFiles = append(cmd.ExtraFiles, childPipe, childStartPipe)
	// 0, 1 and 2 are stdin, stdout and stderr
	cmd.Env = r.config.ConmonEnv
	cmd.Env = append(cmd.Env,
		fmt.Sprintf("_OCI_SYNCPIPE=%d", 3),
		fmt.Sprintf("_OCI_STARTPIPE=%d", 4))
  ...
  err = cmd.Start()
  ...
```

cri-o passes two file descriptors; `_OCI_SYNCPIPE` and `_OCI_STARTPIPE` to conmon process. `conmon` primarily uses `_OCI_SYNCPIPE` pipe fd to communicate with cri-o daemon process: passing container pid after creating a container process, and an exit status and an exit message after the container process terminates.

cri-o log
```
...
time="2019-11-17 22:34:42.175927926-08:00" level=debug msg="running conmon: /usr/libexec/crio/conmon" args="[--syslog -c219e8fe1a17e71bb6ca74e3fa3e0fc638a76beaf6627b65b890bda086850826d -n k8s_POD_testcontainer_default_25f78622-1fcb-464e-b7da-15950ffca11a_0 -u219e8fe1a17e71bb6ca74e3fa3e0fc638a76beaf6627b65b890bda086850826d -r /usr/lib/cri-o-runc/sbin/runc -b /var/run/containers/storage/vfs-containers219e8fe1a17e71bb6ca74e3fa3e0fc638a76beaf6627b65b890bda086850826d/userdata -p /var/run/containers/storage/vfs    -containers219e8fe1a17e71bb6ca74e3fa3e0fc638a76beaf6627b65b890bda086850826d/userdata/pidfile -l /var/log/podsdefault_testcontainer_25f78622-1fcb-464e-b7da-15950ffca11a/219e8fe1a17e71bb6ca74e3fa3e0fc638a76beaf6627b65b890bda086850826d.log --exit-dir /var/run/crio/exits --socket-dir-path /var/run/crio --log-level debug --runtime-arg --root=/run/runc]"
...
time="2019-11-17 22:34:42.240172490-08:00" level=debug msg="Received container pid: 13152"
```

[\[source for the log in cri-o\]](https://github.com/cri-o/cri-o/blob/2ce5b4b07a81f85bb59dc28148f2a38507bf3648/internal/oci/runtime_oci.go#L204)
```go
func (r *runtimeOCI) CreateContainer(c *Container, cgroupParent string) (err error) {
  ...
  // Wait to get container pid from conmon
	type syncStruct struct {
		si  *syncInfo
		err error
	}
	ch := make(chan syncStruct)
	go func() {
		var si *syncInfo
		if err = json.NewDecoder(parentPipe).Decode(&si); err != nil {
			ch <- syncStruct{err: err}
			return
		}
		ch <- syncStruct{si: si}
	}()

	select {
	case ss := <-ch:
		if ss.err != nil {
			return fmt.Errorf("error reading container (probably exited) json message: %v", ss.err)
		}
		logrus.Debugf("Received container pid: %d", ss.si.Pid)
		if ss.si.Pid == -1 {
			if ss.si.Message != "" {
				logrus.Errorf("Container creation error: %s", ss.si.Message)
				return fmt.Errorf("container create failed: %s", ss.si.Message)
			}
			logrus.Errorf("Container creation failed")
			return fmt.Errorf("container create failed")
    }
  ...
  }
}
```

[\[source for the log in conmon\]](https://github.com/containers/conmon/blob/951052b62fdfdf2dd61efa2ad03b5fdbfc93c3ba/src/conmon.c#L1669)
```c
int main(int argc, char *argv[]) {
  ...
  execv(g_ptr_array_index(runtime_argv, 0), (char **)runtime_argv->pdata);
  ...
	container_pid = atoi(contents);
	ndebugf("container PID: %d", container_pid);

	g_hash_table_insert(pid_to_handler, (pid_t *)&container_pid, container_exit_cb);

	/* Send the container pid back to parent
	 * Only send this pid back if we are using the current exec API. Old consumers expect
	 * conmon to only send one value down this pipe, which will later be the exit code
	 * Thus, if we are legacy and we are exec, skip this write.
	 */
	if ((opt_api_version >= 1 || !opt_exec) && sync_pipe_fd >= 0)
		write_sync_fd(sync_pipe_fd, container_pid, NULL);

  ...
}
```

## Why cri-o uses conmon?

> Each container is monitored by a separate `conmon` process. The conmon process holds the pty of the PID1 of the container process. It handles logging for the container and records the exit code for the container process.
>
> *cri-o architectural components explanation.*

Why this is a strength of cri-o? In Docker, `dockerd` itself manages all of its containers and handles loggings for the containers. dockerd captures all outputs from the standard output streams (`stdout` and `stderr`) of the containers with Docker log drivers.

It seems to be efficient as one `dockerd` process handles all container's logs, however, it also does mean that it can occur **single point failure**. When `dockerd` is terminated, the standard output streams of the containers are *blocked*, which might put containers in a critical state.

> Though Docker provides non-blocking log message delivery mode, default mode is blocked mode [\[link\]](https://docs.docker.com/config/containers/logging/configure/).

For this reason, when `dockerd` receives a `SIGTERM` signal, it explicitly terminates all of its containers before terminating itself. This is default, where Docker also provides an alternative `live-restore` option, however, it is not recommended to keep containers alive during downtime [\[link\]](https://docs.docker.com/config/containers/live-restore/).

If logging is not responsible for a centralized container runtime daemon, the problem can be solved. `conmon` is the answer of cri-o team as a solution; even cri-o daemon is down, loggings for each container process are handled by conmon processes.

## How information "container terminated" is passed to cri-o?

When a main process of a containter terminates, all processes in the container and the container itself are terminated as well. In containerd, daemon has connected pipes to the main process of the container, which are closed during termination, hence they role as a *notification* of containter termination to containerd.

```
Nov 18 13:57:42 insujang-tmaxlinux microk8s.daemon-containerd[8816]: time="2019-11-18T13:57:42.617846445+09:00" level=info msg="Finish piping stdout of container "72d440531d468f757ce628deac966828b405df842b0a84f4e737d1d464cdd4ab""
Nov 18 13:57:42 insujang-tmaxlinux microk8s.daemon-containerd[8816]: time="2019-11-18T13:57:42.617935590+09:00" level=info msg="Finish piping stderr of container "72d440531d468f757ce628deac966828b405df842b0a84f4e737d1d464cdd4ab""
Nov 18 13:57:42 insujang-tmaxlinux microk8s.daemon-containerd[8816]: time="2019-11-18T13:57:42.642359076+09:00" level=info msg="TaskExit event &TaskExit{ContainerID:72d440531d468f757ce628deac966828b405df842b0a84f4e737d1d464cdd4ab,ID:72d440531d468f757ce628deac966828b405df842b0a84f4e737d1d464cdd4ab,Pid:31408,ExitStatus:0,ExitedAt:2019-11-18 13:57:42.618338639 +0900 UTC,}"
Nov 18 13:57:42 insujang-tmaxlinux microk8s.daemon-kubelet[20180]: I1118 13:57:42.684278   20180 manager.go:1005] Destroyed container: "/kubepods/besteffort/podde8d5097-67d1-4cfa-8648-2a2e1c050c3f/72d440531d468f757ce628deac966828b405df842b0a84f4e737d1d464cdd4ab" (aliases: [], namespace: "")
```

As indicated in the log above, containerd finds out one of its containers is down with pipe close, and creates `TaskExit` Kubernetes CRI event; kubelet receives the event and knows the container is destroyed.

But with cri-o, this way does not work as cri-o daemon itself is not directly connected to container processes via pipe fds; they are connected to the corresponding `conmon` processes.
Although conmon passes a termination event through `_OCI_SYNCPIPE`, cri-o uses [fsnotify](https://github.com/fsnotify/fsnotify) library to find out which container is terminated. when `conmon` finds out the container that it handles is down, it creates a file in the location specified as `--exit-dir` argument:

```shell
root@debian:~/Downloads# ps -ef | grep conmon
root     24508     1  0 21:53 ?        00:00:00 /usr/libexec/crio/conmon ... --exit-dir /var/run/crio/exits --socket-dir-path /var/run/crio --log-level debug --runtime-arg --root=/run/runc
root     24645 11159  0 21:53 pts/3    00:00:00 grep conmon
```

`conmon` creates a file, with its container id as a name and an exit status and message as its content, when a container process is terminated.
cri-o is notified by fsnotify right after `conmon` process creates a file.

[\[cri-o source\]](https://github.com/cri-o/cri-o/blob/2ce5b4b07a81f85bb59dc28148f2a38507bf3648/server/server.go#L648)
```go
// StartExitMonitor start a routine that monitors container exits
// and updates the container status
func (s *Server) StartExitMonitor() {
  go func() {
		for {
			select {
			case event := <-watcher.Events:
				logrus.Debugf("event: %v", event)
				if event.Op&fsnotify.Create == fsnotify.Create {
					containerID := filepath.Base(event.Name)
          logrus.Debugf("container or sandbox exited: %v", containerID)
    ...
  }

  if err := watcher.Add(s.config.ContainerExitsDir); err != nil {
		logrus.Errorf("watcher.Add(%q) failed: %s", s.config.ContainerExitsDir, err)
		close(done)
	}
	<-done
}
```

cri-o log
```
time="2019-11-17 22:34:46.087120063-08:00" level=debug msg="event: \"/var/run/crio/exits/99c537824f1a3890a5bb6a5414789390f0ceaf203bbeb72099905ba8508fc262.HYHHB0\": RENAME"
time="2019-11-17 22:34:46.087275699-08:00" level=debug msg="event: \"/var/run/crio/exits/99c537824f1a3890a5bb6a5414789390f0ceaf203bbeb72099905ba8508fc262\": CREATE"
time="2019-11-17 22:34:46.087380192-08:00" level=debug msg="container or sandbox exited: 99c537824f1a3890a5bb6a5414789390f0ceaf203bbeb72099905ba8508fc262"
time="2019-11-17 22:34:46.087413457-08:00" level=debug msg="container exited and found: 99c537824f1a3890a5bb6a5414789390f0ceaf203bbeb72099905ba8508fc262"
```

Then, similar to containerd, cri-o notifies to Kubelet via a CRI event.