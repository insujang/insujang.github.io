---
layout: post
title: "GPU Protection Mechanism"
date: "2017-04-18 21:46:17 +0900"
author: "Insu Jang"
comments: false
---
# 4월 7일 피드백 정리

- 다음 질문에 대한 답이 필요
    - OS가 부팅될 때 정상적으로 로딩하는 방법에 대한 고민이 필요.
    - Shinpei Kato 교수의 GPUvm: GPU Virtualization at the Hypervisor 읽기.

# 진행 내용
- 구현과 관련된 문제: SGX Simulation 모드 vs VM 사용하기 중 어떤 것이 나을지? **VM 모드를 사용하기로 결정**
- GPUvm을 읽고 gdev (CUDA 오픈소스 프레임워크)및 Nouveau (NVIDIA GPU 오픈소스 디바이스 드라이버)의 동작방식에 대해 분석 중
- MMIO 영역을 보호하기 위해 VFIO (KVM에서 PCI Passthrough에 사용되는 디바이스 드라이버)에 대해 분석 중
- OS 부팅 중 GPU Enclave의 안전한 초기화 방법

### VM 사용하기: 어떻게 새로운 SGX Instruction을 구현하는지?
- Intel은 VM Guest 머신에서 SGX를 사용할 수 있도록 수정된 QEMU-KVM(https://github.com/01org/qemu-sgx, https://github.com/01org/kvm-sgx) / Xen(https://github.com/01org/xen-sgx)을 제공 중
- Intel Software Developer's Manual 및 Software Guard Extension Programming Guide에 따르면, VM Execution Control 기능을 통해 ***<mark>특정 ENCLS instruction이 호출될 경우 VMexit을 호출하도록 VMCS를 설정할 수 있음</mark>***.

    ![vmm_control_sgx](/assets/images/170418/vmm_control_sgx.png){: .center-image width="1000px"}

    - *When bits in the "ENCLS-exiting bitmap" are set, execution of the corresponding ENCLS leaf function in the guest results in a VM exit.*

        - ENCLS leaf function: ECREATE, EADD 등의 SGX instruction을 의미
        - ECREATE나 EADD는 개별적인 instruction으로 구현되어 있지 않고 ENCLS의 leaf function으로 구현되어 있음. (= opcode가 모두 동일)
        - ENCLS instruction을 호출할 때 **EAX 레지스터에 저장되어 있는 값에 따라 호출되는 SGX instruction이 달라짐.**
            1. Example) ENCLS, EAX = 0x0: ECREATE
            2. Example) ENCLS, EAX = 0x1: EADD
            3. etc

    - ENCLS-exiting bitmap은 총 64비트 VMCS 필드로, 총 32개+1개의 ENCLS leaf function에 대해 비트맵을 구성할 수 있음. 예를 들어, **<mark>비트맵의 인덱스 1의 비트 값이 1일 경우, EAX = 0x1에 해당하는 EADD가 호출되면 CPU가 VMexit을 호출함.</mark>**

- 이를 사용해 새로운 Instruction을 에뮬레이트할 수 있음.
    1. VM의 SGX 드라이버와 SDK를 수정해 함수 인터페이스 제공
    2. KVM-SGX를 수정해 CPU가 새로운 SGX Instruction을 hook해 VMM에게 넘기도록 설정
    3. VMM의 VMexit 핸들러를 추가해 새로운 Instruction을 VMexit 핸들러에서 새 Instruction을 에뮬레이션

### GPU Enclave의 안전한 로딩 방법: 딱히 없음... 초기화는 다 이루어졌다고 가정하는 것이...
- GPU Enclave 초기화 후에는 MMIO 접근 권한을 GPU Enclave 프로세스에게 주고 다른 프로세스 및 커널의 MMIO 접근을 차단
    - Enclave 프로세스가 자신의 EPC 메모리에 접근하는 것을 SGX에서 체크하는 것처럼 GPU Enclave만을 MMIO 접근할 수 있도록 체크할 수 있음.
    - 체크 항목
        1. 등록된 GPU Enclave인가? 맨 처음 등록을 요청한 GPU Enclave가 등록된 GPU Enclave가 되며, 등록 시 특정 GPU의 고유번호를 넘겨 GPU 당 하나의 GPU Enclave를 생성하도록 한다. **악의적인 커널이 별도로 만든 GPU Enclave가 먼저 등록을 요청하면 이 Enclave가 등록된 GPU Enclave가 된다. GPU Enclave를 생성한 주체가 악의적인 목적을 가지고 있는지를 구분할 방법은 사실 없음. 하지만 GPU Enclave 자체는 Integrity가 보장되므로 유저의 데이터가 유출되지는 않을 것.**
        2. 물리 메모리 주소가 GPU를 가리키는, GPU BAR에 저장된 메모리 영역이 맞는가?
        3. 가상 메모리 주소가 GPU Enclave가 가지고 있는 MMIO 영역에 매핑된 영역인가?
