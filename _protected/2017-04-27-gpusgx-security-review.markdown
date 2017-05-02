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

    PCI 디바이스에 하드웨어적으로 존재하는 레지스터에 OS가 접근해 MMIO 주소를 바꾸지 못하도록 해야 한다.  
    MMIO 주소는 위 PCI configuration space에서 BAR 레지스터에 저장되어 있으며, 다음 두 가지 방법으로 접근 가능하다.

    1. CPU I/O port (0xCF8: PCI CONFIG ADDRESS REGISTER, 0xCFC: PCI CONFIG DATA REGISTER)

        > I/O port를 막는 것이 필요할 경우, VMM의 I/O bitmap addresses 섹션을 볼 필요가 있음.  
        Intel SDM volume 3. Section 24.6.4 참조

    2. MMIO (Configuration space 자체도 MMIO로 매핑되어 있음.)


        2번 방법의 경우, MMIO 영역이 매핑된 주소가 BAR에 저장된 것처럼 configuration space도 매핑된 주소를 저장할 곳이 필요하다. Configuration space의 물리 주소는 PCH의 레지스터 중 하나인 PCI Express Register Range Base Address (= PCIEXBAR)에 저장되어 있다.

        > **헷갈림 주의**: BAR에 저장된 물리 주소는 디바이스 컨트롤을 위한 MMIO 영역이며, PCI configuration space 자체도 별도 영역에 MMIO로 매핑되어 있다.


    두 가지 방법 중 어느 것을 쓰더라도, PCI 디바이스에 데이터를 쓰기 위해서는 ***CPU와 PCI device를 이어주는 PCIe root complex를 거치게 된다. Root Complex는 PCI Express Specification에 적힌대로 CPU/memory 시스템과 PCI I/O를 연결하는 root이다.*** 또한, PCI Express 프로토콜은 TCP/IP와 비슷하게 여러 레이어로 구성된 Transaction Layer Packet을 사용해 디바이스 간 통신을 하는데, CPU에서 동작하는 소프트웨어가 PCIe 디바이스에 접근하려 할 경우 이 접근에 해당하는 패킷을 생성하는 것은 PCIe root complex이다.  
    따라서, **<mark>PCIe root complex 내부에 있는 PCIe 컨트롤러를 수정함으로써 소프트웨어에서 PCI 디바이스의 BAR 값에 접근하는 행위를 차단</mark>할 수 있다.** PCIe 컨트롤러에 이미 존재하는 하드웨어 레지스터 중 1비트를 사용해 차단/허용 여부를 결정하도록 설정할 수도 있다. 예를 들어, 해당 비트 값이 1이면 PCIe 컨트롤러는 BAR에 접근하는 요청을 모두 차단한다.

    <br/><br/>

    PCIe controller에서 쓰지 않는 비트 하나를 사용해 address map lock 기능을 구현하고 유저 프로세스에서 BAR 값을 읽을 때에 이를 거부하도록 샘플을 구현해본 결과, 아래와 같이 잘 작동하였다. 또한 address map lock bit는 1로 세팅된 이후에는 0으로 시스템이 종료될때까지 초기화하지 못하도록 설정할 수 있었다.

    PCI COMMAND는 PCIe 컨트롤러에 있는 레지스터 중 하나로, 이 레지스터의 11번째 비트를 address map lock bit로 구현하였다. 데이터시트에는 이 비트가 RO로 되어있지만, QEMU에서 이 비트를 RW로 설정할 수 있다.

    ![pci_command_register](/assets/images/protected/170427/pci_command_register.png){: .center-image width="800px"}
    * PCIe 컨트롤러에 있는 PCI COMMAND 레지스터의 Specification. 인텔의 칩셋 데이터시트에서 찾을 수 있음. 11~15번째 비트는 Reserved로 되어 있으며 RO로 세팅되어 있음. 11번째 비트를 RW로 바꾸고 address map lock bit로 설정한다. 기본값은 0이며 1로 세팅할 경우 0으로 바꿀 수 없고, 1로 세팅된 시점 이후부터 BAR에 접근하는 요청을 PCIe 컨트롤러에서 모두 차단한다.
    {: .center}

    ![bar_access_lock_diagram](/assets/images/protected/170427/bar_access_lock_diagram.png){: .center-image width="800px"}
    * Guest VM의 BAR 접근을 차단하는 구조도. QEMU에 있는 에뮬레이트된 PCIe 컨트롤러를 수정해 address map lock bit가 세팅되어있을 경우 GPU의 BAR 레지스터 액세스를 차단한다.
    {: .center}

    ![test_bar_read1](/assets/images/protected/170427/test_bar_read1.png){: .center-image width="500px"}
    * Address map lock 후 BAR 읽기 요청을 거부하는 시스템 테스트
    {: .center}

    ![test_bar_read2](/assets/images/protected/170427/test_bar_read2.png){: .center-image width="800px"}
    * 이 때 QEMU에서는 BAR가 lock되어 요청을 차단했음을 로그를 기록한 모습.
    {: .center}

    ![address_map_lock1](/assets/images/protected/170427/address_map_lock1.png){: .center-image width="500px"}
    * address map lock bit를 0으로 세팅하려는 시도를 거부하는 시스템 테스트
    {: .center}

    ![address_map_lock2](/assets/images/protected/170427/address_map_lock2.png){: .center-image width="800px"}
    * 이 때 QEMU에서는 address map lock bit 초기화 시도가 있었음을 기록한 모습.
    {: .center}

