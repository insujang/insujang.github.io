---
layout: post
title: "GPU-SGX Security Review"
date: "2017-04-27 10:52:31 +0900"
author: "Insu Jang"
comments: false
---

# 4월 26일 피드백 정리
- 논문을 쓰기 위해서는 잘 알지 못하는 독자 및 리뷰어들을 위해 큰 그림을 잘 정리하여 보여주어야 한다.
**지금은 워낙 많은 부분을 고치기 때문에, 잘 정리된 그림이 아직은 없음.** (미팅을 반복하면서 점점 정리가 되어가고는 있음.)
- 다음 내용에 대해서 회의함.
    - 그래프로 보여줄만한 것은 성능 오버헤드에 대한 내용밖에 없을 것. (encryption 등)
    - 실제 페이퍼에서 바디는 이 아키텍쳐가 구현이 가능하다라는 것을 보여주는 것이 메인. 앞으로 SGX가
    IO device까지도 포함하도록 발전한다면 IO device를 변경하지 않더라도 (디바이스 드라이버 수정 정도만으로)
    SGX의 보안 혜택을 받을 수 있다는 이 접근이 유효한지 입증해야 한다.
    - 논문에 써야 할 것들: 이렇게 만드는 것이 불가능하지 않다. Generalized된 접근 방법을 제시해
    이 방법이 불가능하지 않다고 수긍시켜야 함.

- Security 측면에서 다음 질문에 대한 답이 필요
    - OS가 IO path를 변조하지 못하게 하드웨어적으로 막는 것이 가능한가?
    - GPU device driver를 MMIO와 Interrupt handler를 별도로 분리시키는 것이 가능한가?
    - 커널 영역에는 Interrupt handler만이 있을 것. 그러면 OS가 Interrupt handler만 가지고는
    GPU에서 정보를 뽑아낼 수 없다는 것을 증명해야 한다.
    - 특정 enclave (GPU Enclave)가 특정 MMIO 영역(어떤 GPU의 BAR)을 가질 수 있다는 것을 증명
    - IO 영역은 privilege 레벨이 필요할텐데 GPU enclave 프로세스가 이 영역에 접근할 수 있는 방법에 대해 증명

