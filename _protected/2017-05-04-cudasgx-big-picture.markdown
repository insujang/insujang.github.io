---
layout: post
title: "CUDA-SGX Big Picture"
date: "2017-05-04 14:57:46 +0900"
author: "Insu Jang"
comments: false
---

# GPU Enclave

GPU Enclave는 CUDA-SGX의 핵심으로, 소프트웨어에서 GPU에 접근하는 방법은 사실상 MMIO만이 유일하다는 특징을 사용해 GPU로의 접근을 CPU 레벨에서 컨트롤하기 위한 SGX Enclave의 확장 개념이다.

![gpu_enclave_overview](/assets/images/protected/170504/gpu_enclave_overview.png){: .center-image width="1000px"}
* ***Figure 1.*** GPU Enclave 오버뷰: 악의적인 커널이나 프로세스가 GPU를 사용하는 유저 프로세스의 데이터나 컴퓨팅 중인 GPU의 데이터에 접근하지 못하게 막는 것을 목표로 한다.
{: .center}


CUDA-SGX에서 안전한 GPU 컴퓨팅을 위해 보호 기능을 제공해야 하는 영역은 Figure 1에서 빨간색 화살표 영역으로, 다음과 같다.

1. 악의적인 커널 및 프로세스의 GPU MMIO 공격 차단 및 인증된 GPU Enclave만 MMIO에 접근을 허용하는 보호 메커니즘
2. 유저 Enclave - GPU Enclave 간 Inter-Enclave Communication의 보호 메커니즘

<br/><br/>

이런 보호 기능을 제공하기 위해 GPU Enclave 아키텍쳐를 다음 두 섹션으로 나누어 설명할 것이다.

1. **GPU Enclave Creation**: MMIO의 안전한 보호를 위한 알고리즘 설명
2. **User Enclave - GPU Enclave Communication**: 안전한 Inter-Enclave Communication을 위한 알고리즘 설명

## 1. GPU Enclave Creation

먼저 악의적인 프로세스가 MMIO를 통해 공격하는 방법은 다음 두 가지가 있다.

- MMIO 주소를 다른 곳으로 바꿔 유저 데이터가 GPU가 아닌 다른 영역에 저장되게 하여 데이터를 탈취
- MMIO에 매핑된 GPU 메모리에 직접 접근해 GPU 메모리에 저장된 유저 데이터를 탈취

이를 막기 위해서는 다음 조치가 필요하다.

1. **PCI Configuration Space 내 BAR 레지스터 값 변경 차단**

    - 모든 PCI 디바이스는 자신이 매핑된 MMIO 주소를 저장하기 위한 레지스터를 가지고 있으며, Base Address Register(BAR) 라고 부른다. Offset은 0x10 ~ 0x27로, PCI Specification에 의해 표준화되어 있다.
    - OS는 부팅 시 가능한 모든 Bus/Device/Function 번호 조합에 대해 PCI 디바이스의 존재를 탐색하고 BAR 값을 포함한 PCI Configuration Space 정보를 읽어 커널 영역의 메모리에 저장한다. 리눅스 커널은 하드웨어 레지스터 값 대신 커널 영역의 데이터를 사용할 것을 권장한다.
    - **하지만, 우리 연구의 모델은 커널이 untrusted한 환경에 있으므로, 커널 영역의 정보를 사용하지 않고 BAR 레지스터, Bus/Device/Function 정보 등을 SGX 내부 자료 구조에 저장하고 GPU Enclave에서 MMIO에 접근할 때 이 주소값을 사용하도록 한다.**
    - 이 과정에서 SGX가 가지고 있는 정보와 실제 BAR 레지스터 값이 일치해야 한다. 이를 위해, ***<mark>PCIe Root Complex 내부의 PCIe 컨트롤러에 GPU BAR 레지스터 값을 수정하지 못하는 기능을 추가하고, GPU Enclave가 초기화되기 전 이 기능을 사용하도록 한다.</mark>***  

        - PCIe 컨트롤러에도 레지스터가 있는데, 레지스터 중 사용하지 않는 비트 하나를 GPU Address Map Lock Bit라 정한다.
        - 이 값은 초기값이 0이며, 1이 되면 다시 0으로 바꿀 수 없다.
        - 이 값이 1일 경우 PCIe 컨트롤러는 모든 GPU 디바이스 (클래스 코드가 0x0300인 PCI 디바이스)에 대해 BAR 레지스터(offset 0x10 ~ 0x27)에 대한 수정 요청을 거부한다.

2. **GPU Enclave 외의 프로세스가 MMIO 영역에 접근하는 것을 차단**

    - 1번 기능으로 인해 MMIO 영역의 위치는 고정되었지만, 프로세스들은 여전히 MMIO 영역에 접근할 수 있어 MMIO에 매핑된 GPU 메모리에 접근가능하다.
    - ***<mark>GPU Enclave는 초기화 시 자신의 Enclave ID와 자신이 소유할 GPU의 Bus/Device/Function 번호를 SGX에게 넘겨 등록을 요청한다.</mark> 이 등록 정보는 GPU Enclave 초기화 이후 GPU Enclave 외의 프로세스가 MMIO 영역에 접근하는 것을 거부할 때 사용된다.***
    - 접근 허용 알고리즘은 MMU에서 이루어지며, 주소 변환이 끝난 후 Virtual address와 Physical address를 가지고 다음 항목들을 체크한다.
        1. 코드가 GPU Enclave 코드인지 확인한다.
        2. Physical address가 MMIO 영역인지 확인한다.
        3. 해당 MMIO 영역을 가지는 GPU를 GPU Enclave가 소유하고 있는지 확인한다.

> 노란 밑줄 쳐진 부분이 GPU Enclave가 생성될 때 이루어진다.

- GPU Enclave의 생성은 다음과 같이 이루어진다.
    - 커널이 부팅 시 디바이스 드라이버를 로딩한다.
    - 디바이스 드라이버는 자신을 fork하고 GPU Enclave를 실행하는 프로그램을 `exec()`으로 실행한다.
    - 이 프로그램은 바로 GPU Enclave를 생성하도록 만들어진 프로그램이며, 디바이스 드라이버와 같이 배포되는 프로그램이다.

## 2. After Enclave Created

- GPU Enclave 프로세스는 초기화가 끝난 후 Enclave 밖으로 나온다.
- GPU 디바이스 드라이버로 `ioctl()`을 통해 진입해 다른 유저 Enclave가 깨울 때까지 슬립한다.

## 3. User Enclave - GPU Enclave Communication

- 유저 프로세스는 GPU 디바이스 드라이버에 `ioctl()`로 진입해 GPU Enclave를 깨운다. GPU 디바이스 드라이버는 GPU Enclave가 다른 프로세스의 요청을 처리하고 있을 경우 EBUSY를 리턴한다.
- Awaken된 GPU Enclave와 유저 Enclave가 인텔 Diffie-Hellman 라이브러리를 통해 shared secret 키를 생성하고, 데이터 통신에 사용할 공유 메모리를 생성한다.
- 유저 Enclave는 공유 메모리에 생성된 secret 키를 사용해 암호화된 데이터 및 커맨드를 입력하고, GPU Enclave 프로세스는 데이터를 GPU Enclave 내부로 복사한다.
- GPU Enclave 프로세스는 이후 GPU Enclave로 진입해 GPU Enclave 코드와 MMIO 영역을 사용해 GPU로 데이터를 전송한다.
- GPU Enclave는 GPU 커널 실행이 끝날 때까지 polling을 사용해 체크한다.
