# MD Basic: Execute Markdown as Pseudo Code

**MD Basic** interprets the DOM of a website / document as a basic scripting language and its runtime memory. The HTML elements it employs are a subset of those that can easily be expressed in Markdown. A simple JS script makes Markdown documents express and run algorithms.

## Example

You just place `***RUN***` somewhere in your Markdown file. In the rendered output, you can click the RUN token to start execution there. (This, of course, only works if you use a Markdown viewer / renderer that allows the JS script to run. E.g. the GitHub rendering of this readme is not executable, but the one rendered to <https://benkeks.github.io/markdown-basic/> is.)

> ***RUN***
>
> - greet(`ben`)
> - greet(`you!`)
>
> -----
>
> ### greet
>
> - INPUT yourName
> - OUTPUT `hello ` + yourName
> - RETURN

### Further examples

- [Sorting algorithms in MD Basic](https://benkeks.github.io/markdown-basic/examples/sorting-algorithms)


## How to use

Include the interpreter in your HTML like this:

```html
<script type="module">
  import MDBasic from 'https://benkeks.github.io/markdown-basic/md-basic.js'
  new MDBasic()
</script>
```

## Syntax and semantics

The syntax is mostly case-insensitive. For the purpose of the examples, we'll write keywords in upper case and variables in lower case. The examples assume that the employed Markdown renderer provides headings with ids matching the name in lower-case.

### Input / output

- `INPUT x` – Assign a value from the input stack to variable `x` (usually at the beginning of a function).
- `OUTPUT e` – Output result of executing `e` next to the code.

### Variable access and assignments

The DOM is the memory.

**Local variables** are created when accessed. They are assigned by `x := e` syntax.

**Global variables** (and functions) exist if there is a label in the input program for them. A *label* is an HTML entity with the variables name in lower-case as `id` attribute. In Markdown, such labels come into existence by placing a heading. The value of a labeled variable is the DOM element that follows the label. Values can be string `hello`, numbers (expressed as plain numbers), unnumbered lists of values, or links to other labels in the memory. Numbers and strings will be coerced by the funny JavaScript semantics.

> ***RUN***
> - localy := `hello `
> - OUTPUT localy + globalx
>
> ----------
>
> #### globalx
>
> `world`

The local variables are, by the way, also added to the DOM, at the end of the document body. *The DOM is the memory!*

The program execution ends at horizontal lines. (`----` in Markdown – pay attention, some Markdown parsers might also get such a line to mark a heading...)

### Function calls

Functions are defined as global variables. Their input is retrieved through `INPUT x` statements. They are called in the standard `functionname(e1, e2)` syntax. They provide their output through `RETURN e` statements. Builtin statements can be accessed without parenthesis.

> ***RUN***
>
> - n := myfunction(23)
> - OUTPUT n + 31
>
> ----------
>
> #### myfunction
>
> - INPUT x
> - OUTPUT `hello`
> - RETURN x + 19

Due to the simplicity of the program-counter model, calls to user-defined functions may only appear at the toplevel or directly at the right-hand side of an assignment.

### Conditions

Program flow can be structured by `IF e THEN <subblock> [ELSE <elseblock>]` and `WHILE e DO <subblock>` constructs. The subblocks have to be nested DOM elements. The `ELSE` must be in a next-sibling block of the `IF`. *The DOM nesting is the code nesting.* Truthiness is determined by JavaScript.

> ***RUN***
> - n := 5
> - WHILE n > 0 DO
>   - x := mysgn(n - 3)
>   - OUTPUT n
>   - OUTPUT x
>   - n := n - 1
>
> ---------
> ## mysgn
> - INPUT n
> - IF n > 0 THEN
>   - RETURN 1
> - ELSE IF n < 0 THEN
>   - RETURN -1
> - ELSE
>   - RETURN 0

### Builtin binops and functions

There are the following builtin binary operators: `+` addition, `-` subtraction, `*` multiplication, `/` division, `^` exponentiation, `=` equivalence check, `<>` inequivalence, `>` greater, `<` less, `>=` greater or equal, `<=` less or equal, `MOD` modulo, `AND` boolean conjunction, `OR` boolean disjunction.

Warning: As of now, expressions are only bracketed from the right and you can't provide explicit parenthesis – so you usually don't want to have more than one of these operations in each argument.

Moreover, there are builtin functions:

- `string(obj)` – convert any object to a string
- `abs(i)` – get the absolute value of a number
- `length(a)` – get the length of an array

### Complex values

If a variable contains an unnumbered list, it's elements can be accessed through array syntax `list[i]`. `length(list)` returns the number of child elements.

> ***RUN***
> - i := length(list)
> - WHILE i > 0 DO
>   - i := i - 1
>   - list[i] := list[i] ^ 2
> - OUTPUT string(list)
>
> ------
> #### list
> - 1
> - 2
> - 3
> - 4

If you assign a complex value to a variable, the element is not copied. Instead, a reference to the complex value is stored. (Thus, complex values are passed to functions following the call-by-sharing paradigm.)

## Why “BASIC?”

This whole paradigm of having data and code as one dynamic interpreted document feels a lot like classic BASIC programming (or assembler, if you will). Consequently, there's also a `GOTO label` command – don't use it! ;)

------

<script type="module" defer>
  import MDBasic from './md-basic.js'
  new MDBasic()
</script>
