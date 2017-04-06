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
Sources
- *'Implementing Open-Source CUDA runtime by Shinpei Kato'*
- *'GPUvm: GPU Virtualization at the Hypervisor by Yusuke Suzuki'*
- *'Operating System Concepts Ninth Edition, Chapter 13'*
- *'Port-mapped I/O, Wikipedia'* [\[link\]](https://en.wikipedia.org/wiki/Memory-mapped_I/O)

<br/>
I/O device에 접근하는 방법은 두 가지가 있음.
1. Memory-mapped I/O (MMIO)
2. Port-mapped I/O (PMIO)

PMIO는 memory address space가 아닌 별도 I/O address space를 통해 데이터를 주고 받으며, 이를 위한 전용 x86-64 CPU instruction인 `in, out`을 사용한다. 이 instruction들은 별도로 CPU의 physical interface로 장착된 I/O pin을 통해 통신한다.

구체적으로 GPU에 대한 언급은 다음 두 가지 정보를 찾았음.

1. 오픈 소스 드라이버인 Nouveau와 Gdev에서는 GPGPU 엔진에 접근하기 위해 PMIO를 사용하는 코드를 발견하지 못하였음.  
그러나, 오픈 소스 문서 중에서 GPU에 접근하는 방법을 정리한 문서가 있다. [\[여기\]](http://envytools.readthedocs.io/en/latest/hw/bus/bars.html)

2. Paper *Implementing Open-Source CUDA runtime* 에 따르면, GPU 하드웨어 엔진은 MMIO를 통해서만 컨트롤할 수 있다고 한다.  
>The NVIDIA GPU exposes the following base address registers (BARs) to the system through PCI in addition to the PCI configuration space and VGA-compatible I/O ports.
>
>BAR0: Memory-mapped I/O (MMIO) registers  
BAR1: Device memory windows  
...
>
>The most significant area is the BAR0 presenting MMIO registers.  
**<span style="color:red">This is the main control space of the GPU, through which all hardware engines are controlled.</span>**

3. Paper *GPUvm* 은 Gdev 저자 Shinpei Kato도 참여한 논문으로, Gdev를 기반으로 하고 있다. GPU 모델을 설명하며 MMIO에 대해 다음과 같이 언급한다.
> The CPU communicates with the GPU via MMIO.
> ... We must note that the I/O ports are used to indirectly access the above MMIO regions. **The I/O port is rarely used since it is inteded to be used in the real mode, which cannot map a high memory address.** In fact, Nouveau, which is an open-source device driver, never accesses it.

#### 결론
- MMIO 외에 PMIO로도 I/O 디바이스에 접근할 수 있음.
- PMIO는 거의 사용되지 않음,
- PMIO를 MMIO 우회에 사용할 수 있지만 I/O port는 CPU의 physical interface이므로, 하드웨어 레벨에서 커널의 접근을 차단할 수 있음.

### 2. GPU enclave 생성 후 MMIO 영역에 OS 및 시스템 소프트웨어가 접근하지 못하게 막는 방법?
Source: *'Intel SGX Explained, Victor Costan and Srinivas Devadas'*

##### 기존 SGX의 보호 매커니즘을 응용한다. SGX의 보호 매커니즘은 Address translation에서 security check가 이루어지므로, **address translation** 에 대한 이해가 필요. 따라서, 다음 용어는 반드시 설명해야 함.

EPC
: Enclave의 코드 및 데이터가 저장되는 영역으로, 해당 enclave를 소유한 프로세스 외의 프로세스 (시스템 소프트웨어 포함)는 접근할 수 없다. DRAM의 subset이므로 physical memory address로 접근함.

ELRANGE
: 각 Enclave에게 주어진 virtual memory 영역. EPC page의 physical memory address가 매핑되는 가상 메모리 영역을 ELRANGE라 한다. SGX는 ELRANGE 내부에 저장된 코드 및 데이터에 대해 보호를 보장.

![sgx_elrange](/assets/images/170403/sgx_elrange.png){: width="600px" .center-image}
*Figure 1. An enclave's EPC pages are accessed using a dedicated region in the enclave's virtual address space, called ELRANGE*
{: .center}

**소프트웨어가 virtual memory 주소를 physical memory로 변환해 EPC에 접근하려 한다. 이 변환 작업은 속도를 위해 HW로 구현되어 있는데, 이 HW를 수정해 적합한 enclave가 접근하는지를 인풋으로 들어온 virtual address와 변환된 physical address를 가지고 판별하는 것이 SGX 보호의 핵심.**
변환 과정에서 SGX가 수행하는 security check를 요약하면 아래와 같다.
- Physical address가 EPC 내부인가?
- 지금 접근한 enclave가 해당 EPC의 소유자가 맞는가?
- Virtual address가 해당 enclave에게 할당된 ELRANGE 안에 있는가?

<br/>

#### 기존 SGX 보호 매커니즘을 어떻게 MMIO 영역을 보호하는데 응용하는지?

**<mark>physical address를 EPC -> MMIO 영역으로, virtual address를 ELRANGE -> GLRANGE로 바꾸고, 기존 SGX 보호 매커니즘과 비슷한 매커니즘을 사용한다.</mark>**

- Physical address가 MMIO 영역인가?
- 지금 접근한 enclave가 MMIO의 소유자인 미리 등록된 GPU enclave가 맞는가?
- Virtual address가 MMIO가 매핑된 GLRANGE 안에 있는가?

![glrange](/assets/images/protected/170403/glrange.png){: width="600px" .center-image}
*Figure 2. GPU enclave process is running as a separate process. MMIO is accessed using a dedicated region in the GPU enclave's virtual address space, called GLRANGE*
{: .center}

- MMIO와 DRAM은 같은 physical memory address space를 사용하므로, 기존 SGX 매커니즘을 조금만 변형하면 MMIO 보호에 사용할 수 있음.
- ELRANGE와 GLRANGE는 별개의 공간이며, ELRANGE에 매핑되는 EPC page는 GPU driver에서 MMIO와 관련된 코드를 담고 있음.
- 유저 데이터는 GPU enclave의 EPC 내부로 복사되어 들어온 후, PCI BAR 영역을 통해 GPU로 전송됨.

<!--
| 기존 SGX                                                 	|                          GPU SGX                          	|
|----------------------------------------------------------	|---------------------------------------------------------	|
| EPC page는 하나의 enclave에게만 할당됨                   	| MMIO는 하나의 GPU enclave에게만 할당됨                      	|
| 다른 소프트웨어는 EPC에 접근할 수 없음                   	| 다른 소프트웨어는 MMIO에 접근할 수 없음                   	|
| EPC의 물리 메모리 주소는 ELRANGE 가상 메모리 주소로 매핑 	| MMIO의 물리 메모리 주소는 GLRANGE 가상 메모리 주소로 매핑 	|
| Security check는 MMU에서 수행                            | Security check는 MMU에서 수행                    |
| Host application은 유저 application                      | Host GPU enclave process는 Device driver가 로딩될 때 생성한 user-level kernel application |
-->
#### 결론

**GPU Enclave가 정상적으로 생성되고 SGX에 GPU Enclave가 등록된 경우, 시스템 소프트웨어를 포함한 모든 소프트웨어의 허가받지 않은 MMIO 접근은 기존 SGX 보호 매커니즘 사용으로 차단 가능**

### 3. MMIO에만 접근하는 privilege permission을 주는 방법이 있는지?
<!--
TODO: Privilege check가 어디서 어떻게 이루어지는지 먼저 조사할 필요가 있음.

4월 3일 조사 결과: -->
Port-mapped I/O는 privilege level 0이 필요한 special instruction(`in` and `out` instructions)을 사용하지만, memory-mapped I/O는 메모리에 접근하는 것과 같이 I/O 디바이스의 영역에 접근할 수 있다.

- Intel Software Developer's Manual Volume 1. [\[링크\]](http://www.intel.com/content/www/us/en/architecture-and-technology/64-ia-32-architectures-software-developer-vol-1-manual.html)  
Chapter 18.3.1. Memory-Mapped I/O  
When using memory-mapped I/O, **any of the processor's instructions that reference memory can be used to access an I/O port located at a physical-memory address**.  

- Some Q&As in Stack Overflow
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

`/sys/bus/pci/devices/0000:01:00.0/resource0`의 owner를 개인 계정으로 바꾼 후 root 권한 없이 테스트한 결과, 정상적으로 실행됨. 따라서, 적합한 퍼미션을 가지고 `open()`과 `mmap()` 시스템 콜만 kernel mode에서 처리된 후 프로세스의 virtual address space에 MMIO가 매핑된 후에는 **CPU privilege level과는 상관없이 MMIO에 접근할 수 있다.**  
특히, 프로세스의 UID를 root로 하면 퍼미션 문제 없이 MMIO 영역에 접근할 수 있다.

![mmio_test](/assets/images/protected/170403/mmio_test.png){: .center-image}

***<mark>단 실제 구현 부분에서는 파일을 열어 file descriptor를 사용하는 것이 아니라 PCI BAR에 저장된 physical address에 대해 virtual address 매핑을 커널에게 요청할 것임. 이를 위해 현재 SGX가 특정 EPC page에 대해 virtual address를 어떻게 받아오는 지 확인 중.</mark>***

### 3-1. 그러면 GPU Enclave가 자신의 EPC 페이지와 MMIO에"만" 접근하도록 강제하는 방법은?
Intel SGX에서는 enclave가 EPC 페이지(trusted)와 외부 DRAM (untrusted) 영역에 정상적으로 접근할 수 있는 (=Address Translation Attack을 방어할 수 있는) 매커니즘을 MMU에 구현하였다. [\[링크\]](https://insujang.github.io/2017-04-03/intel-sgx-protection-mechanism#sgx-address-translation-attack-protection-details)

이와 마찬가지로 GPU Enclave에 대해서도 MMU에서 physical address - virtual address 체크를 하는데, 이 과정에서 **다음 매커니즘을 통해 자신의 EPC 페이지와 MMIO를 제외한 영역으로 접근하는 경우 접근을 제한할 수 있다.**

![gpu_enclave_protection](/assets/images/protected/170403/gpu_enclave_protection.png){: .center-image}

#### 플로우차트 요약
- 등록된 GPU enclave는 GPU enclave 안에서 MMIO와 자신의 EPC 영역만 접근할 수 있다.
- GPU enclave가 아닌 경우 기존 SGX의 보호 매커니즘을 따른다 (파란색 박스).
- MMIO 영역은 등록된 GPU enclave 외에 어떤 소프트웨어도 접근하지 못한다.

<!--
플로우차트를 보기 전에 알아야 할 사항
- MMIO가 physical address에 매핑되는 순간은 바이오스 부팅 때이다.
- GPU enclave 프로세스는 커널 부팅 시 생성된다.
- MMIO physical address가 virtual address에 매핑되는 때는 GPU enclave 프로세스가 생성될 때이다.
- 매핑된 virtual address는 GPU enclave 내부 자료 구조의 GLRANGE라는 공간에 저장된다.
-->

![gpu_enclave_protection2](/assets/images/protected/170403/glrange2.png){: .center-image}
