---
layout: post
title: "[CS570] Paper Review"
date: "2017-04-08 15:27:28 +0900"
author: "Insu Jang"
tag: [cs570, deep learning, super resolution]
math: true
---

### Paper Title
Accurate Image Super-Resolution Using Very Deep Convolutional Networks (VDSR)  
Published in CVPR 2016

### Authors
Jiwon Kim, Jung Kwon Lee and Kyoung Mu Lee  
Department of ECE, ASRI, Seoul National University, Korea

### Paper Review Form
1. What is this paper about?
2. Specific problem being tackled
3. Importance of problem
4. Other attempts described and their shortcomings
5. Contributions of this work
6. New model, technique, or approach proposed
7. Advantages of the proposed solution
8. Limitations of the proposed solution
9. Results presented

Review

1. What is this paper about?  
This paper is about a highly accurate single-image super resolution (SISR) method.

2. Specific problem being tackled  
The authors tackled that the existing approaches are too slow for both training and super-resolution. They mainly improved speed, but also performance and some other important model properties are also improved.

3. Importance of problem  
SISR is widely used in computer vision applications ranging from security and surveillance imaging to medical imaging where more image details are required on demand. So many SISR methods have been studied in the computer vision community.

4. Other attempts described and their shortcomings  
Dong et al. has demonstrated that a CNN can be used to learn a mapping from low-resolution (LR) to high-resolution (HR), termed SRCNN.
SRCNN is a representative state-of-art method for deep learning-based SR approach.  
While SRCNN successfully introduced a deep learning technique into the super-resolution (SR) problem, the authors find its limitations in three aspects.  
- It relies on the context of small image regions.
- Training converges too slowly.
- The network only works for a single scale.  
SRCNN is trained for a single scale factor and is supposed to work only with the specified scale. Thus, if a new scale is on demand, a new model has to be trained.  
However, preparing many individual machines for all possible scenarios to cope with multiple scales is inefficient and impractical.

5. Contributions of this work
- Utilize information spread over very large image regions.
- Suggest a way to speed-up the training: residual-learning CNN and extremely high learning rate.
- Propose a single-model super resolution approach. Scales are typically user-specified and can be arbitrary including fractions.
- Relatively accurate and fast in comparison to state-of-art methods.

6. New model, technique, or approach proposed
- **Very Deep Network and High Learning Rate**  
SRCNN failed to observe superior performance improvement from using deeper model. However, the authors used a very deep convolutional network with 20 weight layers (3 layers in SRCNN), and information used for reconstruction is also much larger (41x41 vs 13x13 in SRCNN).  
One possible reason for SRCNN to failed is that they stopped their training procedure before networks converged. It is a basic rule of thumb to make learning rate high to boost training. However, simply setting learning rate high can also lead to vanishing/exploding gradients problem.  
Hence, the authors suggested an adjustable gradient clipping.
- **Adjustable Gradient Clipping**  
With gradient clipping, gradients are in a certain range. For maximal speed of convergence, the authors clipped the gradients to $$[-\frac{\theta}{\gamma}, \frac{\theta}{\gamma}]$$, where $$\gamma$$ denotes the current learning rate.  
With stochastic gradient descent, high learning rate would make $$\theta$$ be tuned to be small to avoid exploding gradients.  
To make $$\theta$$ be moderate enough while keeping high learning rate, the authors used gradient clipping, which bounds the pre-defined gradient $$[-\frac{\theta}{\gamma}, \frac{\theta}{\gamma}]$$.
- **Single Model for Multiple Scales**  
Typically, one network is created for each scale factor. We need an economical way to store and retrieve networks. So, the authors trained a multi-scale model. Parameters are shared across all predefined scale factors.
- **Residual Learning**  
The authors proposed a network structure that learns residual images.  
SRCNN must preserve all input detail since the image is discarded and the output is generated from the learned features alone. In this model, the authors argued that the vanishing/exploding gradients problem should be critical.  
As the input and output images are largely similar, they defined a residual image $$r=y-x$$, where $$x$$ is a low-resolution  image, and $$y$$ is a high-resolution image.  

![vdsr_architecture](/assets/images/protected/170408/vdsr_architecture.png){: .center-image width="800px"}

This residual learning brought big performance improvement for both converge speed and performance. The author's experiments showed that residual network converges faster than the standard non-residual network, and showed higher performance as well.

7. Advantages of the proposed solution  
<!-- Same with 5?  -->
- Much faster than existing approach
- Have strength for edge / line super resolution.
- Much faster converge rate
- Trainable for multi-scale low resolution images

8. Limitations of the proposed solution  
Some limitations are already proposed by Iljun Ahn and Woohyun Nam, which is that this work still suffers from limited performance on texture regions that consist of very complex and fine patterns.

![vdsr_vs_hrst](/assets/images/protected/170408/vdsr_vs_hrst.png){: .center-image width="800px"}

9. Result Presented  
![vdsr_result](/assets/images/protected/170408/vdsr_result.png){: .center-image}

The authors compared this work with state-of-art methods, including SRCNN. Compared methods are A+, RFL, SelfEx, and SRCNN.
PSNR and SSIM are used as performance metrics.  
They provided the processing time as well, to show that this work is relatively fast. One unfair thing is that they said the public code of SRCNN is based on CPU implementation, which is much slower that the GPU implementation in the paper.  
They also provided all result images on their webpage, so we can transparently see which image data is good for this work or not.

<!--
Write a 2- or 3-paragraph related work section as follows:  
Paragraphs should be about
- 1 paragraph about the problem and approaches: Describe the problem you are tackling, and describe papers that approach the problem in different ways (e.g., deep neural network, SVM, graphical model, etc.)
- 1 or more paragraph about approaches in the same direction as your solution: Describe several papers that approach the problem in the same direction as your solution. For example, if your approach is to use deep learning (e.g., convolutional neural network), describe other papers that also used deep learning.
-->
