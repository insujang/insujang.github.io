---
layout: post
title: "Summary of CS500: NP Completeness"
date: "2017-06-06 14:36:16 +0900"
author: "Insu Jang"
tags: [study, cs500]
math: true
---

# NP-completeness and the classes P and NP

![NP](https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/P_np_np-complete_np-hard.svg/600px-P_np_np-complete_np-hard.svg.png){: .center-image}
* Euler diagram for P, NP, NP-complete, and NP-hard set of problems.
{: .center}

1. The class P consists of problems that are **solvable in polynomial time**.
2. The class NP consists of problems that are **verifiable in polynomial time**.
        * Verifiable: given a certificate of a solution, we could verify that the certificate is correct.

3. Any problem in P is also in NP, since if a problem is in P then we can solve it in polynomial time without being given a certificate.
4. A problem is in the class NP-complete, **if it is in NP and is as hard as any problem in NP**.
        * If any NP-complete problem can be solved in polynomial time, then every problem in NP has a polynomial time algorithm. ($$\therefore P = NP$$)`
        * However, no polynomial-time algorithm has ever been discovered for any NP-complete problem, hence theoretical computer scientists believe that $$ P \ne NP$$.

# Polynomial-time Reduction

If a problem Y can be reduced to problem X, we denote it by $$Y \le {}_{p}X$$, which means **"Y is polynomial-time reducible to X"**.  
If a problem Y reduces to another problem X, then Y is, in a sense, **"no harder to solve" than X**.

* Reduction function: the function $$f$$ is called the **reduction function** if $$x \in Y$$ and $$f(x) \in X$$
* Reduction algorithm: a polynomial-time algorithm $$F$$ that computes $$f$$ is called a reduction algorithm.

Suppose

1. $$Y {}_{p}X$$, and
2. There is a polynomial time algorithm for $$X$$,

Then, there is a polynomial time algorithm for $$Y$$. (Lemma 34.3, p 985)

> **Proof:** Let $$A_2$$ be a polynomial time algorithm that decides $$X$$, and let $$F$$ be a polynomial time reduction algorithm that computes the reduction function $$f$$. We construct a polynomial time algorithm $$A_1$$ that decides $$Y$$.
>
> For a given input $$x \in \{0, 1\}^{* } $$, the algorithm $$A_1$$ uses $$F$$ to transform $$x$$ into $$f(x)$$, and then it uses $$A_2$$ to test whether $$f(x) \in X$$. The output of $$A_2$$ is the value provided as the output from $$A_1$$.

# NP-completeness

- Theorem 34.4 (p986)
        If any NP-complete problem is polynomial-time solvable, then $$P = NP$$.  
        If any problem in NP is not polynomial-time solvable, then no NP-complete problem is polynomial-time solvable.

- Lemma 34.8 (p995)
        If $$X$$ is a language such that $$Y \le {}_{p} X$$ for some $$Y \in $$ NP-complete, then $$X$$ is NP-hard.  
        Moreover, if $$Y \in $$ NP, then $$X \in$$ NP-complete.

- **<mark>Proving NP complete</mark>**:
    1. Prove the problem is NP by showing that it is verifiable in polynomial time. P is also NP, hence only verifiability is enough to prove NP.
    2. Prove the problem is NP-hard by showing that $$ \le {}_p SAT$$. In other words, check whether it can be reduced in polynomial time to an instance of formula satisfiability.


<!--
# Circuit satisfiability

We say that a one-output boolean combinational circuit is **satisfiable** if it has a **satisfying assignment: a truth assignment that causes the output of the circuit to be 1**.

As a formal language, we define

CIRCUIT-SAT = $${<C>: C $$ is a satisfiable boolean combinational circuit$$}$$
-->

# Formula Satisfiability

An instance of SAT is a boolean formula $$\phi$$ composed of

1. $$n$$ boolean variables $$x_1, x_2, ..., x_n$$
2. $$m$$ boolean connectives: any boolean function with one or two inputs and one output (e.g. $$\land$$ (AND), $$\lor$$ (OR), $$\neg$$ (NOT), etc)
3. parentheses

- **A truth assignment** for a boolean formula $$\phi$$ is **a set of values for the variables** of $$\phi$$
- **A satisfying assignment** is a truth assignment that **causes it to evaluate to 1**.
- A formula with a satisfying assignment is a **satisfiable formula**.

**Satisfiability**: Given a set of clauses $$C_1, ..., C_k$$ over variable $$X={x_1, ..., x_n}$$, is there a satisfying assignment?

> 3-SAT는 각 clause가 정확히 3개의 literal을 가지고 있을 때의 problem이라고 보면 됨.

SAT = $$\{<\phi>: \phi $$ is a satisfiable boolean formula $$\}$$.

### Example
$$\phi = (x_1 \lor x_2) \land (x_2 \land x_3)$$

has the satisfying assignment $$<x_1 = 0, x_2 = 1, x_3 = 1>$$, and thus this formula $$\phi$$ belongs to SAT.

# 3-CNF Satisfiability (3-CNF-SAT)

- A boolean formula is in **conjunctive normal form (CNF)**, if it is express as an AND of clauses, each of which is the OR of one or more literals.
- A boolean formula is in **3-conjunctive normal form (3-CNF)**, if each clause has exactly three distinct literals.

Example: $$(x_1 \lor \neg x_1 \lor x_2) \land (x_3 \lor x_2 \lor x_4) \land (\neg x_1 \lor \neg x_3 \lor \neg x_4)$$ is in 3-CNF. The first of its three clauses is $$(x_1 \lor \neg x_1 \lor \neg x_2)$$, which contains the three literals.

In 3-CNF-SAT, we are asked whether a given boolean formular $$\phi$$ in 3-CNF is satisfiable.

***Satisfiability of boolean formulas in 3-CNF is NP-complete.***

# Disjunctive Normal Form (DNF)

Used in proving satisfiability of boolean formulas in 3-CNF is NP-complete.

**DNF**: A disjunction ($$\lor$$) of one or more conjunctions ($$\land$$) of one or more literals.

e.g.: $$ (y_1 \land y_2 \land x_2) \lor (y_1 \land \neg y_2 \land x_2)$$

### Converting CNF to DNF

Use De Morgan's laws.

$$A \lor (B \land \neg A) = (A \lor B) \land (A \lor \neg A) = A \lor B$$

# Clique Problem
A *clique* in an undirected graph $$ G= (V, E)$$ is **a subset $$V' \subseteq V$$ of vertices**, each pair of which is connected by an edge in $$E$$ (e.g. vertices are adjacent). The *size** of a clique is the number of vertices it contains.

> 특정 vertex (개수 k개)에 대하여 해당 vertex가 모두 연결되어 있으면 k-clique을 만족한다고 한다.

$$\text{CLIQUE} = \{<G, k> : G \text{is a graph with a clique of size} k. \}$$

Proving the clique problem is NP-complete

1. show that $$\text{CLIQUE} \in \text{NP}$$, checking whether $$V'$$ is a clique and for each pair $$u, v \in V'$$, the edge $$(u, v)$$ belongs to $$E$$.
2. show that $$\text{CLIQUE} \in \text{NP-hard}$$, checking whether $$\text{3-CNF-SAT} \le {}_p \text{CLIQUE}$$.

# Vertex Cover Problem
A *vertex cover* of an undirected graph $$G = (V, E)$$ is **a subset $$V' \subseteq V$$** such that if $$(u, v) \in E$$, then $$u \in V'$$ or $$v \in \V'$$ or both.
The size of a vertex cover is the number of vertices in it.

**업데이트**: Vertex cover is that, given an undirected graph $$G = (V, E)$$, find the last number $$k$$ of vertices such that every edge $$e \in E$$ is incident to at least one vertex from the set.

**The vertex cover problem** is to find a vertex cover of minimum size in a given graph.

### VC to SAT reduction

Number of vertex cover (k) = minimum vertex cover number + the size of a maximum independent set (Gallai 1959)



### cf) edge cover problem

For a graph $$G$$, find a smallest subset $$F$$ of edges s.t. any vertex $$v$$ is adjacent to at least one edge $$e \in F$$.

# Independent Set (IS)

Given graph G and a number k, does G contain a set of at least k independent vertices?

An independent set is a set of vertices such that no pair of vertices in the set is adjacent.

It can be reduced to vertex cover problem:  
Given a graph G and a number k, does G contain a vertex cover of size at most k?

**If $$G=(V, E)$$ is a graph, then S is an independent set <=> V-S is a vertex cover. (= $$IS \le _{p} VC$$)**


# Definition of NP

**Relationship**: 3SAT $$ \le_{p}$$ Independent set $$\le_{p}$$Vertex Cover $$\le_{p}$$Set Cover  
3SAT $$\le_{p}$$SAT$$\le_{p}$$3SAT
