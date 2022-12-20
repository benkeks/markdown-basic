# MD Basic: Execute Markdown as Pseudo Code

## Example

You just place `***RUN***` somewhere in your markdown file. In the rendered output. Click the RUN token to start execution there.

> ***RUN***
>
> - greet(`ben`)
>
> ### greet
>
> - INPUT yourName
> - OUTPUT `hello ` + yourName


## Syntax and semantics

### Input / output

- `input x` – Assign a value from the input stack to variable `x` (usually at the beginning of a function).
- `output e` – Output result of executing `e`.

### Control flow

#### Assignments and function calls

> ***RUN***
>
> - n := myfunction(23)
> - OUTPUT n
>
> ----------
>
> ## myfunction
>
> - INPUT x
> - RETURN x + 19

#### Conditions

> ***RUN***
> - n := 5
> - WHILE n > 0 DO
>   - x := myabs(n - 3)
>   - OUTPUT x
>   - n := n - 1
>
> ---------
>
> ## myabs
> - INPUT n
> - IF n > 0 THEN
>   - RETURN 1
> - ELSE IF n < 0 THEN
>   - RETURN -1
> - ELSE
>   - RETURN 0

### How to use

```html
<script type="module">
  import MDBasic from './md-basic.js'
  new MDBasic()
</script>
```


------


<script type="module">
  import MDBasic from './md-basic.js'
  new MDBasic()
</script>
