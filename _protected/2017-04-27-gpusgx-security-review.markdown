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

- 가정들
    1. 우리의 Threat Model은 Remote Software Attack을 막는 것. 공격자가 하드웨어적으로 접근하지 못한다고 가정한다.
    2. IO 디바이스에는 MMIO와 PMIO로 접근 가능하다. 하지만 I/O port는 실제로 거의 사용되지 않으므로, GPU에 접근할때는 I/O port가 사용되지 않고 MMIO로만 접근한다고 가정한다. \[레퍼런스: GPUvm\]

- Security 측면에서 다음 질문에 대한 답이 필요
    - OS가 IO path를 변조하지 못하게 하드웨어적으로 막는 것이 가능한가?
    - GPU device driver를 MMIO와 Interrupt handler를 별도로 분리시키는 것이 가능한가?
    - 커널 영역에는 Interrupt handler만이 있을 것. 그러면 OS가 Interrupt handler만 가지고는
    GPU에서 정보를 뽑아낼 수 없다는 것을 증명해야 한다.
    - 특정 enclave (GPU Enclave)가 특정 MMIO 영역(어떤 GPU의 BAR)을 가질 수 있다는 것을 증명
    - IO 영역은 privilege 레벨이 필요할텐데 GPU enclave 프로세스가 이 영역에 접근할 수 있는 방법에 대해 증명

# 고안한 해답들
1. **OS가 IO path를 변조하지 못하게 하드웨어적으로 막는 것이 가능한가?**

    IO path는 시스템 전체에서 두 군데에 저장되어 있다: 1) PCI 디바이스에 하드웨어적으로 존재하는 레지스터 (BAR), 2) 레지스터 값을 복사해 저장하고 있는 리눅스 커널 영역의 자료 구조.

    ![](https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Pci-config-space.svg/1280px-Pci-config-space.svg.png){: .center-image width="450px"}
    * Figure: PCIe configuration sapce header for type0
    {: .center}

    리눅스 커널을 믿지 못하므로 커널 영역의 자료 구조는 신뢰하지 말아야 하며, 또한 PCI 디바이스에 하드웨어적으로 존재하는 레지스터에 OS가 접근해 악의적으로 MMIO 주소를 바꾸지 못하도록 해야 한다.  
    MMIO 주소는 위 PCI configuration space에서 BAR 레지스터에 저장되어 있으며, 다음 두 가지 방법으로 접근 가능하다.

    1. CPU I/O port (0xCF8: PCI CONFIG ADDRESS REGISTER, 0xCFC: PCI CONFIG DATA REGISTER)

    2. MMIO

    두 가지 방법 중 어느 것을 쓰더라도, PCI 디바이스에 데이터를 쓰기 위해서는 ***CPU와 PCI device를 이어주는 PCIe root complex를 거치게 된다. Root Complex는 PCI Express Specification에 적힌대로 CPU/memory 시스템과 PCI I/O를 연결하는 root이다.***

    ![](https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Example_PCI_Express_Topology.svg/400px-Example_PCI_Express_Topology.svg.png){: .center-image width="600px"}
    * PCI Express 시스템 구조. CPU에서 동작하는 소프트웨어의 PCI 디바이스에 대한 읽기/쓰기는 무조건 PCIe root complex를 거치게 된다.
    {: .center}

    또한, PCI Express 프로토콜은 TCP/IP와 비슷하게 여러 레이어로 구성된 Transaction Layer Packet을 사용해 디바이스 간 통신을 하는데, CPU에서 동작하는 소프트웨어가 PCIe 디바이스에 접근하려 할 경우 이 접근에 해당하는 패킷을 생성하는 것은 PCIe root complex이다.  
    따라서, **<mark>PCIe root complex 내부에 있는 PCIe 컨트롤러를 수정함으로써 소프트웨어에서 PCI 디바이스의 BAR 값에 접근하는 행위를 차단</mark>할 수 있다.** PCIe 컨트롤러에 이미 존재하는 하드웨어 레지스터 중 1비트를 사용해 차단/허용 여부를 결정하도록 설정할 수도 있다. 예를 들어, 해당 비트 값이 1이면 PCIe 컨트롤러는 BAR에 접근하는 요청을 모두 차단한다.