# 고안한 해답들
1. **OS가 IO path를 변조하지 못하게 하드웨어적으로 막는 것이 가능한가?**

    ![](https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Pci-config-space.svg/1280px-Pci-config-space.svg.png){: .center-image width="600px"}
    * Figure: PCIe configuration sapce header for type0
    {: .center}

    PCI 디바이스에 하드웨어적으로 존재하는 레지스터에 OS가 접근해 MMIO 주소를 바꾸지 못하도록 해야 한다. MMIO 주소는 위 PCI configuration register에서 BAR 레지스터에 저장되어 있으며, CPU I/O port (0xCF8: PCI CONFIG ADDRESS REGISTER 와 0xCFC: PCI CONFIG DATA REGISTER) 또는 MMIO 영역 (Configuration space 자체도 MMIO로 매핑되어 있음. 물리 주소는 PCH의 레지스터 중 하나인 PCI Express Register Range Base Address = PCIEXBAR에 저장되어 있음)으로 접근할 수 있다.

    > **헷갈림 주의**: BAR에 저장된 물리 주소는 디바이스 컨트롤을 위한 MMIO 영역이며, PCI configuration space 자체도 별도 영역에 MMIO로 매핑되어 있다.

    ![pciexbar](/assets/images/protected/170427/pciexbar.png){: .center-image width="800px"}
    * PCI Express Register Range Base Address (PCIEXBAR)
    {: .center}

    > 예시: B.D.F가 0001:00.0인 PCI 디바이스의 BAR0에 접근하는 방법
    >
    > ![accesing_pci_01_00_0](/assets/images/protected/170427/accesing_pci_01_00_0.png){: .center-image width="1000px"}
    >
    > PCI 디바이스에 접근하기 위해서는 BAR 주소를 알아야 하며, BAR 주소를 알기 위해서는 PCI Configuration Space의 위치를 알아야 한다. 따라서, 먼저 PCI Configuration Space의 물리 주소를 PCH에 있는 PCIEXBAR 레지스터를 사용해 찾고, 해당 PCI Configuration Space에서 BAR에 저장된 물리 주소를 찾으면 해당 디바이스에 접근할 수 있다.

    이 MMIO 영역을 통해 어떤 특정 B.D.F 번호를 가진 PCI 디바이스의 configuration space가 매핑된 MMIO 주소를 알 수 있다.  
    여기에 접근하는 것을 막기 위한 방법으로는,

    1. I/O port는 protected mode에서 사용하지 않으므로 0xCF8과 0xCFC 레지스터를 막는다. 이 두 제리스터는 PCI configuration space에 접근하기 위해서만 사용되므로 막아도 전체 시스템에 문제가 발생하지 않는다. GPUvm 논문에서도 I/O port는 현재 사용되지 않는다고 한다.
    2. PCI configuration space가 매핑된 MMIO 영역은 RO로 한다. Write request가 올 경우 PCIe controller에서 이를 거부하도록 설정한다.  
    구체적인 설명으로, PCIe controller에 System address map fix라는 새로운 기능을 구현한다. 이 기능은 한번 호출되면 이후 PCI MMIO 영역을 리매핑하는 요청을 포함해, PCI configuration space의 레지스터 값을 수정하는 요청을 모두 거부한다. GPU Enclave 프로세스가 GPU enclave를 생성하기 전 `ioctl()`을 통해 PCIe controller에게 System address map fix를 요청한다. GPU enclave는 PCI configuration space가 locked되어있지 않으면 초기화에 실패하도록 구현한다.

2. **GPU device driver를 MMIO와 Interrupt handler를 별도로 분리시키는 것이 가능한가?**

    CUDA open source 소프트웨어인 gdev 내부 코드를 자세히 분석한 결과, **GPGPU 컴퓨팅 과정에서 인터럽트를 사용하지 않는 것으로 나타났다.** 관련 내용은 논문 *Implementing Open-Source CUDA Runtime* 에 나와 있으며, 요약하자면 NVIDIA GPU는 fence라는 기술을 사용해 특정 위치의 값을 계속하여 polling한다. 이 값이 바뀔 경우 GPU 커널 실행이 끝난 것을 의미한다.

    실제 코드 확인 결과 인터럽트 핸들러가 구현되어 있으나 사용하지 않는 것을 확인했다. (cuMemcpy, cuCtxSynchronize 함수에 대해서 fence만 사용하도록 구현되어 있음)

    따라서 부팅이 끝난 이후 **커널 영역 디바이스 드라이버는 유저 프로세스가 GPU Enclave를 통해 GPU를 사용할 때 GPU Enclave를 실행하는 프로세스를 깨우는 역할만 하게 되며 (처리할 커맨드가 없을 경우 GPU Enclave 프로세스는 슬립 상태), GPU와 직접적으로 통신하는 역할은 모두 GPU Enclave를 실행하는 프로세스가 맡는다.**
    GPU Enclave를 실행하는 프로세스는 위에서 언급하였듯 커널 부팅 중 생성되며, 소유자는 root이다. 프로세스가 실행되면 GPU Enclave를 생성하고, 생성이 확인되면 커널 영역의 디바이스 드라이버가 깨울 때까지 슬립한다.

