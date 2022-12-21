
const ARBITRARY_ARITY = -1

class MDBError {
  constructor(msg, location) {
    this.msg = msg
    this.location = location
  }
}

export default class MDBasic {

  constructor(doc = window.document.body) {
    this.doc = doc
    this.PC = this.findPC()
    this.lastOutput = null
    this.ARGSTACK = null
    this.CALLSTACK = this.obtainMemArea("_STACK")
    this.STORAGE = this.obtainMemArea("_LOCAL")
    this.executionSpeed = 1000
    this.provideStyleSheets()

    this.binaryOperators = {
      "+": (x,y) => x + y,
      "-": (x,y) => x - y,
      "*": (x,y) => x * y,
      "/": (x,y) => x / y,
      "^": (x,y) => x ** y,
      "=": (x,y) => x == y,
      "<>": (x,y) => x != y,
      ">": (x,y) => x > y,
      "<": (x,y) => x < y,
      ">=": (x,y) => x >= y,
      "<=": (x,y) => x <= y,
      "AND": (x,y) => x & y,
      "OR": (x,y) => x | y,
    }
    this.builtInFunctions = {
      // memory management
      "input": {
        arity: ARBITRARY_ARITY,
        documentation: "Fill variables with values from the input stack.",
        lazy: true,
        fun: (...vars) => {
          this.popArgs(vars)
        }
      },
      "output": {
        arity: ARBITRARY_ARITY,
        documentation: "Add a value to the output history.",
        fun: (...outs) => {
          this.output(outs)
        }
      },
      "push": {
        arity: ARBITRARY_ARITY,
        documentation: "Add a value to the input stack.",
        fun: (...outs) => {
          this.pushArgs(outs)
        }
      },
      "stash": {
        arity: 0,
        documentation: "Serialize local memory including variable labels into a string.",
        fun: () => {
          return this.quoteMemory(this.STORAGE, true)
        }
      },
      "unstash": {
        arity: 1,
        documentation: "Fill local memory with named variables and their content from a string.",
        fun: (quotedMem) => {
          return this.loadMemory(this.STORAGE, quotedMem)
        }
      },
      // math functions
      "abs": {
        arity: 1,
        documentation: "Take the absolute value of a number",
        fun: (x) => Math.abs(x)
      },
      // list functions
      "length": {
        arity: 1,
        documentation: "Determine length of a list",
        fun: (x) => x.children.length
      },
      // conversions
      "string": {
        arity: 1,
        documentation: "Convert a value to a string",
        fun: (x) => x.outerHTML || x.toString()
      },
    }
    // auto-start if there is a RUNNING tag
    if (this.PC) this.run()
  }

  obtainMemArea(id) {
    let mem = this.doc.querySelector(`#${id}`)
    if (mem === null) {
      mem = window.document.createElement("h2")
      mem.id = id
      mem.innerText = id
      this.doc.append(mem)
      mem.insertAdjacentHTML("afterend", "<hr>")
    }
    return mem
  }

  provideStyleSheets() {
    let style = document.createElement("style")
    document.head.appendChild(style)
    style.sheet.insertRule(".mdb-pc, .mdb-pc:first-child { background-color: rgba(100,150,250, .4) }")
    style.sheet.insertRule(".mdb-pc>a, .mdb-pc>code { margin-left: .7rem}")
    style.sheet.insertRule(".mdb-call { background-color: rgba(50,140,200, .3) }")
    style.sheet.insertRule(".mdb-debug { background-color: rgba(230,230,50, .4) }")
    style.sheet.insertRule(".mdb-output { background-color: rgba(150,230,150, .5); margin-left: .7rem; }")
    style.sheet.insertRule(".mdb-output, .mdb-pc, .mdb-debug, .mdb-output { padding: .1rem; border-radius: .2rem }")
  }