2. **특정 enclave (GPU Enclave)가 특정 MMIO 영역을 독점적으로 소유할 수 있다는 것을 증명해야 한다.**

    1. GPU Enclave가 초기화되면서 특정 B.D.F 번호를 가진 GPU에 대해 MMIO 영역 소유를 GPU-SGX에게 요청한다.
    2. GPU-SGX는 먼저 1번에서 언급한 대로 address map lock이 되어있는지 PCIe controller와 레지스터를 확인해 체크한다. 이 과정은 하드웨어적으로 진행되므로 OS가 개입할 수 없다.
    3. Address map lock이 되어 있다면, GPU-SGX는 GPU-Enclave의 enclave ID와 함께 해당 GPU의 MMIO 영역의 물리 주소를 SGX 내부 구조에 저장한다. 이 자료구조는 기존 SGX의 SECS와 같이 소프트웨어에서는 접근하지 못하는 SGX 내부 자료구조이므로, OS가 변경할 수 없다.
    4. 이후 같은 GPU에 대한 소유 요청은 전부 거부하며, 등록된 GPU의 MMIO에 접근할 때 해당 프로세스가 GPU Enclave인지 아닌지를 판별하고 GPU Enclave에서 접근하는 것이 아닐 경우 MMIO 접근을 거부한다.  
    이는 기존 SGX가 어떤 enclave에서 EPC page에 접근할 때 EPC page의 소유자와 일치하는지 확인하는 과정을 응용해 구현할 수 있다.

    > **1, 2번에서 서술한 방법을 통해서, <mark>다음 항목들이 보장</mark>된다.**
    >
    > 1. 특정 GPU는 단 하나의 GPU Enclave에게만 소유된다.
    > 2. GPU가 매핑된 MMIO는 GPU Enclave가 초기화된 후 변경되지 못한다.
    > 3. GPU Enclave 판별 매커니즘을 통해 GPU를 소유하고 있는 GPU Enclave만이 해당 GPU의 MMIO 영역에 접근할 수 있다.


3. **GPU device driver를 MMIO와 Interrupt handler를 별도로 분리시키는 것이 가능한가?**

    CUDA open source 소프트웨어인 gdev 내부 코드를 자세히 분석한 결과, **GPGPU 컴퓨팅 과정에서 인터럽트를 사용하지 않는 것으로 나타났다.** 논문 *Implementing Open-Source CUDA Runtime* 에서도 polling을 사용한다고 되어 있었으나 인터럽트 핸들러를 완전히 사용하는지는 확실하지 않았었지만, 실제 코드 확인 결과 인터럽트 핸들러를 전혀 사용하지 않는 것을 확인했다. 논문을 요약하자면 NVIDIA GPU는 fence라는 기술을 사용해 MMIO 영역에서 특정 위치의 값을 계속하여 polling한다. 이 값이 바뀔 경우 GPU 커널 실행이 끝난 것을 의미한다. (synchronize 함수인 cuMemcpy, cuCtxSynchronize 함수에 대해서 fence만 사용하도록 구현되어 있음)

    MMIO에 접근하는 것 자체는 유저스페이스 애플리케이션에서 가능한 일이므로, 기존 커널 영역에 있는 device driver의 역할을 축소하고 MMIO 접근 기능을 애플리케이션으로 분리하는 것은 가능하다. 단, Gdev는 MMIO 영역 할당을 위해 Nouveau 디바이스 드라이버를 사용하는데, Nouveau 디바이스 드라이버에서 MMIO를 어떻게 할당하고 있는지는 조금 더 분석이 필요하다.