3. **OS가 Interrupt handler만 가지고는 GPU에서 정보를 뽑아낼 수 없다는 것을 증명해야 한다.**

    Interrupt handler를 사용하지 않음으로써 커널 영역에서는 OS가 어떤 방법으로도 정보를 뽑아낼 수 없다.

    1. OS의 도움을 받아 생성하는 유저 프로세스 - GPU Enclave 프로세스 간 공유 메모리에는 암호화된 데이터가 쓰여지며, 암호화에 사용되는 shared secret key는 인텔 SGX에서 사용되는 Diffie-Hellman 라이브러리를 사용하므로 안전하게 데이터를 이동할 수 있다.
    2. OS가 공유 메모리의 데이터를 일부 수정할 경우, AES128-GCM 프로토콜에 의해 authentication failure를 알 수 있다.

4. **특정 enclave (GPU Enclave)가 특정 MMIO 영역을 독점적으로 소유할 수 있다는 것을 증명해야 한다.**

    GPU Enclave가 초기화되면서 특정 B.D.F 번호를 가진 GPU에 대해 MMIO 영역 소유를 GPU-SGX에게 요청한다. GPU-SGX는 이 GPU-Enclave의 enclave ID와 함께 해당 GPU의 MMIO 영역의 물리 주소를 SGX 내부 구조에 저장한다. 이 자료구조는 기존 SGX의 SECS와 같이 소프트웨어에서는 접근하지 못하는 SGX 내부 자료구조이므로, OS가 소프트웨어 해킹을 통해 변경할 수 없다.

    또한, GPU-SGX는 이 요청을 처리하기 전에 1번에서 언급한 대로 System address map fix가 되어 있는지 PCIe controller와 하드웨어 통신을 통해 체크한다. fix가 되어 있을 경우에만 GPU Enclave의 GPU MMIO 영역 소유에 대한 요청을 처리하고, GPU Enclave를 GPU 소유자로 등록한다.

    이후 같은 GPU에 대한 다른 enclave의 소유 요청은 거부하며, 등록된 GPU의 MMIO에 접근할 때 해당 프로세스가 GPU Enclave인지 아닌지를 판별해, GPU Enclave에서 접근하는 것이 아닐 경우 접근을 거부한다.  
    이는 기존 SGX가 어떤 enclave에서 EPC page에 접근할 때 EPC page의 소유자와 일치하는지 확인하는 과정을 응용해 구현할 수 있다.

5. **IO 영역은 privilege 레벨이 필요한데 GPU enclave 프로세스가 이 영역에 접근할 수 있는 방법에 대해 증명하기**

    IO port를 통해 디바이스에 접근할 때는 IO instruction이 privilege 레벨을 요구한다.  
    그러나, MMIO를 통해 디바이스에 접근할 때는 **유저 프로세스라도 MMIO 영역에 대한 virtual address만 있으면 이후에는 privilege 레벨 없이 MMIO 영역에 접근 가능하다는 것을 확인** 하였다. [\[링크\]](/protecteduic2ws/2017-04-03/gpu-enclave-protection-mechanism/)

    커널의 도움을 받아 MMIO 영역에 매핑된 virtual address를 받는 것은, 기존 SGX가 EPC 물리 주소에 매핑된 virtual address를 받기 위해 커널의 도움을 받는 것과 비슷하다고 볼 수 있다.

    기존 SGX는 EPC page의 physical address를 커널에게 넘기며 해당 주소에 매핑된 virtual address를 커널에게 요청하고, 돌아온 virtual address를 SGX의 내부 자료구조에 기록한다. 추후 이 EPC page에 유저 프로세스가 다시 접근했을 때 MMU에서 기록한 virtual address와 방금 address translation을 통해 생성한 virtual address가 일치하는지 확인한다. 일치하지 않으면 커널에 의해 페이지 테이블이 수정되었다는 의미이므로, 접근을 거부한다.

    같은 방법으로, GPU-SGX는 커널에게 MMIO 영역 물리 주소를 넘기며 이 영역에 대한 virtual address를 요청한다. 받은 virtual address를 SGX 내부 자료구조에 저장해 두고, 다음에 MMIO 영역에 접근할 때 MMU에서 페이지 테이블 변형이 일어나지 않았는지 검사하게 된다.