  findPC() {
    const pcs = [...this.doc.querySelectorAll("em")]
      .filter(el => el?.firstChild?.innerText === "RUN" || el?.firstChild?.innerText === "RUNNING")
    pcs.forEach(pc => this.decoratePCPointer(pc))
    return pcs.find(el => el?.firstChild?.innerText === "RUNNING")
  }

  decoratePCPointer(pc) {
    pc.addEventListener("click", (ev) => {
      if (pc.firstChild.innerHTML.split("-")[0] === "RUN") {
        this.run(pc)
      }
    })
    pc.classList.add("mdb-pc")
    pc.style.cursor = "pointer"
  }

  findCall(stackLevel) {
    return [...this.doc.querySelectorAll("em")]
      .find(el => el?.firstChild?.innerText === "CALL-" + stackLevel)
  }

  insertCall(pc, stackLevel) {
    pc.insertAdjacentHTML("beforebegin", `<em class="mdb-call"><strong>CALL-${stackLevel}</strong><em/>`)
  }

  run(pc) {
    this.PC = pc || this.PC
    this.ARGSTACK = pc.firstChild
    if (!this.PC) {
      throw "You have to name a starting position!"
    }
    this.setPCState("RUNNING")
    this.shiftPC()
    this.runStep()
  }

  runStep() {
    if (this.getPCState() === "RUNNING") {
      try {
        this.executeLine(this.getPCLocation())
        setTimeout(() => this.runStep(), this.executionSpeed)
      } catch (e) {
        if (e instanceof MDBError) {
          if (e.msg === "Program has ended.") {
            this.setPCState("EXIT")
            this.debugMessage(e.msg)
          } else {
            this.setPCState("ERROR")
            this.debugMessage(e.msg, "error")
          }
        } else {
          throw e
        }
      }
    }
  }

  setPCState(state, stackLevel) {
    if (stackLevel === undefined) {
      stackLevel = this.getPCStackLevel()
    }
    this.PC.firstChild.innerHTML = state + "-" + stackLevel
  }

  getPCState() {
    return this.PC.firstChild.innerHTML.split("-")[0]
  }

  getPCStackLevel() {
    return parseInt(this.PC.firstChild.innerHTML.split("-")[1]) || 0
  }

  getPCLocation() {
    return this.PC.nextSibling
  }

  debugMessage(message, mode = "info") {
    this.getPCLocation().insertAdjacentHTML("beforeend", `<div class="mdb-debug alert alert-${mode} part">${message}</div>`)
  }

  shiftPC(skipElse = true) {
    let newPCScope = this.getPCLocation()
    // move out of nested code blocks
    while (true) {
      if (newPCScope.nextElementSibling) {
        this.setPC(newPCScope.nextElementSibling)
        if (skipElse && this.PC.innerText.match(/^ELSE\W/i)) {
          // skip ELSE branches when moving out of blocks
          // (= they have to be reached through IF jumps.)
          this.shiftPC()
        }
        return
      } else {
        newPCScope = newPCScope.parentElement
        if (newPCScope.innerText.match(/^WHILE\W/i)) {
          // loop at whiles
          this.setPC(newPCScope)
          return
        } else if (newPCScope instanceof HTMLQuoteElement) {
          throw new MDBError("Hit end of quoted code block.")
        }
      }
    }
  }

  setPC(newPCLocation) {
    if (newPCLocation === null || newPCLocation instanceof HTMLHRElement) {
      if (this.getPCStackLevel() !== 0) {
        throw new MDBError("Program ended unexpectedly during a function call. (Missing <code>RETURN</code>?)")
      } else {
        throw new MDBError("Program has ended.")
      }
    }
    while (newPCLocation instanceof HTMLUListElement || newPCLocation instanceof HTMLOListElement) {
      // move into list blocks
      newPCLocation = newPCLocation.children[0]
    }
    newPCLocation.insertAdjacentElement("beforebegin", this.PC)
  }

