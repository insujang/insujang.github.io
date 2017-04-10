---
layout: post
title: "Summary of CS500: Introduction"
date: "2017-04-09 13:58:13 +0900"
author: "Insu Jang"
tags: [study,cs500]
math: true
---
# Introduction to Algorithm
## Algorithm vs Heuristic vs Program
**Algorithm**
: An algorithm is a ***finite*** sequence of ***primitive*** instructions that,  
executed according to their ***well-specified semantics***,  
provide a mechanical solution to the *infinitely* many instances of a possibly *complex* ***mathematical problem***.

    - Fully specified input and output
    - It must give the correct answer and must work for all cases
    - Analysis of cost (time and space)
    - ***Proven to yield an optimal result*** (optimality proof)

**Heuristic**
: A heuristic algorithm is an algorithm that is able to produce an acceptable solution in many practical scenarios. But it has ***no proof of correctness***, often involves random elements, and ***may not yield optimal results.***  
> Hence, a heuristic algorithm becomes an algorithm ***after analysing its correctness, running time, etc***.

**Program**
: A program is an ***implementation*** of an algorithm.


## Algorithmic Cost vs Algorithmic Complexity
#### Algorithmic cost: Correctness is not enough
We want an algorithm to do solve a problem ***efficiently***, making the best use of
- Space (***Asymptotic*** number of instructions executed)
- Time (***Asymptotic*** amount of memory used)

#### Algorithmic complexity: Measuring the growth of work
We need a way to measure the rate of growth of an algorithm ***based upon the size of the input***.  
***<mark>Asymptotic cost</mark> of optimal algorithm that solves a problem.***

Example : Big O ($$O$$), Big Omega($$\Omega$$), Big Theta ($$\Theta$$)


## Examples: Strassen's matrix multiplication algorithm
### Naive matrix multiplication
For square $$n \times n$$ matrices $$A$$ and $$B$$, in the product $$C=A \times B$$, we define the entry $$c_{ij}$$, for $$i, j=1,2,...,n$$, by  
$$ c_{ij} = \sum_{k=1}^{n}a_{ik} \times b_{kj} $$

We must compute $$n^2$$ matrix entries, each of which is the sum of $$n$$ values.  
The algorithm takes $$\Theta(n^3)$$ time (Optimal).

### Strassen's recursive algorithm for multiplication
Use ***divide-and-conquer*** algorithm to compute the matrix product $$C$$. (Assume that $$n$$ is an exact power of 2.)

Suppose we partition each of $$A, B,$$ and $$C$$ into four $$\frac{n}{2} \times \frac{n}{2}$$ matrices

$$ A =
\begin{pmatrix}
A_{11} & A_{12} \\
A_{21} & A_{22}
\end{pmatrix}
, B =
\begin{pmatrix}
B_{11} & B_{12} \\
B_{21} & B_{22}
\end{pmatrix}
, C =
\begin{pmatrix}
C_{11} & C_{12} \\
C_{21} & C_{22}
\end{pmatrix}
$$

where

$$
C_{11} = A_{11} \cdot B_{11} + A_{12} \cdot B_{21}, \\
C_{12} = A_{11} \cdot B_{12} + A_{12} \cdot B_{22}, \\
C_{21} = A_{21} \cdot B_{11} + A_{22} \cdot B_{21}, \\
C_{22} = A_{21} \cdot B_{12} + A_{22} \cdot B_{22}
$$

Each of for equations specifies two multiplications of $$\frac{n}{2} \times \frac{n}{2}$$ matrices and the addition of their $$\frac{n}{2} \times \frac{n}{2}$$ products.

With this construction, we have not reduced the number of multiplications.  
To reduce the number of multiplications, we define new matrices

$$
T_1 = (A_{11} + A_{22})(B_{11} + B_{22}), \\
T_2 = (A_{21} + A_{22})B_{11}, \\
T_3 = A_{11}(B_{12} - B_{22}), \\
T_4 = A_{22}(B_{21} - B_{11}), \\
T_5 = (A_{11} + A_{12})B_{22}, \\
T_6 = (A_{21} - A_{11})(B_{11} + B_{12}), \\
T_7 = (A_{12} = A_{22})(B_{21} + B_{22})
$$

Only using 7 multiplications, we may now express the $$C_{ij}$$ in terms of $$T_k$$ as follows:

$$
C_{11} = T_1 + T_4 - T_5 + T_7 \\
C_{12} = T_3 + T_5 \\
C_{21} = T_2 + T_4 \\
C_{22} = T_1 - T_2 + T_3 + T_6
$$

Hence, we obtain the following recurrence for the running time $$T(n)$$ of Strassen's algorithm:

$$
T(n) = \begin{cases}
\Theta(1) & \text{if  } n=1, \\
7T(n/2)+\Theta(n^2) & \text{if  } n>1
\end{cases}
$$

***By the master method***, the recurrence has the solution $$T(n)=\Theta(n^{log_{2}7})$$.

<!--
#### 1. Recursive power function
Given $$x$$, calculate $$x^n$$ with as few multiplications as possible.

- Naive algorithm: $$n-1$$ multiplications
- Inductive improvement: For $$k=\frac{n}{2}$$ calculate $$x^k$$, then $$(x^k)^2=x^n or x^{n-1}$$

Number of multiplications $$T(n) \le T(\frac{n}{2}) + 2$$.
-->


## References
- http://stackoverflow.com/questions/2334225/what-is-the-difference-between-a-heuristic-and-an-algorithm
- http://www.cc.gatech.edu/~bleahy/cs1311/
