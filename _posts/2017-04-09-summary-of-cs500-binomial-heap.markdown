---
layout: post
title: "Summary of CS500: Binomial Heap"
date: "2017-04-09 16:11:25 +0900"
author: "Insu Jang"
tags: [study,algorithm,cs500]
math: true
---

## Binomial Trees
The binomial tree $$ B_k $$ is an ordered tree defined recursively.
- Binomial tree or order 0 $$ B_0 $$ consists of a single node.
- The binomial tree $$ B_k $$ consists of two binomial trees $$B_{k-1} $$ that are linked together: the root of one is the leftmost child of the root of the other.
- A binomial tree of order $$ k $$ has a root node whose children are roots of binomial trees of orders $$ k-1, k-2, ..., 2, 1, 0 $$ (in this order).

![binomial_tree](</assets/images/170409/binomial_tree.png>){: .center-image width="800px"}

![](https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Binomial_Trees.svg/1000px-Binomial_Trees.svg.png){: .center-image width="800px"}
* Binomial trees of order 0 to 3.
{: .center}

order
: The order of a binomial tree $$ B_k $$ is $$ k $$.  
A binomial tree of order $$ k$$ has $$ 2^k $$ nodes, and height $$ k $$.

#### Some properties of binomial tree
For the binomial tree $$ B_k $$,

1. There are $$ 2^k $$ nodes
2. The height of the tree is $$ k $$
3. There are exactly $$ \binom{N}{k} $$ nodes at depth $$ i $$ for $$ i = 0, 1, ..., k $$
4. The root has degree $$ k $$, where $$ k > $$ the degree of any other node.

## Binomial Heaps
A binomial heap $$ H $$ is a forest of binomial trees that satisfies the following ***binomial-heap properties.***

1. Each binomial tree obeys the *min-heap property*  
**Min-heap property:** The key of node $$>=$$ the key of its parent.  
Each such tree is called *min-heap ordered*.
2. For any k $$ (k >= 0) $$, there is at most one binomial tree whose root has degree $$k$$.

Binomial tress in the binomial heap are ***sorted by ascending number of children***.

![binomial_heap](http://staff.ustc.edu.cn/~csli/graduate/algorithms/book6/404_a.gif){: .center-image width="800px"}
* An example of binomial heap with $$ n = 13 $$ nodes.
{: .center}

#### Operations of binomial Heaps
1. Creating a new binomial heap ($$ \Theta(1) $$)
2. Finding the minimum node ($$ \Theta(lg_{}n) $$)
3. Merging two binomial heaps ($$ O(lg_{}n) $$)
4. Inserting a node ($$ \Theta(1) $$)
5. Extracting the minimum node ($$ \Theta(lg_{}n) $$)