  executeLine(line) {
    let tokens = this.tokenizeLine(line)
    console.log(tokens)
    const command = tokens.shift()
    const oldPC = this.PC
    switch (typeof command === "string" && command.toLowerCase()) {
      case "if":
        const cond = this.readArguments(tokens, false, "then").shift()
        if (cond) {
          this.setPC(tokens.shift())
        } else {
          this.shiftPC(false)
        }
        tokens.length = 0
        break
      case "else":
        if (tokens[0].toLowerCase && tokens[0].toLowerCase() === "if") {
          tokens.shift()
          const cond = this.readArguments(tokens, false, "then").shift()
          if (cond) {
            this.setPC(tokens.shift())
          } else {
            this.shiftPC(false)
          }
          tokens.length = 0
        } else {
          this.setPC(tokens.shift())
        }
        break
      case "while":
        const whileCond = this.readArguments(tokens, false, "do").shift()
        if (whileCond) {
          this.setPC(tokens.shift())
        } else {
          this.shiftPC(false)
        }
        tokens.length = 0
        break
      case "goto":
        this.setPC(this.readArguments(tokens, true).shift())
        break
      case "return":
        const returnValues = this.readArguments(tokens)
        this.output(returnValues)
        this.popStack()
        this.shiftPC()
        break
      default:
        if (command !== null) {
          tokens.unshift(command)
          const returns = this.readExpression(tokens, false)
          if (returns.function) {
            // invoke a user defined function
            this.pushArgs(returns.args)
            this.pushStack(this.getPCLocation(), returns.writeback)
            this.setPC(returns.function)
          } else {
            this.shiftPC()
          }
        }
    }
    if (tokens.length !== 0) {
      // restore previous position in order to highlight the line where the error occurred
      this.setPC(oldPC)
      throw new MDBError("Could not parse the line. Remainder: " + tokens)
    }
  }

  tokenizeLine(line) {
    const tokens = []
    for (let e of line.childNodes) {
      if (e instanceof Text) {
        const subtokens =
          e.data.match(/\-?[a-z0-9\_]+|,|\]|\[|\(|\)|\:\=|[\>\<\=]+|[\+\-\*\/]/gi)
        if (subtokens) {
          tokens.push(...subtokens)
        }
      } else {
        tokens.push(e)
      }
    }
    return tokens
  }

  readArguments(lineTokens, lazy = false, end = "") {
    const args = []
    if (lineTokens.length === 0) return args
    if (lineTokens[0].toLowerCase && lineTokens[0].toLowerCase() === end) {
      lineTokens.shift()
      return args
    }
    while (true) {
      if (lazy) {
        args.push(this.readVariable(lineTokens))
      } else {
        args.push(this.readExpression(lineTokens))
      }
      if (lineTokens.length === 0) {
        return args
      } else if (lineTokens[0].toLowerCase && lineTokens[0].toLowerCase() === end) {
        lineTokens.shift()
        return args
      } else {
        this.parseConsume(lineTokens, ",")
      }
    }
  }

  readExpression(lineTokens, requireReturns = true) {
    const mainToken = lineTokens[0]
    let value = mainToken
    if (typeof mainToken === "string" && mainToken.match(/\-?[0-9]+/)) {
      // token is an integer literal
      value = parseInt(mainToken)
      lineTokens.shift()
    } else if (typeof mainToken === "string" || mainToken instanceof HTMLAnchorElement) {
      // the token is a variable and will be resolved
      value = this.readVariable(lineTokens)
      if (lineTokens[0] === ":=") {
        // we are updating an assignment
        lineTokens.shift()
        const newValue = this.readExpression(lineTokens)
        if (newValue.function) {
          newValue.writeback = value
          value = newValue
        } else {
          this.assign(value, newValue)
        }
      } else if (lineTokens[0] === "("){
        // we are calling a function
        lineTokens.shift()
        const args = this.readArguments(lineTokens, value.lazy, ")")
        value = this.callFunction(value, args)
      } else if (!requireReturns) {
        // we are calling a function in command syntax (==> no returns!)
        const args = this.readArguments(lineTokens, value.lazy)
        this.callFunction(value, args)
      }
      if (value === undefined) {
        if (requireReturns) {
          throw new MDBError("This command does not return values.")
        } else {
          return
        }
      }
    } else {
      lineTokens.shift()
    }
    value = this.unwrapValue(value)
    // try to read infix operators (right-associatively for now)
    if (lineTokens[0] in this.binaryOperators) {
      const op = this.binaryOperators[lineTokens[0]]
      lineTokens.shift()
      const secondArg = this.readExpression(lineTokens)
      this.checkValuesPrimitive(value, secondArg)
      value = op(value, secondArg)
    }
    console.log("Eval returns", value)
    return value
  }

