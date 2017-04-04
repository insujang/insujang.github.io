---
layout: post
title: "GPU Enclave Protection Mechanism"
date: "2017-04-03 16:32:07 +0900"
author: "Insu Jang"
comments: false
---
# 3월 31일 미팅 피드백 정리
- 다음 질문에 대해 답을 해야 한다.
  - 특정 IO device 컨트롤은 특정 MMIO에 접근하는 방법 외에 컨트롤할 수 있는 방법이 있는지?
  - MMIO 영역은 GPU enclave 생성 후에는 GPU enclave process 외에 OS 및 시스템 소프트웨어가 접근하지 못하게 막아야 한다. 방법은?
  - GPU-SGX가 MMIO에만 접근하는 privilege permission을 주기. 방법은?

# 해답 정리
### 1. 특정 IO device 컨트롤은 특정 MMIO에 접근하는 방법 외에 컨트롤할 수 있는 방법이 있는지?
Source: *'Implementing Open-Source CUDA runtime by Shinpei Kato'*

I/O device에 접근하는 방법은 두 가지가 있음.
1. Memory-mapped I/O (MMIO)
2. Port-mapped I/O (PMIO)

PMIO는 Memory address space가 아닌 I/O address space를 통해 데이터를 전송하므로, 특수한
CPU instruction `in, out`을 사용하여 `0xCF8`와 `0xCFC`에 데이터를 읽고 씀으로써 디바이스와 통신할 수 있다. 단, PMIO를 통해 PCIe 디바이스와 주고받을 수 있는 데이터는 다음 그림에 포함된 PCI Configuration Space Header 데이터의 앞부분 256바이트 뿐이며, 이 영역은 PCI Specification에 의해 표준화된 헤더 영역으로 Configuration 정보만 포함한다. [\[출처\]](http://resources.infosecinstitute.com/system-address-map-initialization-x86x64-architecture-part-2-pci-express-based-systems/)

![](https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Pci-config-space.svg/1280px-Pci-config-space.svg.png){: width="400px" .center-image}


GPU 하드웨어 엔진은 MMIO로만 접근 가능하다. 다음 문단은 paper (*Implementing Open-Source CUDA runtime*)의 일부.

The NVIDIA GPU exposes the following base address registers (BARs) to the system through PCI in addition to the PCI configuration space and VGA-compatible I/O ports.

BAR0: Memory-mapped I/O (MMIO) registers  
BAR1: Device memory windows  
...

The most significant area is the BAR0 presenting MMIO registers.  
**<span style="color:red">This is the main control space of the GPU, through which all hardware engines are controlled.</span>**



### 2. GPU enclave 생성 후 MMIO 영역에 OS 및 시스템 소프트웨어가 접근하지 못하게 막는 방법?
Source: *'Intel SGX Explained, Victor Costan and Srinivas Devadas'*

##### 기존 SGX의 보호 매커니즘을 응용한다. SGX의 보호 매커니즘은 Address translation에서 security check가 이루어지므로, **address translation** 에 대한 이해가 필요.

따라서, 다음 용어는 반드시 설명해야 함.

EPC
: Enclave의 코드 및 데이터가 저장되는 영역으로, 해당 enclave를 소유한 프로세스 외의 프로세스 (시스템 소프트웨어 포함)는 접근할 수 없다. DRAM의 subset이므로 physical memory address로 접근함.

ELRANGE
: 각 Enclave에게 주어진 virtual memory 영역. EPC page의 physical memory address가 매핑되는 가상 메모리 영역을 ELRANGE라 한다. SGX는 ELRANGE 내부에 저장된 코드 및 데이터에 대해 보호를 보장.

![sgx_elrange](/assets/images/170403/sgx_elrange.png){: width="600px" .center-image}
*Figure 1. An enclave's EPC pages are accessed using a dedicated region in the enclave's virtual address space, called ELRANGE*
{: .center}

**소프트웨어가 virtual memory 주소를 physical memory로 변환해 EPC에 접근하려 한다. 이 변환 작업은 속도를 위해 HW로 구현되어 있는데, 이 HW를 수정해 적합한 enclave가 접근하는지를 이 virtual address와 변환된 physical address를 가지고 판별하는 것이 SGX 보호의 핵심.**
변환 과정에서 SGX가 수행하는 security check를 요약하면 아래와 같다.
- Physical address가 EPC 내부인가?
- 지금 접근한 enclave가 해당 EPC의 소유자가 맞는가?
- Virtual address가 해당 enclave에게 할당된 ELRANGE 안에 있는가?

<br/>

##### 기존 SGX 보호 매커니즘을 어떻게 MMIO 영역을 보호하는데 응용하는지?

**<span style="color:red">physical address가 EPC -> MMIO 영역으로, virtual address가 ELRANGE -> GLRANGE로 바뀌고, 기존 SGX 보호 매커니즘과 같은 매커니즘을 사용한다.</span>**

- Physical address가 MMIO 영역인가?
- 지금 접근한 enclave가 MMIO의 소유자인 미리 등록된 GPU enclave가 맞는가?
- Virtual address가 MMIO가 매핑된 GLRANGE 안에 있는가?

![glrange](/assets/images/protected/170403/glrange.png){: width="600px" .center-image}
*Figure 2. GPU enclave process is running as a separate process. MMIO is accessed using a dedicated region in the GPU enclave's virtual address space, called GLRANGE*
{: .center}

- MMIO와 DRAM은 같은 physical memory address space를 사용하므로, 기존 SGX 매커니즘을 조금만 변형하면 MMIO 보호에 사용할 수 있음.
- ELRANGE와 GLRANGE는 별개의 공간이며, ELRANGE에 매핑되는 EPC page는 GPU driver에서 MMIO와 관련된 코드를 담고 있음.
- 유저 데이터는 GPU enclave의 EPC 내부로 복사되어 들어온 후, PCI BAR 영역을 통해 GPU로 전송됨.

| 기존 SGX                                                 	|                          GPU SGX                          	|
|----------------------------------------------------------	|---------------------------------------------------------	|
| EPC page는 하나의 enclave에게만 할당됨                   	| MMIO는 하나의 GPU enclave에게만 할당됨                      	|
| 다른 소프트웨어는 EPC에 접근할 수 없음                   	| 다른 소프트웨어는 MMIO에 접근할 수 없음                   	|
| EPC의 물리 메모리 주소는 ELRANGE 가상 메모리 주소로 매핑 	| MMIO의 물리 메모리 주소는 GLRANGE 가상 메모리 주소로 매핑 	|
| Security check는 MMU에서 수행                            | Security check는 MMU에서 수행                    |
| Host application은 유저 application                      | Host GPU enclave process는 Device driver가 로딩될 때 생성한 user-level kernel application |

**GPU Enclave가 정상적으로 생성되고 SGX에 GPU Enclave가 등록된 경우, 시스템 소프트웨어를 포함한 모든 소프트웨어의 허가받지 않은 MMIO 접근은 기존 SGX 보호 매커니즘 사용으로 차단 가능**

### 3. MMIO에만 접근하는 privilege permission을 주는 방법이 있는지?
<!--
TODO: Privilege check가 어디서 어떻게 이루어지는지 먼저 조사할 필요가 있음.

4월 3일 조사 결과: -->Port-mapped I/O는 privilege level 0이 필요한 special instruction(`in` and `out` instructions)을 사용하지만, memory-mapped I/O는 메모리에 접근하는 것과 같이 I/O 디바이스의 영역에 접근할 수 있다.

- Intel Software Developer's Manual Volume 1. [\[링크\]](http://www.intel.com/content/www/us/en/architecture-and-technology/64-ia-32-architectures-software-developer-vol-1-manual.html)  
Chapter 18.3.1. Memory-Mapped I/O  
When using memory-mapped I/O, **any of the processor's instructions that reference memory can be used to access an I/O port located at a physical-memory address**.  

Some Q&As in Stack Overflow
- [\[link\]](http://stackoverflow.com/a/20116610): To access PCI resources from user space, call `mmap()` on the appropriate sysfs files, like this:  
  ```
  fd = open("/sys/devices/pci0000:00/0000:00:12.3/resource0", O_RDWR | O_SYNC);
  ptr = mmap(0, size, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
  ```
- [\[link\]](http://billfarrow.blogspot.kr/2010/09/userspace-access-to-pci-memory.html): Userspace access to PCI memory by Bill Farrow  
  Use `mmap()` to map the PCI memory into a userspace applications memory space.  
  ```
  fd = open("/sys/devices/pci0001\:00/0001\:00\:07.0/resource0", O_RDWR | O_SYNC);
  ptr = mmap(0, 4096, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
  printf("PCI BAR0 0x0000 = 0x%4x\n",  *((unsigned short *) ptr);
  ```  
  The utility application "pcimem" reads and writes single values within the PCI memory space.

![gpu_resource_file](/assets/images/protected/170403/gpu_resource_file.png){: .center-image}

Bill Farrow가 [Github에 업로드한 코드](https://github.com/billfarrow/pcimem/blob/master/pcimem.c)를 사용해 테스트해본 결과 root로 실행하면 유저 모드로 동작하는 프로세스에 MMIO 영역을 매핑한 후 접근할 수 있음을 확인함.

`/sys/bus/pci/devices/0000:01:00.0/resource0`의 owner를 개인 계정으로 바꾼 후 root 권한 없이 테스트한 결과, 정상적으로 실행됨. 따라서, `open()`과 `mmap()` 시스템 콜만 kernel mode에서 처리된 후에는 **CPU privilege level과는 상관없이 퍼미션만 있으면 MMIO에 접근할 수 있다.**

우리 모델에서 GPU enclave를 포함하는 프로세스의 UID를 root로 하면 별다른 문제 없이 이 프로세스가 GPU Enclave모드일 때 MMIO 영역에 접근할 수 있다.

![mmio_test](/assets/images/protected/170403/mmio_test.png){: .center-image}

#### 그러면 제대로 매핑되었는지 확인하는 방법은?
커널이 resource_*n* 파일을 바꿔치기할 수도 있고, 페이지 매핑 테이블을 바꿀 수도 있다. 하지만 디바이스가 physical address space의 어디에 매핑되어 있는지 커널을 통하지 않고도 CPU 하드웨어가 자체적으로 알 수 있으므로, 이 physical address에 대해 위 2번의 GPU Enclave 보호 매커니즘을 적용하면 된다.
