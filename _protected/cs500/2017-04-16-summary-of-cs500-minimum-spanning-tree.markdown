---
layout: post
title: "Summary of CS500: Minimum Spanning Tree"
date: "2017-04-16 15:51:12 +0900"
author: "Insu Jang"
tags: [study, cs500]
math: true
---
# Minimum Spanning Tree (MST)
A tree is a connected, undirected graph without any cycles.

***A minimum spanning tree*** is a subset of the edges of a graph (connected, weighted, and undirected), **without any cycles** and **with the minimum possible total edge weight**.

![mst](https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Minimum_spanning_tree.svg/450px-Minimum_spanning_tree.svg.png){: .center-image}
* A planar graph and tis minimum spanning tree.
{: .center}

Two algorithms for MST creation that we learned in the class:
- Prim's algorithm
- Kruskal's algorithm

## 1. Prim's Algorithm
Pseudocode

```
tree := {};
foreach v in vertices:
    v.key = inf; v.neighbor = null;

queue := vertices;
while !queue.isempty():
    // minimum node has the least cost.
    node = queue.extractMin();
    node.key = 0;

    // Add this node into the MST
    // pair<x, y> means the edge connecting x and y
    tree.add(pair<node.neighbor, node>);

    foreach v adjacent to node:
        // If cost can be smaller, update the neighbor.
        if weight(v, node) < v.key:
            v.neighbor = node;
            queue.decreaseKey(v, weight(v, node));
```

![mst_prim2](/assets/images/170416/mst_prim2.png){: .center-image}
* Start with an arbitrary node, the red one.
{: .center}

![mst_prim3](/assets/images/170416/mst_prim3.png){: .center-image}
* `queue.extractMin()` chooses the yellow vertex, as it has the least cost.  
The edge connecting the red and the yellow is added into the MST by `tree.add()`.
{: .center}

![mst_prim4](/assets/images/170416/mst_prim4.png){: .center-image}
* Update key of the yellow one to zero (`node.key = 0`), and also update all vertices' key that are adjacent to `node`.  
`queue.decreaseKey()` function is called twice.
{: .center}

![mst_prim5](/assets/images/170416/mst_prim5.png){: .center-image}
* At the next iteration, `queue.extractMin()` returns the node with key 2, and the edge connecting two yellow nodes is added into the MST.  
This procedure it iterated until queue becomes empty.
{: .center}

### Analysis

> Note that $$/N/$$ means the cardinaliy of the set N. I cannot write any vertical line in markdown.
>
> Also note that $$n \ le /E/ \le \frac{/V/(/V/-1)}{2}$$.

- The outer iteration `while !queue.isempty()` is iterated $$n=/V/ $$ times.
- Hence, `queue.extractMin()` is called $$n$$ times.
    - With Binomial heap, it requires $$O(logn)$$ for each call.
    - With Fibonacci heap, it requires $$O(logn)$$ for each call.
- The inner iteration `foreach v adjacent to node` is iterated at most $$m=/E/ \ge n$$ times.  
The cost of each inner iteration is constant.
- `queue.decreaseKey()` takes
    - $$O(logn)$$ with Binomial heap
    - $$O(1)$$ with Fibonacci heap.

Using Binomial heap, Prim's algorithm costs $$O(m \cdot logn)$$.  
Using Fibonacci heap, Prim's algorithm costs $$O(m+n \cdot logn)$$.

## 2. Kruskal's Algorithm
Pseudocode

```
tree := {};
foreach v in vertices:
    MakeSet(v);

foreach edge(u, v) in "order of increasing weight":
    if u and v do not belong to the same subset:
        tree.add(pair<u, v>);
        union(u, v);   // Expensive, but analysis with amortized cost
```

***With disjoint-set data structure, $$O(m \cdot \alpha(m)) \lt O(m \cdot log^{*}(m))$$***

![mst_kruskal1](/assets/images/170416/mst_kruskal1.png){: .center-image}
* Choose an edge with the least cost in the graph and union two vertices that are connected to the edge.
{: .center}

![mst_kruskal2](/assets/images/170416/mst_kruskal2.png){: .center-image}
* The next edge should be the one with weight 3. As the left vertex was not in the same subet, union it.
{: .center}

![mst_kruskal3](/assets/images/170416/mst_kruskal3.png){: .center-image}
* The next less edge has weight 6, however, two vertices are already in the same subset.  
In this case, if we add this edge into the tree, it has **a cycle.**.
{: .center}

## Reference
- Minimum spanning tree. Wikipedia. https://en.wikipedia.org/wiki/Minimum_spanning_tree
- Prim's algorithm. Wikipedia. https://en.wikipedia.org/wiki/Prim%27s_algorithm
