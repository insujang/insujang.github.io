---
layout: post
title: "Summary of CS500: Randomization"
date: "2017-06-06 14:36:27 +0900"
author: "Insu Jang"
tags: [study, cs500]
math: true
---

# Deterministic Algorithm

![cs500_deterministic_algo](/assets/images/170606/cs500_deterministic_algo.png){: .center-image}

Goal: prove that algorithm solves the problem **always correctly** and **quickly**.

# Randomized Algorithm

![cs500_randomized_algo](/assets/images/170606/cs500_randomized_algo.png){: .center-image}

In addition to input, algorithm **takes a source of random numbers and makes random choices during execution**.  
**<mark>Behavior can vary even on a fixed input.</mark>**.

Goal: design algorithm and analyse it to show that this behavior is **likely to be good**, on every input.

> Don't be confused with the probabilistic analysis: probabilistic analysis takes **an input from a probability distribution**.

# Perfect Matching

A perfect matching of a graph is **a matching (i.e., an independent edge set) in which every vertex of the graph is incident to exactly one edge of the matching**.

![perfect_maching](http://mathworld.wolfram.com/images/eps-gif/PerfectMatching_1000.gif){: .center-image}
* Examples of perfect matching.
{: .center}

# Tutte Matrix

A Tutte matrix $$A$$ of a graph is a matrix used to determine the existence of a perfect matching, that is, a set of edges which is incident with each vertex exactly once.

If the set of vertices $$V$$ has $$n$$ elements then the Tutte matrix is an $$ n \times n $$ matrix $$ A$$ with entries

![](https://wikimedia.org/api/rest_v1/media/math/render/svg/c561043329c838bcb168b2751a63f8f7ddeec7e1)

The determinant of this skew-symmetric matrix is a polynomial ($$x_{ij}, i \lt j$$); this is non-zero if and only if a perfect matching exists. (or $$\text{det}(A)$$ should be zero iff $$G$$ has no perfect matching)

# Tutte Determinant

$$ \text{Det}(A) = \sum_{\pi \in P} (-1)^{\text{sign}(\pi)}\Pi^n_{i=1}A_{i, \pi(i)}$$

where $$\text{sign}(\pi)$$ is $$(-1)$$ to the power of the parity of inversions for $$\pi$$, i.e. **the number of pairs $$x \le y$$ for which $$\pi(x) \ge \pi(y)$$**.

> 여기서의 $$\pi$$는 matrix의 각 row를 말하며 $$A_{i, \pi(i)}$$가 matrix에서의 각 element가 된다.
>
> 예를 들어 HW5 Problem 12 (a)의 첫번째 그래프의 Tutte matrix는 아래와 같다.  
\begin{pmatrix}
0 & x_{12} & 0 & x_{14} \\
-x_{12} & 0 & x_{23} & 0 \\
0 & -x_{23} & 0 & x_{34} \\
-x_{14} & 0 & -x_{34} & 0
\end{pmatrix}
>
> n이 4므로 $$\pi$$는 1, 2, 3, 4를 조합한 어떤 수열이 되며, 경우의 수는 $$4!$$이다. 하지만 이 중 $$\Pi^n_{i=1} A_{i, \pi(i)} \ne 0$$을 만족하는 $$\pi$$는 다음과 같다.
>
> $$\pi$$ = {}[2, 1, 4, 3], [2, 3, 4, 1], [4, 1, 2, 3], [4, 3, 2, 1]}
>
> 이유는, $$\Pi^n_{i=1} A_{i, \pi(i)} \ne 0$$을 만들기 위해서는 모든 $$A_{i, \pi(i)} \ne 0$$이어야 하며, 따라서 $$\pi(1)=\pi(3)=2 \text{or} 4$$, $$\pi(2)=\pi(4)=1 \text{or} 3$$이 되어야 한다.
>
> $$\pi_0$$ = [2, 1, 4, 3]에 대하여 계산해보면,  
$$\text{sign}(\pi) = (-1)^2$$ ($$\because 1 \le 2, \pi(1)=2 \ge 1=\pi(2)$$ and
$$3 \le 4, \pi(3)=4 \ge 3=\pi(4)$$).  
$$\pi_1 = x_{12} \times -x_{12} \times x_{34} \times -x_{34} = (x_{12} x_{34})^2$$
>
> $$i=1, 2, 3, 4$$에 대하여 $$\sum_{\pi{i}}$$을 계산할 수 있음.

# Polynomial Identity Testing

Polynomial identity testing (PIT) is **the problem of efficiently determining whether two multivariate polynomials are identical.**  
It can be trivially transformed into the question "Is a certain polynomial equal to 0?".

Given a polynomial $$p(x_1, ..., x_n)$$ over $$F$$, we must decide whether, we can write it as a sum over monomials with various coefficients. For example, given $$p(x, y, z) = (x+2y)(3y-z)$$, we can expand it into a sum of monomials as

$$p(x, y, z) = 3xy + 6t^2 - xz - 2yz$$

The problem is to decide whether, after expanding $$p$$ into monomials, are all coefficients of those monomials equal to zero? If so, we say that $$p$$ is the zero polynomial, or that it is **identically zero**.

The Schewartz-Zippel algorithm provides a practical probabilistic solution, by simply **randomly testing inputs and checking whether the output is zero**.

**Degree of a multivariate polynomial (or even monomial)**: A monomial is any expression of the form $$a \times \Phi_{i=1}^n x_i^{β_i}$$, where $$a \in F$$ and $$\beta_1, ..., \beta_n$$ are non-negative integers. The total degree of that monomial is $$Σ_i \beta_i . The total degree of a polynomial is defined to be the largest total degree of its monomials.

> Degree d 짜리 univariate polynomial에서 근(root)의 개수는 최대 (at most) d개이다.

There is no known deterministic algorithm for deciding PIT.

# The Schwartz-Zippel Lemma
Let $$p(x_1, ..., x_n)$$ be a polynomial of total degree d. Assume that p is not identically zero. Let $$S ⊂ F$$ be any finite set. Then, if we pick $$y_1, ..., y_n$$ independently and uniformly from S,

$$\text{Pr}[p(y_1, ..., y_n) = 0] \le \frac {d}{\|S\|}$$.

<!--
**Proof by induction on n**.

The base case is the case $$n=1$$. As any univariate polynomial of degree d has at most d roots, so the probability that $$y_1$$ is a root is at most $$ \frac{d}{\|S\|}$$.

Assume the theorem is true for polynomials with $$n-1$$ variables, prove it for those with $$n$$ variables.

By using $$\text{Pr}[A] = \text{Pr}[A \land B] + \text{Pr}[A \land \neg B] \le \text{Pr}[B] + \text{Pr}[A \| \neg B] \times \text{Pr}[\neg B]$$,

$$
\begin{equation}
\begin{split}
p(x_1, ..., x_n) \ne 0 &= Σ_{0 \le j \le d} p_j (x_1, ..., x_{n-1}) x_n^j\\
\\
&\le \text{Pr}[p_j(r_1, ..., r_{n-1}) = 0] + \text{Pr}[p(r_1, ..., r_n) = 0 \| p_j (r_1, ..., r_{n-1}) \ne 0]
\end{split}
\end{equation}
$$


Assume the theorem is true for polynomials with $$n-1$$ variables, prove it for those with $$n$$ variables.

*The main idea** obtain polynomials with fewer variables by factoring out the variable $$x_1$$ from $$p$$.

$$p(x_1, ..., x_n) = \Sigma_{i=0}^k x_1^i \times (x_2, ..., x_n)$$

By our choice of $$k$$, the polynomial $$q_k$$ is not identically zero. Furthermore its total degree is at most $$d-k$$, so by induction,

$$Pr[q_k (y_2, ..., y_n) = 0] \le \frac{d-k}{\|S\|}$$
-->