  /* returns the cell where the content of a variable is stored*/
  readVariable(lineTokens) {
    let mainToken = lineTokens.shift()
    let normalizedName = mainToken.hash?.slice(1) || mainToken.toLowerCase()
    let value = window.document.querySelector(`#${normalizedName}`)
    if (value === null) {
      if (normalizedName in this.builtInFunctions) {
        // look up the name in the build-in functions
        value = this.builtInFunctions[normalizedName]
      } else {
        // non-existent variables will implicitly be created
        value = this.createVar(normalizedName)
      }
    }
    if (lineTokens[0] === "[") {
      // we are navigating an array
      lineTokens.shift()
      const offset = this.readExpression(lineTokens)
      this.parseConsume(lineTokens, "]")
      value = this.resolve(value, offset)
    } else {
      value = this.resolve(value)
    }
    return value
  }

  resolve(label, offset = undefined) {
    if (label.arity !== undefined) {
      // this is a built-in function and needs no further resolution
      return label
    }
    let value = label.nextElementSibling
    // automatically resolve heap references
    while (value.localName === "a") {
      console.log("Lookup address", value.hash)
      value = window.document.querySelector(`${value.hash}`).nextElementSibling
    }
    if (offset !== undefined) {
      value = value.children[offset]
      if (value === undefined) {
        throw new MDBError(`${offset} out of bounds.`)
      }
    }
    if (value === undefined || value.localName === "hr") {
      throw new MDBError(`Ran into a memory barrier when accessing <code>${label.textContent}</code>!`)
    }
    return value
  }

  /* unwrap what has been saved in a memory value to be used in interpretation */
  unwrapValue(value) {
    if (["code", "pre", "li"].includes(value.localName)) {
      value = value.textContent
      if (value.match(/^\-?[0-9]+$/)) {
        value = parseInt(value)
      }
    }
    return value
  }

  /* wrap a value from interpretation to be written to memory as HTML element */
  wrapValue(value) {
    if (value.localName) {
      // it's already some kind of HTML element
      return this.createRef(value)
    } else {
      const element = window.document.createElement("code")
      element.innerText = value
      return element
    }
  }

  checkValuesPrimitive(...values) {
    const nonPrimitive = values.find(v => typeof v === "object" || typeof v === "function")
    if (nonPrimitive?.function) {
      throw new MDBError(`You may not place a call to a user-defined function like this.`)
    } else if (nonPrimitive) {
      throw new MDBError(`Expected primitive value but found ${nonPrimitive}.`)
    }
  }

  peek(label) {
    return this.unwrapValue(this.resolve(label))
  }

  /* quotes a part of the document till the end or <hr> is reached */
  quoteMemory(label, andDelete = false) {
    let quoted = ""
    label = label.nextSibling
    while (label !== null && !(label instanceof HTMLHRElement)) {
      quoted += label.outerHTML || label.textContent
      const newLabel = label.nextSibling
      if (andDelete) {
        label.remove()
      }
      label = newLabel
    }
    return quoted
  }

