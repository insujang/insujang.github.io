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
- OS 부팅 중 GPU Enclave의 정상적인 로딩에 대해서는 그냥 정상적으로 로딩되었다고 가정하고 싶습니다..

### VM 사용하기: 어떻게 새로운 SGX Instruction을 구현할 지
- Intel은 VM Guest 머신에서 SGX를 사용할 수 있도록 수정된 QEMU-KVM(https://github.com/01org/qemu-sgx, https://github.com/01org/kvm-sgx) / Xen(https://github.com/01org/xen-sgx)을 제공 중
- Intel Software Developer's Manual 및 Software Guard Extension Programming Guide에 따르면, VM Execution Control 기능을 통해 ***<mark>특정 ENCLS instruction이 호출될 경우 VMexit을 호출하도록 VMCS를 설정할 수 있음</mark>***.

    ![vmm_control_sgx](/assets/images/vmm_control_sgx.png){: .center-image width="1000px"}

    - *When bits in the "ENCLS-exiting bitmap" are set, execution of the corresponding ENCLS leaf function in the guest results in a VM exit.*

        - ENCLS leaf function: ECREATE, EADD 등의 SGX instruction을 의미
        - ECREATE나 EADD는 개별적인 instruction으로 구현되어 있지 않고 ENCLS의 leaf function으로 구현되어 있음. (= opcode가 모두 동일)
        - ENCLS instruction을 호출할 때 **EAX 레지스터에 저장되어 있는 값에 따라 호출되는 SGX instruction이 달라짐.**
            1. Example) ENCLS, EAX = 0x0: ECREATE
            2. Example) ENCLS, EAX = 0x1: EADD
            3. etc

    - ENCLS-exiting bitmap은 총 64비트 VMCS 필드로, 총 32개+1개의 ENCLS leaf function에 대해 비트맵을 구성할 수 있음. 예를 들어, **<mark>비트맵의 인덱스 1의 비트 값이 1일 경우, EAX = 0x1에 해당하는 EADD가 호출되면 CPU가 VMexit을 호출함.**

- 이를 사용해 새로운 Instruction을 에뮬레이트할 수 있음.
    1. VM의 SGX 드라이버와 SDK를 수정해 함수 인터페이스 제공
    2. KVM-SGX를 수정해 CPU가 새로운 SGX Instruction을 hook해 VMM에게 넘기도록 설정
    3. VMM의 VMexit 핸들러를 추가해 새로운 Instruction을 에뮬레이트
