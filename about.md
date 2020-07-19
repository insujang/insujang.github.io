---
title: About
permalink: /about/
---

<!-- ![profile](/assets/images/profile.png){: .center-image} -->

## Insu Jang

[[Curriculum Vitae]](/assets/cv/cv_insujang.pdf) &nbsp;&nbsp;
<a href="https://github.com/{{ site.author.github }}"><i class="fa fa-github fa-lg" aria-hidden="true"></i></a> &nbsp;&nbsp;
<a href="https://www.linkedin.com/in/{{ site.author.linkedin }}"><i class="fa fa-linkedin fa-lg" aria-hidden="true"></i></a> &nbsp;&nbsp;
<a href="mailto:{{ site.author.email }}"><i class="fa fa-envelope fa-lg" aria-hidden="true"></i></a>

System Engineer, [TmaxOS](http://tmaxos.com)

#### Education
- M.S., Computer Science,  [KAIST](https://www.kaist.ac.kr/en/), Mar 2016 - Feb 2018 (GPA: 3.99 / 4.3)
- B.S., Computer Science and Engineering, [Sungkyunkwan University](https://www.skku.edu/eng/), Mar 2011 - Feb 2016 (GPA: 4.24 / 4.5)

#### Research Interests
- Computer Architecture
- High Performance Computing
- Cloud Computing
- Parallel Computing

#### Publications
1. **Insu Jang**, Adrian Tang, Taehoon Kim, Simha Sethumadhavan, and Jaehyuk Huh. **"Heterogeneous Isolated Execution for Commodity GPUs"**.
*The International Conference on Architectural Support for Programming Languages and Operating Systems (ASPLOS) 2019*, April 2019

#### Extracurricular Activities
- Vice Student Representative of School of Computing, [School of Computing, KAIST](https://cs.kaist.ac.kr), Mar 2016 - Jul 2016
- Research Intern, [Electronics and Telecommunications Research Institute (ETRI)](https://etri.re.kr/eng/main/main.etri), Jan 2016 - Feb 2016
- Research Intern, [Advanced Institutes of Convergence Technology (AICT)](http://aict.snu.ac.kr/eng/), Jul 2015 - Aug 2015
- Undergraduate Research Assistant, [Networking Laboratory, Sungkyunkwan University](http://monet.skku.edu/), May 2014 - Jul 2015
- Purdue/NIPA Capstone Project, [Purdue University](http://www.purdue.edu/), Jul 2014 - Aug 2014
- Member, [Samsung Software Membership (Korean)](http://secmem.org/), Jan 2013 - Apr 2014
- Student Government Member, [Sungkyunkwan University](https://www.skku.edu/eng/), Apr 2011 - Feb 2012

#### Honors and Awards
- National Scholarship for Science and Engineering, Korea Student Aid Foundation (KOSAF), 2014-2015
- Excellence Award, 2015 Convergence App Contest, Dec 2015
- Dean's List Award, Sungkyunkwan University, Apr 2015
- Dean's List Award, Sungkyunkwan University, Oct 2014
- Grand Prize, 2013 Smart TV App and Peripherals Contest, Nov 2013
- Grand Prize, 2013 Mobile E-learning App Idea Contest, Sep 2013

#### Projects
- **RTSR: Real Time Video Super Resolution**  
(KAIST Spring 2017 CS570 Machine Learning Project)

    Applied a state of the art deep learning based Single Image Super Resolution (SISR) technique named [VDSR](http://www.cv-foundation.org/openaccess/content_cvpr_2016/html/Kim_Accurate_Image_Super-Resolution_CVPR_2016_paper.html) into videos.
    Instead of applying SISR to all video frames, we used it only into I-frame in [the H.264 group of picture structure](https://en.wikipedia.org/wiki/Group_of_pictures) to apply super resolution in real time speed.  
    Implementation is based on [Pytorch](http://pytorch.org/), [VDSR on Pytoch](https://github.com/twtygqyy/pytorch-vdsr),
    [FFmpeg](https://www.ffmpeg.org/), and [a simple FFmpeg player](https://github.com/Akagi201/ffmpeg-player).  

    ![rtsr](/assets/images/projects/rtsr_thumbnail.png)

    [[Report]](/assets/pdf/cs570_final.pdf)
    [[PPT]](/assets/pdf/cs570_final_ppt.pdf)
    [[Youtube]](https://youtu.be/_cVU23W_Jt8)
    

- **HEAD: HardwarE Accelerated Deduplication**  
(KAIST Fall 2016 CS710 Topics in Computing Acceleration with FPGA Project)

    Implemented Xilinx FPGA based implementation for file data dedpuplication.
    Used [Murmurhash](https://en.wikipedia.org/wiki/MurmurHash) for fast, and partial parallel hashing algorithm to boost deduplication fingerprinting process.  
    [[PPT]](/assets/pdf/cs710_final_ppt.pdf)
    [[Code]](https://github.com/insujang/HEAD)

- **SUNSHINE: Service for You to eNhance Self-management Helpfully and Intelligently from Now to forEver**  
(KAIST Spring 2016 CS442 Mobile Computing and Applications Project)

    Proposed an intelligent way to control mobile app execution and Internet browser contents based on
    'contents related factor' analysis. The control is done in a system level, and a prototype implementation is on Android AOSP 5.0.  
    [[Report]](/assets/pdf/cs442_final.pdf)
    [[PPT]](/assets/pdf/cs442_final_ppt.pdf)

    **In October 2019, a similar feature (restricting app executions) called Focus Mode has been implemented in [Samsung Galaxy's One UI 2.0]((https://news.samsung.com/global/one-ui-beta-program-enjoy-android-10-on-galaxy-s10-starting-today)) three years later of our project!**

- **CSMA/CN: Collision Notification for 802.11 WLAN with BLE**  
(KAIST Spring 2016 CS546 Wireless Mobile Internet Project)

    Proposed a way to notify a collision from a router to clients with Bluetooth Low Energy while it is sending its data. Solved a problem of half-duplex Wi-Fi constraints.  
    [[Proposal]](/assets/pdf/cs546_proposal.pdf)
    [[Code]](https://github.com/insujang/csmacn)

- **Energy Aware Real-time Scheduling Algorithm on ARM big.LITTLE HMP Architecture**  
(Sungkyunkwan University Fall 2015 ECE5756 Real Time Systems Special Topics Project)

    Proposed an algorithm to reduce power consumption while keep real-time constraints
    with a low-overhead heuristic mathmatical calculation.  
    [[Report]](/assets/pdf/ece5756_final.pdf)

- **My Summary Note: Automatic Note Summary Application**  
(Sungkyunkwan University Fall 2015 ICE3037 Design Capstone Project)

    Awarded an excellence prize in 2015 Convergence App Contest.
    Proposed an automatic way of user's note summaries in PDFs with a Android tablet.  
    [[Report (Korean)]](/assets/pdf/ice3037_final.pdf)
    [[PPT (Korean)]](/assets/pdf/ice3037_final_ppt.pdf)

- **Data Transmission with Inaudible Sound**  
(A research project as an undergraduate research assistant, Jul 2014 - May 2015)

    Proposed a short-distance data transmission mechanism between microphones and
    speakers embedded in off-the-shelf smartphones.  
    [[Paper (Unpublished)]](/assets/pdf/research_paper_data_communication.pdf)

- **MoleRush: Smart TV - Android Interactive Game**  
(Samsung Software Membership Project, Sep 2013)

    Awarded the grand prize in 2013 Smart TV and Peripherals Contest.
    Designed a game using smartphones as controllers, and a smart TV as a display board.
    At most 4 players can play together, and more families can enjoy the game together by seeing the smart TV.  

    ![molerush](/assets/images/projects/molerush_thumbnail.png)
    [[Youtube]](https://youtu.be/fFzxrAJX9wo)


#### Skills
- C, **C++17**, Python, Go
- KVM, QEMU
- CUDA
- Vivado HLS, Petalinux
- Intel Software Guard Extensions (SGX)
- Kubernetes, Docker
- Infiniband RDMA

## License
This blog is using modified [Kiko-plus](https://github.com/aweekj/Kiko-plus) theme for the entire webpages and [Tomorrow](https://github.com/chriskempson/tomorrow-theme) theme, embedded in [jekyll TeXt](https://github.com/kitian616/jekyll-TeXt-theme) theme, for code highlight.
It is powered by [Github Pages](https://pages.github.com/).

Copyright (c) 2016 AWEEKJ(Hanju Jamie Jo), Copyright (c) 2017 Tian Qi

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
