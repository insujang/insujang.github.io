---
layout: post
title: "GPU-SGX Security Review, May 10"
date: "2017-05-25 11:08:08 +0900"
author: "Insu Jang"
---

# 5월 10일 피드백 정리
- PMIO를 통해서 접근하는 루트도 막는 방법을 구현할 필요는 없지만 대응은 필요하다.
- PCI Bridge에서 라우팅을 진행하는 방법과 이를 변조할 가능성이 있는지?
- Root Complex의 변경사항이 구체적으로 설명되어야 함. e.g. 라우팅할 때 사용하는 커맨드 경로를 고정한다고 했는데 OS가 다른 무엇을 해도 바꿀 수 없음을 입증할 수 있어야 한다.

# 고안한 해답들
1. **PMIO를 통해 접근하는 루트를 막는 방법?**

    PMIO를 통해 전송되는 PCIe 패킷과 MMIO를 통해 전송되는 PCIe 패킷은 포맷이 다르고, 이 패킷이 IO space를 통해 전송된 것인지 Memory space를 통해 전송된 것인지를 구별하는 플래그가 별도로 포함되어 전송된다. 따라서, PCI 디바이스는 이를 쉽게 구별할 수 있다.
    모든 PCI 디바이스는 **Command 레지스터** 를 가지고 있는데, 이 레지스터는 I/O space 접근 및 메모리 space 접근을 제어하는 비트가 있다. GPU에 있는 Command register의 0번째 비트를 0으로 세팅하여 IO space를 통한 접근을 막을 수 있다.

    ![pci_config_header_command](/assets/images/protected/170525/pci_config_header_command.png){: .center-image}
    * Command Register in PCI Configuration Space
    {: .center}

    ![pci_config_header_comand_bits](/assets/images/protected/170525/pci_config_header_comand_bits.png){: .center-image}
    * 0, 1번째 비트 설정을 통해 GPU가 I/O 접근에 대해 응답을 하지 않도록 설정할 수 있음.
    {: .center}

    그리고, BAR를 I/O space로 설정하는 것은 deprecated된 방법이므로, 앞으로 사용하지 않을 것이다. 참고: [\[위키피디아\]](https://en.wikipedia.org/wiki/PCI_configuration_space)

2. **PCI Bridge에서 라우팅을 진행하는 방법과 이를 변조할 가능성?**

    라우팅을 진행하는 방법은 **PCI Express Architecture** 책을 참조함.

    PCIe 스위치는 Upstream port와 Downstream port로 이루어져 있으며, Upstream port는 항상 하나고 Downstream port는 여러 개가 있을 수 있다. 각각의 Downstream port는 PCI configuration header를 가지고 있으며, 이 configuration header에는 *이 Downstream port 아래에 매핑된 주소의 범위가 저장되어 있다.*

    ![pci_routing_switch1](/assets/images/protected/170525/pci_routing_switch1.png){: .center-image}
    * 패킷이 내려올 때 스위치가 이를 라우팅하는 과정.  
    우선, 이 패킷이 스위치 자체를 위한 것인지 자신의 BAR 주소 값과 비교한다. (1) 만약 포함될 경우, 이 패킷은 Switch를 향한 어떤 액세스이다.  
    만약 아니라면, 자신의 아래에 있는 디바이스에게 전달되는 패킷일 수 있으므로, 어느 port로 라우팅할 것인지를 결정해야 한다. (2).  
    각 downstream port는 I/O Base/Limit, Memory Base/Limit, Prefetchable Memory Base/Limit 레지스터가 있으며, 만약 주소가 맨 왼쪽 downstream port의 Memory base ~ Memory Limit 사이의 어떤 값이라면 스위치는 이 패킷을 맨 왼쪽 downstream port로 보낼 것이다.
    {: .center}

    따라서, 스위치에 있는 레지스터 값을 수정함으로써 라우팅을 변조할 수도 있을 것.
    하지만 **모든 스위치에 대하여 (클래스 코드 0x06) 라우팅 정보를 조작하는 패킷을 Root Complex에서 판단해 차단한다면, OS에서 라우팅 정보를 변조할 수 없다.**

3. **Root Complex의 변경사항이 구체적으로 설명되어야 한다.**

    OS가 다른 무엇을 해도 바꿀 수 없음을 증명해야 한다. Root Complex는 **CPU/Memory 서브시스템과 PCI 서브시스템을 잇는 다리이다. <mark>하드웨어에 물리적인 접근이 불가능하다면, OS를 포함한 어떤 소프트웨어도 Root Complex를 우회해서 PCI 시스템에 접근할 수 있는 방법은 없다.</mark>**

    현재 Root Complex의 변경 사항은 다음과 같다.

    - **PCI command register의 11번째 bit의 사용 용도 변경**: 1로 세팅될 경우, 0으로 다시 바꿀 수 없고 모든 GPU의 MMIO 수정 및 스위치의 라우팅 정보 수정이 불가능해짐. (Address Lock)
    - **PCI command register의 12번째 bit의 사용 용도 변경**: 기존 PCI 디바이스의 경우, BAR가 필요로 하는 사이즈를 얻기 위해서는 다음과 같은 절차를 거쳐야 한다. (PCI Specification에 의해 정의됨)

        1. BAR 값을 백업한다.
        2. 32비트 BAR에 모두 1을 쓴다.
        3. BAR를 다시 읽으면 디바이스가 BAR의 사이즈를 리턴한다.
        4. 백업한 BAR 값을 복원한다.

        우리 모델의 경우 Address Lock 기능 때문에 Root Complex 외부에서 2번 절차를 수행하는 것이 불가능하다. 따라서, 다음과 같이 BAR의 사이즈를 얻는 다른 방법을 제안한다.

        1. Root Complex의 PCI command register 12번째 bit 값을 1로 변경한다.
        2. BAR 값을 읽으면 **Root Complex 내부에서** 위 1~4번 절차를 수행해 BAR의 사이즈를 리턴한다.
        3. Root Complex의 PCI command register 12번째 bit 값을 0으로 변경한다.

        command register의 12번째 비트가 0일 때 BAR를 읽으면 주소를 리턴하며, 비트가 1일 때 BAR를 읽으면 사이즈를 리턴한다.

        아래 구현은 Root Complex 내부에 구현된 내용이다.
        ```
        if 12-th bit of command register == 1?
            bar_tmp = read(BAR)
            BAR = ~0 (all 1 bits)
            addr = read(BAR)
            write(BAR, bar_tmp)
            return addr
        else
            return read(BAR)
        ```


# GPU Enclave에서 GPU에 접근하는 방법

![cuda_sgx_access_gpu_before](/assets/images/protected/170525/cuda_sgx_access_gpu_before.png){: .center-image width="800px"}
* 기존 시스템에서 GPU에 접근하는 방식
{: .center}

기존 방식은 위와 같이 커널 영역에 있는 디바이스 드라이버를 통해 GPU에 접근하는 방식이었다.  
하지만 SGX Enclave의 경우, 커널 영역에서 동작할 수 없으므로 다른 방식을 고안해야 했으며, 이는 아래 그림과 같다.

![cuda_sgx_access_gpu_after](/assets/images/protected/170525/cuda_sgx_access_gpu_after.png){: .center-image width="800px"}
* CUDA-SGX에서 GPU에 접근하는 방식. GPU enclave가 로딩될 때 미리 mmap()을 통해 device driver로부터 MMIO에 매핑된 user space virtual address를 받아 사용한다. (이 주소는 ENCLS를 통해 SGX에도 등록되며, 추후 address translation 보호에 사용됨)
{: .center}

한번 mmap()을 통해 virtual address를 받은 이후에는, device driver에 접근할 필요가 없이 user space에서 GPU와 통신할 수 있다.

이후 GPU enclave는 Message queue를 통해 유저 프로세스로부터 요청이 들어오기를 기다리며, 요청을 받으면 Intel SGX DH key exchange library를 통해 shared secret key를 enclave 내부 (user enclave 및 gpu enclave)에 생성한다. (Message queue로 암호화된 메시지를 주고받아 decryption 하는 것에 성공함)

![cuda_sgx_ipc_communication](/assets/images/protected/170525/cuda_sgx_ipc_communication.png){: .center-image width="1200px"}
* Message queue를 사용해 두 프로세스가 각각의 enclave 내부에서 shared secret key를 생성하고 데이터를 암호화해 주고받는 시나리오
{: .center}

이후 User enclave에서 대량의 데이터를 보내기 위해 shared memory를 생성하고, encrypt된 데이터를 shared memory에 쓴다. shared memory에 쓰는 데이터는 SGX가 주소 조작 등에 대한 보호를 제공하지 않지만, 데이터가 encrypt되어 있으므로 외부 소프트웨어(커널, 해커 등)가 데이터를 탈취할 수는 없다.

**CUDA lib은 CUDA trusted library와 CUDA untrusted library로 구성** 할 것이다.

- CUDA trusted library는 user enclave 내부에서 호출되는 라이브러리로, 데이터 encryption 함수 등을 제공한다.
- CUDA untrusted library는 user enclave 외부에서 호출되는 라이브러리로, shared memory 생성 등 GPU enclave와의 통신에 필요한 여러 함수들을 제공한다.