  /* inserts quoted memory into active memory */
  loadMemory(label, quotedMem) {
    label.insertAdjacentHTML("afterend", quotedMem)
  }

  output(out) {
    for (let o of out) {
      const outText = this.wrapValue(o)
      this.lastOutput = window.document.createElement("span")
      this.lastOutput.classList.add("mdb-output")
      this.lastOutput.appendChild(outText)
      this.getPCLocation().insertAdjacentElement("beforeend", this.lastOutput)
    }
  }

  getLastOutput() {
    return this.unwrapValue(this.lastOutput.firstChild)
  }

  createVar(name) {
    const variable = window.document.createElement("h4")
    variable.id = name
    variable.textContent = name
    const emptyCell = this.wrapValue("")
    this.STORAGE.insertAdjacentElement("afterend", variable)
    variable.insertAdjacentElement("afterend", emptyCell)
    return variable
  }

  createRef(variable) {
    variable = this.getLabel(variable)
    const ref = window.document.createElement("a")
    ref.href = "#"+variable
    ref.innerText = variable
    return ref
  }

  assign(cell, value) {
    console.log(`Assing ${this.getLabel(cell)} with value ${value}.`)
    cell.insertAdjacentElement("beforebegin", this.wrapValue(value))
    cell.remove()
  }

  getLabel(object) {
    return object?.previousElementSibling?.id
  }

  callFunction(func, args) {
    if (func.arity !== undefined) {
      if (args.length === func.arity || func.arity === ARBITRARY_ARITY) {
        if (args.some(a => a.function)) {
          throw new MDBError(`User-defined functions may not be appear in function calls.`)
        }
        return func.fun(...args)
      } else {
        throw new MDBError(`Expected ${func.arity} arguments but received ${args.length}.`)
      }
    } else {
      return {
        function: func,
        args: args,
        writeback: undefined
      }
    }
  }

  pushArgs(args) {
    for (let o of args.reverse()) {
      this.ARGSTACK.insertAdjacentElement("afterend", this.wrapValue(o))
    }
  }

  popArgs(args) {
    for (let cell of args) {
      this.assign(cell, this.peek(this.ARGSTACK))
      this.ARGSTACK.nextElementSibling.remove()
    }
  }

  pushStack(pc, writebackAddress = undefined) {
    const stackLevel = this.getPCStackLevel()
    this.insertCall(pc, stackLevel)
    if (writebackAddress) {
      writebackAddress.classList.add(`writeback-${stackLevel}`)
    }
    const stackEntry = this.quoteMemory(this.STORAGE, true)
    this.CALLSTACK.insertAdjacentElement("afterend", this.wrapValue(stackEntry))
    this.setPCState(this.getPCState(), stackLevel + 1)
  }

  popStack() {
    let stackLevel = this.getPCStackLevel()
    if (stackLevel <= 0) {
      throw new MDBError("Can't return at empty stack.")
    }
    stackLevel -= 1
    // delete local variables and restore old local context
    this.quoteMemory(this.STORAGE, true)
    let stackEntry = this.CALLSTACK.nextElementSibling
    this.loadMemory(this.STORAGE, this.unwrapValue(stackEntry))
    stackEntry.remove()
    // restore PC
    let oldPC = this.findCall(stackLevel)
    this.setPC(oldPC)
    oldPC.remove()
    // if a writeback is expected, perform it from output stack
    const writeback = window.document.querySelector(`.writeback-${stackLevel}`)
    if (writeback) {
      writeback.classList.remove(`writeback-${stackLevel}`)
      this.assign(writeback, this.getLastOutput())
    }
    this.setPCState(this.getPCState(), stackLevel - 1)
  }

  parseConsume(tokens, expectation) {
    const token = tokens.shift()
    if (expectation !== token) {
      throw new MDBError(`Expected \`${expectation}\` but found \`${token}\`!`)
    }
  }
}