---
title: Sorting algorithms
layout: example
---

This example shows how to sort a list of elements in-situ.

> #### listToSort
> - 23
> - 10
> - 17
> - 113
> - 73
> - 42

> ***RUN***
> - worklist := clone(listToSort)
> - selectionSort(worklist)
> - output string(worklist)

> ## selectionSort
>
>  *Selection sort repeatedly iterates the list in order to take the maximal (or minimal) element of the part that needs to be sorted, and build a new list from the selected elements.*
>
> - input list
> - i := 0
> - while i < length(list) do
>    - maxId := 0
>    - j := 0
>    - while j < length(list) - i do
>      - if list[j] > list[maxId] then
>        - maxId := j
>      - j := j + 1
>    - i := i + 1
>    - swap(list, maxId, length(list) - i)
> - return list
>
> ## swap
> - input list, i, j
> - temp := list[i]
> - list[i] := list[j]
> - list[j] := temp
> - return