let PC = window.document.querySelector("#main").nextElementSibling.children[0]
let OUTPUT = window.document.querySelector("#_OUTPUT")
let ARGSTACK = window.document.querySelector("#_INPUT")
let CALLSTACK = window.document.querySelector("#_STACK")
let stackLevel = 0
let STORAGE = window.document.querySelector("#_LOCAL")

const binaryOperators = {
  "+": (x,y) => x + y,
  "-": (x,y) => x - y,
  "*": (x,y) => x * y,
  "/": (x,y) => x / y,
  "=": (x,y) => x == y,
  "<>": (x,y) => x != y,
  ">": (x,y) => x > y,
  "<": (x,y) => x < y,
  ">=": (x,y) => x >= y,
  "<=": (x,y) => x <= y,
  "AND": (x,y) => x & y,
  "OR": (x,y) => x | y,
}
const ARBITRARY_ARITY = -1
const builtInFunctions = {
  // memory management
  "INPUT": {
    arity: ARBITRARY_ARITY,
    documentation: "Fill variables with values from the input stack.",
    lazy: true,
    fun: (...vars) => {
      popArgs(vars)
    }
  },
  "OUTPUT": {
    arity: ARBITRARY_ARITY,
    documentation: "Add a value to the output history.",
    fun: (...outs) => {
      output(outs)
    }
  },
  "PUSH": {
    arity: ARBITRARY_ARITY,
    documentation: "Add a value to the input stack.",
    fun: (...outs) => {
      pushArgs(outs)
    }
  },
  "STASH": {
    arity: 0,
    documentation: "Serialize local memory including variable labels into a string.",
    fun: () => {
      return quoteMemory(STORAGE, true)
    }
  },
  "UNSTASH": {
    arity: 1,
    documentation: "Fill local memory with named variables and their content from a string.",
    fun: (quotedMem) => {
      console.log("mem", quotedMem)
      return loadMemory(STORAGE, quotedMem)
    }
  },
  // math functions
  "ABS": {
    arity: 1,
    documentation: "Take the absolute value of a number",
    fun: (x) => Math.abs(x)
  },
}


export async function run() {
  PC = window.document.querySelector("#main").nextElementSibling.children[0]
  OUTPUT = window.document.querySelector("#_OUTPUT")
  ARGSTACK = window.document.querySelector("#_INPUT")
  CALLSTACK = window.document.querySelector("#_STACK")
  stackLevel = 0
  STORAGE = window.document.querySelector("#_LOCAL")
  runStep()
}

function runStep() {
  try {
    executeLine(PC)
    setTimeout(runStep, 300)
  } catch (e) {
    debugMessage(e)
  }
}

function debugMessage(message, mode = "info") {
  PC.insertAdjacentHTML("afterend", `<div class="alert alert-${mode} part">${message}</div>`)
}

function shiftPC(skipElse = true) {
  if (PC instanceof HTMLUListElement) {
    setPC(PC.children[0])
  } else {
    let newPCScope = PC
    // move out of nested code blocks
    while (true) {
      if (newPCScope.nextElementSibling) {
        setPC(newPCScope.nextElementSibling)
        if (skipElse && PC.innerText.match(/^ELSE\W/i)) {
          // skip ELSE branches when moving out of blocks
          // (= they have to be reached through IF jumps.)
          shiftPC()
        }
        return
      } else {
        newPCScope = newPCScope.parentElement
      }
    }
  }
}

function setPC(newPC) {
  if (newPC === null || newPC instanceof HTMLHRElement) {
    throw ["Program has ended at ", PC]
  }
  PC.classList.remove("pc")
  newPC.classList.add("pc")
  PC = newPC
}

function executeLine(line) {
  console.log("Line", line)
  let tokens = tokenizeLine(line)
  console.log("Statement", tokens)
  const command = tokens.shift()
  const oldPC = PC
  switch (typeof command === "string" && command.toUpperCase()) {
    case "IF":
      const cond = readArguments(tokens, false, "THEN").shift()
      if (cond) {
        setPC(tokens.shift())
      } else {
        shiftPC(false)
      }
      tokens.length = 0
      break
    case "ELSE":
      if (tokens[0].toUpperCase && tokens[0].toUpperCase() === "IF") {
        tokens.shift()
        const cond = readArguments(tokens, false, "THEN").shift()
        if (cond) {
          setPC(tokens.shift())
        } else {
          shiftPC(false)
        }
        tokens.length = 0
      } else {
        setPC(tokens.shift())
      }
      break
    case "GOTO":
      setPC(readArguments(tokens, true).shift())
      shiftPC()
      break
    case "GOSUB":
      pushStack(PC)
      setPC(readArguments(tokens, true).shift())
      shiftPC()
      break
    case "RETURN":
      const returnValues = readArguments(tokens)
      output(returnValues)
      popStack()
      shiftPC()
      break
    default:
      if (command !== null) {
        tokens.unshift(command)
        const returns = readExpression(tokens, false)
        if (returns.function) {
          // invoke a user defined function
          pushArgs(returns.args)
          pushStack(PC, returns.writeback)
          setPC(returns.function)
        }
        shiftPC()
      }
  }
  if (tokens.length !== 0) {
    // restore previous position in order to highlight the line where the error occurred
    setPC(oldPC)
    throw "Could not parse the line. Remainder: "+tokens
  }
}

