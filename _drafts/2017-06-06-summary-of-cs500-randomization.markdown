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

e.g.) $$2x + 3xy^2$$ is a polynomial of two variables with degree 3. It has two monomials $$x$$ with coefficient 2 and $$xy^2$$ with coefficient 3.

e.g.) $$0x^3 + 4x^2 + 3x - 1$$ is a polynomial of a single variable with degree 2.

There is no known deterministic algorithm for deciding PIT.

# The Schwartz-Zippel Lemma
Let $$p(x_1, ..., x_n)$$ be a polynomial of total degree d. Assume that p is not identically zero. Let $$S ⊂ F$$ be *any finite subset*. Then, if we pick $$y_1, ..., y_n$$ independently and uniformly from S,

$$\text{Pr}[p(y_1, ..., y_n) = 0] \le \frac {d}{\|S\|}$$.

If the polynomial $$p$$ evaluates to zero, it is highly unlikely that $$p$$ is nonzero: the probability that $$p$$ evalulates to zero when it's not identically zero is quite small, especially when $$\|S\| \ge d$$.

**Proof by induction on n**.

*The base case*: With $$n=1$$, then the problem is reduced to the univariate case.

*The inductive step*: First, fix $$x_1, ..., x_{n-1}$$ arbitrarily. Then all values in $$p(x_1, ..., x_n)$$ are known except for $$x_n$$, so $$p$$ becomes a univariate polynomial of $$x_n$$ of degree $$k$$, for some $$k \le d$$:

$$p(x_n) = a_k x_n^k + a_{k-1} x_n^{k-1} + ... +a_1 x_n^1 + a_0$$

The problem is reduced to the univariate case again, so the probability for $$p$$ to be zero is small:

$$\text{P}[p(x_n) = 0] \le \frac{k}{\|S\|} \le \frac{d}{\|S\|}$$

> Univariate case: a polynomial of a single variable of degree n
>
> $$p(x) = a_0 x^n + a_1 x^{n-1} + ... + a_{n-1} + a_n$$
>
> Is p identical to zero? It suffices to evaluate $$p$$ at $$(n=1)$$ distinct values of $$x$$, e.g.  
$$p(1), p(2), ..., p(n+1)$$.
>
> If any of them evaluates to nonzero, $$p$$ is clearly not identical to zero. If, on the other hand, all of the (n+1) values are zero, then $$p$$ is indeed identical to zero, then since it has degree n, it would have at most n real roots. Since $$p(1)=p(2)=...=p(n+1)=0$$, p hase at least (n+1) roots among the subset S and thus p must be identically zero.

# Markov Chain for Solving 3-SAT

Recap) **3SAT**: Given a formula F, each clause has exactly 3 literals.  
**3SAT problem**: Decide if F is satisfiable.
