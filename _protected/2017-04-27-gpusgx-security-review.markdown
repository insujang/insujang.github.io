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
    - 특정 enclave (GPU Enclave)가 특정 MMIO 영역(GPU의 BAR)을 가질 수 있다는 것을 증명
    - IO 영역은 privilege 레벨이 필요할텐데 GPU enclave 프로세스가 이 영역에 접근할 수 있는 방법에 대해 증명