function tokenizeLine(line) {
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

function readArguments(lineTokens, lazy = false, end = "") {
  const args = []
  if (lineTokens.length === 0) return args
  if (lineTokens[0].toUpperCase && lineTokens[0].toUpperCase() === end) {
    lineTokens.shift()
    return args
  }
  while (true) {
    if (lazy) {
      args.push(readVariable(lineTokens))
    } else {
      args.push(readExpression(lineTokens))
    }
    if (lineTokens.length === 0) {
      return args
    } else if (lineTokens[0].toUpperCase && lineTokens[0].toUpperCase() === end) {
      lineTokens.shift()
      return args
    } else {
      parseConsume(lineTokens, ",")
    }
  }
}

function readExpression(lineTokens, requireReturns = true) {
  const mainToken = lineTokens[0]
  let value = mainToken
  if (typeof mainToken === "string" && mainToken.match(/\-?[0-9]+/)) {
    // token is an integer literal
    value = parseInt(mainToken)
    lineTokens.shift()
  } else if (typeof mainToken === "string" || mainToken instanceof HTMLAnchorElement) {
    // the token is a variable and will be resolved
    value = readVariable(lineTokens)
    if (lineTokens[0] === ":=") {
      // we are updating an assignment
      lineTokens.shift()
      const newValue = readExpression(lineTokens)
      if (newValue.function) {
        newValue.writeback = value
        value = newValue
      } else {
        assign(value, newValue)
      }
    } else if (lineTokens[0] === "("){
      // we are calling a function
      lineTokens.shift()
      const args = readArguments(lineTokens, value.lazy, ")")
      value = callFunction(value, args)
    } else if (!requireReturns) {
      // we are calling a function in command syntax (==> no returns!)
      const args = readArguments(lineTokens, value.lazy)
      callFunction(value, args)
    }
    if (value === undefined) {
      if (requireReturns) {
        throw "This command does not return values."
      } else {
        return
      }
    }
  } else {
    lineTokens.shift()
  }
  value = unwrapValue(value)
  // try to read infix operators (right-associatively for now)
  if (lineTokens[0] in binaryOperators) {
    const op = binaryOperators[lineTokens[0]]
    lineTokens.shift()
    const secondArg = readExpression(lineTokens)
    checkValuesPrimitive(value, secondArg)
    value = op(value, secondArg)
  }
  console.log("Eval returns", value)
  return value
}

/* returns the cell where the content of a variable is stored*/
function readVariable(lineTokens) {
  let mainToken = lineTokens.shift()
  let value
  console.log("main token", mainToken)
  if (mainToken instanceof HTMLAnchorElement) {
    value = window.document.querySelector(mainToken.hash)
  } else {
    value = window.document.querySelector(`#${mainToken}`)
  }
  if (value === null) {
    if (mainToken.toUpperCase() in builtInFunctions) {
      // look up the name in the build-in functions
      value = builtInFunctions[mainToken.toUpperCase()]
    } else {
      // non-existent variables will implicitly be created
      value = mallocVar(mainToken)
    }
  }
  if (lineTokens[0] === "[") {
    // we are navigating an array
    lineTokens.shift()
    const offset = readExpression(lineTokens)
    parseConsume(lineTokens, "]")
    value = resolve(value, offset)
  } else {
    value = resolve(value)
  }
  console.log("lookup result", mainToken, value)
  return value
}

function resolve(label, offset = undefined) {
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
      throw `${offset} out of bounds.`
    }
  }
  if (value === undefined || value.localName === "hr") {
    throw `Ran into a memory barrier when accessing <code>${label.textContent}</code>!`
  }
  return value
}

/* unwrap what has been saved in a memory value to be used in interpretation */
function unwrapValue(value) {
  if (["code", "pre", "li"].includes(value.localName)) {
    value = value.textContent
    if (value.match(/^\-?[0-9]+$/)) {
      value = parseInt(value)
    }
  }
  return value
}

/* wrap a value from interpretation to be written to memory as HTML element */
function wrapValue(value) {
  if (value.localName) {
    // it's already some kind of HTML element
    return value
  } else {
    const element = window.document.createElement("code")
    element.innerText = value
    return element
  }
}