2. **특정 enclave (GPU Enclave)가 특정 MMIO 영역을 독점적으로 소유할 수 있다는 것을 증명해야 한다.**

    1. GPU Enclave가 초기화되면서 특정 B.D.F 번호를 가진 GPU에 대해 MMIO 영역 소유를 GPU-SGX에게 요청한다.
    2. GPU-SGX는 먼저 1번에서 언급했었던 address map lock이 되어있는지 PCIe controller와 레지스터를 확인해 체크한다. 이 과정은 하드웨어적으로 진행되므로 OS가 개입할 수 없다.
    3. Address map lock이 되어 있다면, GPU-SGX는 GPU-Enclave의 enclave ID와 함께 해당 GPU의 MMIO 영역의 물리 주소를 SGX 내부 구조에 저장한다. 이 내부 구조는 기존 SGX의 SECS와 같이 소프트웨어에서는 접근하지 못하는 SGX 내부 자료구조이므로, OS가 변경할 수 없다.
    4. 이후 같은 GPU에 대한 소유 요청은 거부하며, 등록된 GPU의 MMIO에 접근할 때 해당 프로세스가 GPU Enclave인지 아닌지를 판별하고 GPU Enclave에서 접근하는 것이 아닐 경우 MMIO 접근을 거부한다.  
    이는 기존 SGX가 EPC page에 접근할 때 사용하는 액세스 보호 메커니즘을 응용해 구현할 수 있다. (Intel SGX Explained, Figure 86)

    > **1, 2번에서 서술한 방법을 통해서, <mark>다음 항목들이 보장</mark>된다.**
    >
    > 1. GPU는 한 번 등록이 완료되면 다른 GPU Enclave에게 등록되지 못한다. 따라서, 특정 GPU는 단 하나의 GPU Enclave에게만 소유된다.
    > 2. GPU Enclave 초기화는 Address Map Lock 이후에만 정상적으로 이루어진다. 따라서, GPU가 매핑된 MMIO는 GPU Enclave가 초기화된 후 변경되지 못한다.
    > 3. GPU Enclave 판별 매커니즘을 통해 GPU를 소유하고 있는 GPU Enclave만이 해당 GPU의 MMIO 영역에 접근할 수 있다. 이 때 MMIO 영역 주소와 프로세스가 접근하는 주소를 비교해 페이지 테이블 변형이 일어나지 않았는지 검사한다.

    <br/><br/>

3. **GPU device driver를 MMIO와 Interrupt handler를 별도로 분리시키는 것이 가능한가?**

    CUDA open source 소프트웨어인 gdev 내부 코드를 자세히 분석한 결과, **GPGPU 컴퓨팅 과정에서 인터럽트를 사용하지 않는 것으로 나타났다.** 논문 *Implementing Open-Source CUDA Runtime* 에서도 polling을 사용한다고 되어 있었으나 인터럽트 핸들러를 완전히 사용하는지는 확실하지 않았었지만, 실제 코드 확인 결과 인터럽트 핸들러를 전혀 사용하지 않는 것을 확인했다. 논문을 요약하자면 NVIDIA GPU는 fence라는 기술을 사용해 MMIO 영역에서 특정 위치의 값을 계속하여 polling한다. 이 값이 바뀔 경우 GPU 커널 실행이 끝난 것을 의미한다. (synchronize 함수인 cuMemcpy, cuCtxSynchronize 함수에 대해서 fence만 사용하도록 구현되어 있음)

    MMIO에 접근하는 것 자체는 유저스페이스 애플리케이션에서 가능한 일이므로, 기존 커널 영역에 있는 device driver의 역할을 축소하고 MMIO 접근 기능을 애플리케이션으로 분리하는 것은 가능하다.

4. **OS가 Interrupt handler만 가지고는 GPU에서 정보를 뽑아낼 수 없다는 것을 증명해야 한다.**

    Interrupt handler를 사용하지 않는 것으로 밝혀졌다. 여전히 유저 프로세스가 GPU를 사용하려면 디바이스 드라이버의 도움을 받아 GPU Enclave 프로세스를 깨워서 통신해야 하지만, 이 과정에서 유저 데이터는 암호화되어 전달되므로 OS에서 데이터를 볼 수 없다.

    또한 GPU Enclave 프로세스만이 MMIO 영역에 접근 가능하므로, 디바이스 드라이버 코드는 GPU의 데이터 영역에 접근할 수 없다.


    > **3, 4번에서 서술한 바를 정리하면, CUDA-SGX 모델에서 커널 영역의 디바이스 드라이버의 역할은 아래와 같다.**
    >
    > 1. 인터럽트 핸들러는 사용하지 않는다.
    > 2. 커널 영역의 디바이스 드라이버에서 GPU의 MMIO 영역에는 접근하지 못한다.
    > 3. 커널 영역의 디바이스 드라이버가 하는 일: GPU Enclave 프로세스가 sleep 상태일 때, 유저 프로세스가 디바이스 드라이버에게 GPU Enclave 프로세스 깨우기 및 유저 프로세스 Enclave와 GPU Enclave 간 통신 중재를 요청한다. Diffie-Hellman 라이브러리를 사용해 공유 메모리 공간 생성 및 shared secret 키를 생성한 후에는 디바이스 드라이버의 중재를 거치지 않고 Enclave 간 통신을 수행한다.  
    디바이스 드라이버는 따라서 프로세스를 깨우는 역할과 GPU Enclave가 다른 프로세스와 통신중일 경우 에러를 리턴하는 역할만을 수행한다.

    <br/><br/>

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