4. **OS가 Interrupt handler만 가지고는 GPU에서 정보를 뽑아낼 수 없다는 것을 증명해야 한다.**

    Interrupt handler를 사용하지 않는 것으로 밝혀졌다. 여전히 유저 프로세스가 GPU를 사용하려면 디바이스 드라이버의 도움을 받아 GPU Enclave 프로세스를 깨워서 통신해야 하지만, 이 과정에서 유저 데이터는 암호화되어 전달되므로 OS에서 데이터를 볼 수 없다.

    또한 GPU Enclave 프로세스만이 MMIO 영역에 접근 가능하므로, 디바이스 드라이버 코드는 GPU의 데이터 영역에 접근할 수 없다.


    > **3, 4번에서 서술한 바를 정리하면, 커널 영역의 디바이스 드라이버의 역할은 아래와 같다.**
    >
    > 1. 인터럽트 핸들러는 사용하지 않는다.
    > 2. 커널 영역의 디바이스 드라이버에서 GPU의 MMIO 영역에는 접근하지 못한다.
    > 3. 커널 영역의 디바이스 드라이버가 하는 일: GPU Enclave 프로세스가 sleep 상태일 때, 유저 프로세스가 디바이스 드라이버에게 GPU Enclave 프로세스 깨우기 및 유저 프로세스 Enclave와 GPU Enclave 간 통신 중재를 요청한다. Diffie-Hellman 라이브러리를 사용해 공유 메모리 공간 생성 및 shared secret 키를 생성한 후에는 디바이스 드라이버의 중재를 거치지 않고 Enclave 간 통신을 수행한다.


5. **IO 영역은 privilege 레벨이 필요한데 GPU enclave 프로세스가 이 영역에 접근할 수 있는 방법에 대해 증명하기**

    IO port를 통해 디바이스에 접근할 때는 IO instruction이 privilege 레벨을 요구한다.  
    그러나, MMIO를 통해 디바이스에 접근할 때는 **유저 프로세스라도 MMIO 영역에 대한 virtual address만 있으면 이후에는 privilege 레벨 없이 MMIO 영역에 접근 가능하다는 것을 확인** 하였다. [\[링크\]](/protecteduic2ws/2017-04-03/gpu-enclave-protection-mechanism/)

    단 MMIO 영역 주소에 매핑된 virtual address를 받아오기 위해서는 여전히 privilege 레벨이 필요하다. 이는 기존 SGX에서 EPC 페이지에 매핑된 virtual address를 얻기 위해서는 커널의 도움을 받는 것과 비슷하다. 여전히 커널의 도움을 받아야 하지만, 기존 SGX와 비슷하게 매핑이 유효한지를 검사하는 매커니즘을 추가할 것이다.

    > **기존 SGX에서 EPC 페이지가 매핑된 virtual address를 커널로부터 받는 방법**
    >
    > - 기존 SGX는 EPC page의 physical address를 커널에게 넘기며 해당 주소에 매핑된 virtual address를 커널에게 요청하고, 돌아온 virtual address를 SGX의 내부 자료구조에 기록한다.
    >
    > - 추후 이 EPC page에 유저 프로세스가 다시 접근했을 때 MMU에서 기록한 virtual address와 방금 address translation을 통해 생성한 virtual address가 일치하는지 확인한다.
    >
    > - 일치하지 않으면 커널에 의해 페이지 테이블이 수정되었다는 의미이므로, 접근을 거부한다.

    같은 방법으로, GPU-SGX는 커널에게 MMIO 영역 물리 주소를 넘기며 이 영역에 대한 virtual address를 요청한다. 받은 virtual address를 SGX 내부 자료구조에 저장해 두고, 다음에 유저 프로세스가 MMIO 영역에 접근할 때 MMU에서 페이지 테이블 변형이 일어나지 않았는지 검사하게 된다.