function checkValuesPrimitive(...values) {
  const nonPrimitive = values.find(v => typeof v === "object" || typeof v === "function")
  if (nonPrimitive?.function) {
    throw `You may not place a call to a user-defined function like this.`
  } else if (nonPrimitive) {
    throw `Expected primitive value but found ${nonPrimitive}.`
  }
}

function peek(label) {
  return unwrapValue(resolve(label))
}

/* quotes a part of the document till the end or <hr> is reached */
function quoteMemory(label, andDelete = false) {
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
  console.log("quoted", quoted)
  return quoted
}

/* inserts quoted memory into active memory */
function loadMemory(label, quotedMem) {
  label.insertAdjacentHTML("afterend", quotedMem)
}

function output(out) {
  for (let o of out) {
    if (typeof o === "object") {
      console.log("Output Obj", o)
      const outClone = createRef(o)//o.cloneNode(true)
      OUTPUT.insertAdjacentElement("afterend", outClone)
      OUTPUT = outClone
    } else {
      const outText = wrapValue(o)
      OUTPUT.insertAdjacentElement("afterend", outText)
      OUTPUT = outText
    }
  }
}

function undoOutput() {
  const oldOut = OUTPUT
  const outVal = unwrapValue(oldOut)
  OUTPUT = OUTPUT.previousSibling
  oldOut.remove()
  return outVal
}

function mallocVar(name) {
  console.log("Malloc", name)
  const variable = window.document.createElement("h4")
  variable.id = name
  variable.textContent = name
  const emptyCell = wrapValue("")
  STORAGE.insertAdjacentElement("afterend", variable)
  variable.insertAdjacentElement("afterend", emptyCell)
  return variable
}

function createRef(variable) {
  variable = getLabel(variable)
  const ref = window.document.createElement("a")
  ref.href = "#"+variable
  ref.innerText = variable
  return ref
}

function assign(cell, value) {
  console.log(`Assing ${getLabel(cell)} with value ${value}.`)
  if (typeof value === "object") {
    // save only references to complex objects
    cell.insertAdjacentElement("beforebegin", createRef(value))
  } else {
    cell.insertAdjacentElement("beforebegin", wrapValue(value))
  }
  cell.remove()
}

function getLabel(object) {
  return object?.previousElementSibling?.id
}

function callFunction(func, args) {
  if (func.arity !== undefined) {
    if (args.length === func.arity || func.arity === ARBITRARY_ARITY) {
      if (args.some(a => a.function)) {
        throw `User-defined functions may not be appear in function calls.`
      }
      return func.fun(...args)
    } else {
      throw `Expected ${func.arity} arguments but received ${args.length}.`
    }
  } else {
    return {
      function: func,
      args: args,
      writeback: undefined
    }
  }
}

function pushArgs(args) {
  for (let o of args.reverse()) {
    if (typeof o === "object") {
      const outClone = createRef(o)
      ARGSTACK.insertAdjacentElement("afterend", outClone)
    } else {
      ARGSTACK.insertAdjacentElement("afterend", wrapValue(o))
    }
  }
}

function popArgs(args) {
  console.log("Variables to assign", args)
  for (let cell of args) {
    assign(cell, peek(ARGSTACK))
    ARGSTACK.nextElementSibling.remove()
  }
}

function pushStack(pc, writebackAddress = undefined) {
  pc.classList.add("stacked")
  pc.classList.add(`stacked-${stackLevel}`)
  if (writebackAddress) {
    writebackAddress.classList.add(`writeback-${stackLevel}`)
  }
  const stackEntry = quoteMemory(STORAGE, true)
  CALLSTACK.insertAdjacentElement("afterend", wrapValue(stackEntry))
  stackLevel += 1
}

function popStack() {
  if (stackLevel <= 0) {
    throw "Can't return at empty stack."
  }
  stackLevel -= 1
  let oldPC = window.document.querySelector(`.stacked-${stackLevel}`)
  oldPC.classList.remove("stacked")
  oldPC.classList.remove(`stacked-${stackLevel}`)
  // delete local variables and restore old local context
  quoteMemory(STORAGE, true)
  let stackEntry = CALLSTACK.nextElementSibling
  loadMemory(STORAGE, unwrapValue(stackEntry))
  stackEntry.remove()
  setPC(oldPC)
  // if a writeback is expected, perform it from output stack
  const writeback = window.document.querySelector(`.writeback-${stackLevel}`)
  if (writeback) {
    writeback.classList.remove(`writeback-${stackLevel}`)
    assign(writeback, undoOutput())
  }
}

function parseConsume(tokens, expectation) {
  const token = tokens.shift()
  if (expectation !== token) {
    throw `Expected \`${expectation}\` but found \`${token}\`!`
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}