- GPU Enclave는 초기화된 후 GPU 메모리 영역 및 MMIO 영역을 zero-fill함으로써 초기화 전 악의적인 커널이 삽입했을 수 있는 커맨드를 삭제

# 핵심 아키텍쳐 디자인 요소 몇가지
### 1. CUDA 함수를 호출할 때 Enclave transition을 줄이기
`cudaMemcpy()`나 `cudaDeviceSynchronize()`의 경우 synchronized 함수로써, 인텔 SGX의 경우 프로세스가 sleep하려면 우선 **enclave에서 나와야 함.** 이 함수를 호출할 때마다 enclave transition이 일어날 경우 오버헤드가 있을 수 있음. (SCONE에서는 System call의 경우 enclave 밖으로 나와야 하기 때문에 이로 인한 오버헤드가 있다고 언급함.)

이를 해결하기 위해 다음 디자인 요소를 제시
- 유저 프로세스는 프로세스 내부에 커맨드 버퍼를 둔다. CUDA 함수를 Enclave 내부에서 실행할 경우 커맨드 버퍼에 커맨드가 저장되며, 유저 프로세스의 메인 스레드는 **<mark>함수 실행 완료를 기다리지 않고 Asynchronous하게 다음 코드를 실행한다</mark>**. 따라서, function call로 인한 enclave transition을 줄일 수 있다.
- 실제로 sync를 맞추는 스레드는 유저 프로세스 내부의 Communication thread이며, 사실상 메인 스레드의 sleep을 Communication thread가 대신 해준다고 생각할 수 있다.

![gpu_enclave_communication_async](/assets/images/170418/gpu_enclave_communication_async.png){: .center-image width="1000px"}
* 유저 프로세스 내부에는 Main thread와 Communication thread가 있으며, 이 디자인의 주 목적은 Main thread의 enclave transition을 줄이는 것
{: .center}

![gpu_enclave_communication_async2](/assets/images/170418/gpu_enclave_communication_async2.png){: .center-image width="1000px"}
* Transaction 유무에 따른 Enclave transition 차이
{: .center}

한 가지 제약이 있는데, 유저 프로세스는 transaction 중간에 존재하는 값을 `cuMemcpyDtoH()`를 통해 얻어올 수 없다.

### 2. GPU 커널의 Resource Partitioning
이전 미팅에서 GPU 하드웨어가 스케쥴링을 수행하므로 데이터 보안을 제공하기가 어려워 GPU 커널을 동시에 하나만 동작할 수 있도록 하는 것이 좋겠다고 하였으나, 소프트웨어 레벨에서 물리적으로 각 GPU 커널에게 할당되는 영역을 분리할 수 있다는 것을 GPUvm을 통해 확인함.

GPU는 페이징을 지원하는데, 이는 GPU page table에 관리되고 CPU page table과 별개로 저장된다.  
GPU memory에 있으며 GPU channel에 GPU page table의 물리 주소가 저장되어 있다.  
GPU channel은 GPU device driver가 관리하고 있으므로, **GPU device driver를 사용해 MMIO를 통해서 GPU page table을 관리할 수 있다.**  
- From GPUvm

> **3.2.1. Resource Partitioning**
>
> GPUvm partitions the physical memory space into multiple sections of continuous address space, each of which is assigned to an individual VM.
The guest device drivers consider that the physical memory space originates at 0, but **the actual memory access is shifted by the corresponding size through the shadow page tables created by GPUvm.**

이 디자인을 응용하여, GPU Enclave가 각 프로세스에게 GPU 리소스를 할당할 때 memory space를 static하게 분할하여 일부를 준다. 이를 통해 악의적인 프로세스가 `cudaMalloc()` 등을 사용해 다른 프로세스가 사용중인 데이터에 물리적으로 접근할 수 없게 막을 수 있다.

![gpu_enclave_partition_resource](/assets/images/170418/gpu_enclave_partition_resource.png){: .center-image width="1000px"}
* GPU Enclave가 메모리를 할당할 때 물리적으로 파티션이 되어있는 공간 내에서 주소를 할당함으로써 다른 프로세스의 영역에 침범하지 못하게 한다.
{: .center}

단, shared memory에 대해서는 page table이 어떻게 동작하는지에 대한 언급이 없음. shared memory에 대한 확인이 필요한데 아마 같은 방법으로 page table을 사용하지 않을까 생각됨.
